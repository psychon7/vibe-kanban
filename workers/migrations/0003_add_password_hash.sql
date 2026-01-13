-- Migration: Add password_hash column to users table
-- This enables email/password authentication

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Index for faster email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email_password ON users(email) WHERE password_hash IS NOT NULL;
