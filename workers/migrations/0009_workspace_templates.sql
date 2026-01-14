-- Migration: Workspace Templates
-- Description: Add workspace templates for quick project setup

CREATE TABLE IF NOT EXISTS workspace_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  creator_id TEXT NOT NULL,
  workspace_team_id TEXT,
  is_public INTEGER DEFAULT 0,
  config TEXT NOT NULL, -- JSON configuration
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wst_creator ON workspace_templates(creator_id);
CREATE INDEX IF NOT EXISTS idx_wst_public ON workspace_templates(is_public);
