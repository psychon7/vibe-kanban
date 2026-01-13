-- Add avatar_url column to users table for storing R2 file storage avatar URLs
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create an index for faster lookups when avatar_url is not null
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users (avatar_url) WHERE avatar_url IS NOT NULL;
