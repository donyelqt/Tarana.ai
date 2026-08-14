-- Migration: atomic credit consumption + refund transaction support
-- Date: 2026-08-14
--
-- Why:
--   1) The previous consume_credits did SELECT-then-UPDATE with no row lock,
--      leaving a TOCTOU window: two concurrent same-user requests could both
--      pass the availability check and both deduct, over-spending credits.
--   2) CreditService.refundCredits inserts transaction_type = 'refund', but the
--      credit_transactions CHECK constraint only allowed
--      ('earn','spend','refresh','bonus'), so every refund audit row was rejected.

-- 1) Make consume_credits race-safe via a single guarded UPDATE.
CREATE OR REPLACE FUNCTION consume_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_service VARCHAR(50),
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_daily_credits INTEGER;
    v_used_today INTEGER;
    v_last_refresh TIMESTAMP WITH TIME ZONE;
    v_rows INTEGER;
BEGIN
    SELECT daily_credits, credits_used_today, last_credit_refresh
    INTO v_daily_credits, v_used_today, v_last_refresh
    FROM user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF DATE(v_last_refresh AT TIME ZONE 'Asia/Manila') < CURRENT_DATE THEN
        UPDATE user_profiles
        SET credits_used_today = 0,
            last_credit_refresh = NOW()
        WHERE id = p_user_id;
        v_used_today := 0;
    END IF;

    UPDATE user_profiles
    SET credits_used_today = credits_used_today + p_amount,
        updated_at = NOW()
    WHERE id = p_user_id
      AND (daily_credits - credits_used_today) >= p_amount;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        RETURN FALSE;
    END IF;

    SELECT credits_used_today INTO v_used_today
    FROM user_profiles
    WHERE id = p_user_id;

    INSERT INTO credit_transactions (
        user_id,
        transaction_type,
        amount,
        service_used,
        description,
        balance_after
    ) VALUES (
        p_user_id,
        'spend',
        -p_amount,
        p_service,
        p_description,
        GREATEST(0, v_daily_credits - v_used_today)
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 2) Allow 'refund' as a valid credit transaction type.
ALTER TABLE credit_transactions
    DROP CONSTRAINT IF EXISTS valid_transaction_type;

ALTER TABLE credit_transactions
    ADD CONSTRAINT valid_transaction_type
    CHECK (transaction_type IN ('earn', 'spend', 'refresh', 'bonus', 'refund'));
