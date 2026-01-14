-- Migration: GitHub Integration
-- Stores GitHub OAuth connections and connected repositories

CREATE TABLE github_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  github_user_id TEXT NOT NULL,
  github_username TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TEXT,
  scopes TEXT, -- JSON array of granted scopes
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, github_user_id)
);

CREATE INDEX idx_github_conn_user ON github_connections(user_id);

-- Connected Repositories (linked to workspaces)
CREATE TABLE connected_repositories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_connection_id TEXT REFERENCES github_connections(id) ON DELETE SET NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_private BOOLEAN DEFAULT FALSE,
  webhook_id TEXT,
  webhook_secret TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, repo_owner, repo_name)
);

CREATE INDEX idx_conn_repos_workspace ON connected_repositories(workspace_id);
CREATE INDEX idx_conn_repos_github ON connected_repositories(github_connection_id);

-- Local Relay Connections (for connecting local vibe-kanban instances)
CREATE TABLE relay_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_token_hash TEXT NOT NULL,
  machine_name TEXT,
  machine_info TEXT, -- JSON with OS, version, etc.
  last_heartbeat TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected', -- connected, disconnected
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relay_conn_user ON relay_connections(user_id);
CREATE INDEX idx_relay_conn_status ON relay_connections(status);
