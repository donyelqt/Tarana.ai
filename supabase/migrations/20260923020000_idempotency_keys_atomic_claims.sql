-- Migration: make idempotency claims concurrency-safe
-- Date: 2026-09-23
--
-- WHY:
--   The original idempotency table stored only completed responses. A
--   check-then-mutate-then-record flow allowed two concurrent requests with
--   the same key to both observe a miss and run the mutation twice.
--
--   This follow-up keeps the existing table and adds the state needed for an
--   atomic claim: status 0 means claimed/in-progress, while completed rows
--   retain their HTTP status. response_body is nullable while a claim is
--   in progress and is populated when the response is cached. request_hash
--   binds each key to the exact validated payload so reuse with a different
--   body fails loudly instead of replaying the wrong response.

ALTER TABLE public.idempotency_keys
    ADD COLUMN IF NOT EXISTS request_hash text;

ALTER TABLE public.idempotency_keys
    ALTER COLUMN response_body DROP NOT NULL;

-- The claim path turns duplicate inserts into code 23505, so re-assert the
-- unique scope here: the RLS follow-up proved an applied table can diverge
-- from its repo definition.
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_user_route_key
    ON public.idempotency_keys (user_id, route, idempotency_key);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'idempotency_keys_status_check'
          AND conrelid = 'public.idempotency_keys'::regclass
    ) THEN
        ALTER TABLE public.idempotency_keys
            ADD CONSTRAINT idempotency_keys_status_check
            CHECK (status = 0 OR status BETWEEN 100 AND 599);
    END IF;
END
$$;

COMMENT ON COLUMN public.idempotency_keys.status IS
    '0 = claimed and in progress; 100-599 = cached HTTP response status';
COMMENT ON COLUMN public.idempotency_keys.response_body IS
    'NULL while the claim is in progress; cached JSON response after completion';
COMMENT ON COLUMN public.idempotency_keys.request_hash IS
    'SHA-256 of the validated request payload; NULL on rows stored before hashing';
