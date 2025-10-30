-- Adds profile fields to the public.users table for location and bio support
-- Run via Supabase migrations

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS location VARCHAR(200);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Trigger to keep updated_at fresh on row updates
CREATE OR REPLACE FUNCTION public.set_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_users_updated_at();

-- Documentation
COMMENT ON COLUMN public.users.location IS 'User location (e.g., city, country)';
COMMENT ON COLUMN public.users.bio IS 'User biography/description';
COMMENT ON COLUMN public.users.updated_at IS 'Timestamp of last profile update';
