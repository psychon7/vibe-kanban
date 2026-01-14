-- Seed default admin user for development/testing
-- This migration is safe to run multiple times (uses INSERT OR REPLACE)
-- Credentials: admin@vibe-kanban.dev / Admin123

-- Insert test admin user (password is PBKDF2 hash of 'Admin123')
INSERT OR REPLACE INTO users (id, email, password_hash, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@vibe-kanban.dev',
  'e3roxpGbZEg4TA7Velhs0w==:Cy3SvJt+X/qVCuKVHxD6G1qwkeEVToOEtyi+4wZFubg=',
  'Test Admin',
  datetime('now'),
  datetime('now')
);

-- Create default workspace for admin user
INSERT OR IGNORE INTO workspaces_team (id, name, slug, created_by, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Workspace',
  'default',
  '00000000-0000-0000-0000-000000000001',
  datetime('now'),
  datetime('now')
);

-- Create Owner role for the workspace
INSERT OR IGNORE INTO roles (id, workspace_team_id, name, is_default, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Owner',
  1,
  datetime('now')
);

-- Add admin user to workspace with owner role
INSERT OR IGNORE INTO workspace_members (workspace_team_id, user_id, role_id, joined_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  datetime('now')
);
