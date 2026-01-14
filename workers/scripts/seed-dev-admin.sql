-- ============================================================================
-- Seed: Development Test Admin User
-- Run ONLY in development/staging environments
-- ============================================================================
-- 
-- This creates a test admin user for QA/development purposes
-- 
-- Credentials:
--   Email: admin@vibe-kanban.dev
--   Password: admin123
--
-- The password hash below was generated using PBKDF2 with:
--   - 100,000 iterations
--   - SHA-256
--   - 16-byte salt
--   - 32-byte key
--
-- Format: base64(salt):base64(hash)
-- Pre-computed hash for "admin123": see INSERT below
-- ============================================================================

-- Insert test admin user (if not exists)
INSERT OR IGNORE INTO users (id, email, name, password_hash, created_at, updated_at)
VALUES (
    'test-admin-00000-0000-0000-000000000001',
    'admin@vibe-kanban.dev',
    'Test Admin',
    -- This hash will be set by the seed script runner
    NULL,
    datetime('now'),
    datetime('now')
);

-- Create a default test workspace
INSERT OR IGNORE INTO workspaces_team (id, name, slug, created_by, created_at, updated_at)
VALUES (
    'test-workspace-0000-0000-000000000001',
    'Test Workspace',
    'test-workspace',
    'test-admin-00000-0000-0000-000000000001',
    datetime('now'),
    datetime('now')
);

-- Add admin as Owner of the test workspace
INSERT OR IGNORE INTO workspace_members (workspace_team_id, user_id, role_id, status, joined_at)
VALUES (
    'test-workspace-0000-0000-000000000001',
    'test-admin-00000-0000-0000-000000000001',
    'role-owner',
    'active',
    datetime('now')
);

-- Create a sample project in the test workspace
INSERT OR IGNORE INTO projects (id, workspace_team_id, name, description, status, created_by, created_at, updated_at)
VALUES (
    'test-project-0000-0000-0000-000000000001',
    'test-workspace-0000-0000-000000000001',
    'Sample Project',
    'A sample project for testing',
    'active',
    'test-admin-00000-0000-0000-000000000001',
    datetime('now'),
    datetime('now')
);
