-- Migration: atomic idempotent credit refunds.
-- Date: 2026-09-14
--
-- Why:
--   1) CreditService.refundCredits does SELECT-then-UPDATE in application
--      code: two concurrent refunds read the same credits_used_today and one
--      write is lost (user under-refunded), and nothing stops the same
--      failure from being refunded twice (over-refund, floor-at-zero can
--      wipe real consumption). Charge path is already atomic
--      (20260814000000 consume_credits); refund must match it.
--   2) Refund callers need exactly-once semantics per failure. The
--      idempotency key (caller-supplied, e.g. refund:<session-id>) makes
--      replays — retries, double catch blocks, concurrent duplicates — a
--      safe no-op instead of a second refund.
--
-- Design notes:
--   - Single statement effects only: the guarded UPDATE evaluates the
--     decrement at execution time under the row lock, so concurrent
--     different-key refunds cannot lose writes.
--   - Same-key concurrency serializes on the unique index: exactly one
--     INSERT wins, the loser gets ROW_COUNT = 0 and returns FALSE.
--   - Key scope is (user_id, idempotency_key): identical key strings in
--     different users' rows never suppress each other. Keys are
--     per-attempt UUIDs (session.id / request attemptUUID), never
--     body-derived: two identical requests are two charges needing
--     independent refunds, and refund sites are control-flow exclusive
--     per attempt, so total refunds can never exceed total charges.
--   - balance_after is audit-only and computed from the pre-update read
--     (same approximation the consume path already makes).
--   - No RLS change: no SECURITY DEFINER, matching consume_credits; the
--     function runs with the caller's rights via the service-role client,
--     exactly like consume_credits. search_path pinned against hijacking.
--   - NOT applied automatically here: run `supabase db push` against
--     staging first, then the concurrency proof in the plan before prod.

-- 1) Idempotency key storage. Nullable so pre-existing rows are untouched;
--    the composite unique scope below means NULLs never participate.
ALTER TABLE credit_transactions
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Composite scope: the same key string in two users' rows must not
-- suppress either refund. (Plain global UNIQUE would cross-suppress.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_transactions_user_key
    ON credit_transactions (user_id, idempotency_key);

-- 2) Bound the public embeddings RPC: an unbounded match_count lets one
--    call dump the whole table (scrape) and burn ivfflat compute. Same
--    top-K results for every legitimate caller (all pass <= 50).
CREATE OR REPLACE FUNCTION public.match_activity_embeddings(
    query_embedding vector,
    match_count integer default 5
)
RETURNS TABLE (
    activity_id text,
    similarity float,
    metadata jsonb
) LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT
        ie.activity_id,
        1 - (ie.embedding <#> query_embedding)::float AS similarity,
        ie.metadata
    FROM public.itinerary_embeddings ie
    ORDER BY ie.embedding <#> query_embedding
    LIMIT LEAST(GREATEST(COALESCE(match_count, 5), 1), 50);
END;
$$;
-- 3) Atomic refund with idempotency guard. Returns TRUE when this call
--    applied a refund, FALSE when it was a no-op (unknown profile or
--    replayed key). Raises only on programmer-contract violations
--    (null/empty key, non-positive or absurd amount) — never on business
--    conditions, so catch-path callers stay non-throwing.
--    Deploy order: apply this migration BEFORE deploying app code that
--    calls refund_credits (the app maps a missing function to FALSE +
--    error log, but refunds silently stop until the migration lands).
--    Lock note: plain (non-concurrent) index build; acceptable for an
--    audit table of this size. Supabase runs migrations transactionally,
--    so CONCURRENTLY is unavailable by platform constraint.
CREATE OR REPLACE FUNCTION refund_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service VARCHAR(50),
    p_description TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_daily_credits INTEGER;
    v_used_today INTEGER;
    v_rows INTEGER;
BEGIN
    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'refund_credits requires a non-empty idempotency key';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000 THEN
        RAISE EXCEPTION 'refund_credits requires 0 < amount <= 1000 (got %)', p_amount;
    END IF;

    SELECT daily_credits, credits_used_today
    INTO v_daily_credits, v_used_today
    FROM user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        service_used,
        description,
        balance_after,
        idempotency_key
    ) VALUES (
        p_user_id,
        'refund',
        p_amount,
        p_service,
        COALESCE(p_description, 'Refund ' || p_amount || ' credit(s) for ' || p_service),
        GREATEST(0, v_daily_credits - GREATEST(0, v_used_today - p_amount)),
        p_idempotency_key
    )
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        -- Replayed key: a previous call already recorded this refund.
        RETURN FALSE;
    END IF;

    UPDATE user_profiles
    SET credits_used_today = GREATEST(0, credits_used_today - p_amount),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SET search_path = public;
