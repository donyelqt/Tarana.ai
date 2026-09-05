-- Adds ToS consent timestamp to public.users for server-side register
-- enforcement and the post-login OAuth consent gate.
-- NULL means the user has not accepted the Terms of Service and Privacy Policy.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.tos_accepted_at IS 'Timestamp when the user accepted the Terms of Service and Privacy Policy (NULL = not accepted)';
