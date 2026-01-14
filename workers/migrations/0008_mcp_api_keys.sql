-- Migration: MCP API Keys
-- API keys for external MCP server access

CREATE TABLE mcp_api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for identification
  key_hash TEXT NOT NULL, -- SHA-256 hash of full key
  permissions TEXT NOT NULL DEFAULT '["read"]', -- JSON array: read, write, execute
  last_used_at TEXT,
  usage_count INTEGER DEFAULT 0,
  rate_limit INTEGER DEFAULT 100, -- Requests per minute
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_mcp_keys_workspace ON mcp_api_keys(workspace_id);
CREATE INDEX idx_mcp_keys_prefix ON mcp_api_keys(key_prefix);

-- MCP API request logs (for auditing and rate limiting)
CREATE TABLE mcp_api_logs (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL REFERENCES mcp_api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcp_logs_key ON mcp_api_logs(api_key_id);
CREATE INDEX idx_mcp_logs_created ON mcp_api_logs(created_at);
