-- Apply password reset token migration manually
-- Run this in your Supabase SQL editor or local database

-- Add password reset token fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token TEXT,
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;

-- Create index for faster reset token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.reset_token IS 'Secure token for password reset functionality';
COMMENT ON COLUMN users.reset_token_expiry IS 'Expiration timestamp for reset token';

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('reset_token', 'reset_token_expiry');
