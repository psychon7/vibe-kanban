-- ============================================================================
-- Initial Schema Migration for Vibe Kanban Team RBAC
-- Created: 2026-01-13
-- Database: Cloudflare D1 (SQLite)
-- ============================================================================

-- ============================================================================
-- Users Table (synced from Cloudflare Access)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    cf_access_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_cf_access_id ON users(cf_access_id);

-- ============================================================================
-- Team Workspaces (separate from git worktrees)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces_team (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_team_slug ON workspaces_team(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_team_created_by ON workspaces_team(created_by);

-- ============================================================================
-- Roles (Owner, Admin, Member, Viewer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('Owner', 'Admin', 'Member', 'Viewer')),
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_roles_workspace_team ON roles(workspace_team_id);

-- ============================================================================
-- Permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT
);

-- ============================================================================
-- Role-Permission Mapping
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================
-- Workspace Members
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_team_id TEXT NOT NULL REFERENCES workspaces_team(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workspace_team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role_id);

-- ============================================================================
-- Workspace Invitations
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT NOT NULL REFERENCES workspaces_team(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES roles(id),
    invited_by TEXT NOT NULL REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    accepted_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_team_id);

-- ============================================================================
-- Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE SET NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_workspace_team ON audit_log(workspace_team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);

-- ============================================================================
-- Task ACL for Restricted Visibility
-- ============================================================================
CREATE TABLE IF NOT EXISTS task_acl (
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('view', 'comment', 'run', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_acl_user ON task_acl(user_id);

-- ============================================================================
-- Prompt Enhancements
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_enhancements (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL,
    original_prompt TEXT NOT NULL,
    enhanced_prompt TEXT NOT NULL,
    enhancement_model TEXT NOT NULL,
    techniques_applied TEXT NOT NULL,
    original_score INTEGER,
    enhanced_score INTEGER,
    user_accepted INTEGER,
    user_edited INTEGER,
    final_prompt TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_enhancements_task ON prompt_enhancements(task_id);

-- ============================================================================
-- Prompt Templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    template_text TEXT NOT NULL,
    category TEXT CHECK (category IN ('bug-fix', 'feature', 'refactor', 'docs', 'test', 'other')),
    is_global INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_workspace ON prompt_templates(workspace_team_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_global ON prompt_templates(is_global);

-- ============================================================================
-- Prompt Enhancement Settings (per workspace)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prompt_enhancement_settings (
    workspace_team_id TEXT PRIMARY KEY REFERENCES workspaces_team(id) ON DELETE CASCADE,
    auto_enhance_enabled INTEGER NOT NULL DEFAULT 0,
    preferred_model TEXT NOT NULL DEFAULT 'gpt-4-turbo',
    enhancement_style TEXT NOT NULL DEFAULT 'balanced'
        CHECK (enhancement_style IN ('minimal', 'balanced', 'comprehensive')),
    include_codebase_context INTEGER NOT NULL DEFAULT 1,
    include_git_history INTEGER NOT NULL DEFAULT 0,
    custom_instructions TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- User Sessions (for rate limiting and session management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cf_access_token_hash TEXT,
    ip_address TEXT,
    user_agent TEXT,
    last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ============================================================================
-- Rate Limits Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
