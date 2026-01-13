-- ============================================================================
-- Development Seed Data
-- Run with: pnpm run d1:seed (local) or pnpm run d1:seed:prod (production)
-- ============================================================================

-- ============================================================================
-- Sample Users for Development
-- ============================================================================
INSERT OR IGNORE INTO users (id, email, name, avatar_url, cf_access_id) VALUES
    ('user-dev-owner', 'owner@example.com', 'Dev Owner', NULL, 'cf-access-owner'),
    ('user-dev-admin', 'admin@example.com', 'Dev Admin', NULL, 'cf-access-admin'),
    ('user-dev-member', 'member@example.com', 'Dev Member', NULL, 'cf-access-member'),
    ('user-dev-viewer', 'viewer@example.com', 'Dev Viewer', NULL, 'cf-access-viewer');

-- ============================================================================
-- Sample Team Workspace
-- ============================================================================
INSERT OR IGNORE INTO workspaces_team (id, name, slug, created_by) VALUES
    ('team-dev', 'Development Team', 'dev-team', 'user-dev-owner');

-- ============================================================================
-- Sample Workspace Members
-- ============================================================================
INSERT OR IGNORE INTO workspace_members (workspace_team_id, user_id, role_id, status) VALUES
    ('team-dev', 'user-dev-owner', 'role-owner', 'active'),
    ('team-dev', 'user-dev-admin', 'role-admin', 'active'),
    ('team-dev', 'user-dev-member', 'role-member', 'active'),
    ('team-dev', 'user-dev-viewer', 'role-viewer', 'active');

-- ============================================================================
-- Sample Prompt Enhancement Settings
-- ============================================================================
INSERT OR IGNORE INTO prompt_enhancement_settings (
    workspace_team_id, 
    auto_enhance_enabled, 
    preferred_model, 
    enhancement_style,
    include_codebase_context,
    include_git_history
) VALUES (
    'team-dev',
    1,
    'gpt-4-turbo',
    'balanced',
    1,
    0
);

-- ============================================================================
-- Sample Audit Log Entry
-- ============================================================================
INSERT OR IGNORE INTO audit_log (id, workspace_team_id, actor_user_id, entity_type, entity_id, action, payload_json) VALUES
    ('audit-seed-1', 'team-dev', 'user-dev-owner', 'workspace', 'team-dev', 'created', '{"name": "Development Team"}');
