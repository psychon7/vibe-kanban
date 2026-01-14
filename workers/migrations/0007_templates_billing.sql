-- Migration: Templates and Billing
-- Workspace templates, subscriptions, and usage tracking

-- Workspace Templates
CREATE TABLE workspace_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  source_workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  config TEXT NOT NULL, -- JSON configuration
  tags TEXT, -- JSON array of tags
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_creator ON workspace_templates(creator_id);
CREATE INDEX idx_templates_public ON workspace_templates(is_public);
CREATE INDEX idx_templates_featured ON workspace_templates(is_featured);

-- Subscriptions (billing plans)
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free', -- free, pro, team, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, cancelled, past_due, trialing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at TEXT,
  cancelled_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id)
);

CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- Usage Records (for metered billing)
CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- execution, token, storage, api_call
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost REAL, -- Cost per unit if applicable
  metadata TEXT, -- JSON with additional details
  session_id TEXT REFERENCES workspace_sessions(id) ON DELETE SET NULL,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usage_workspace ON usage_records(workspace_id);
CREATE INDEX idx_usage_type ON usage_records(type);
CREATE INDEX idx_usage_recorded ON usage_records(recorded_at);

-- Plan limits (configurable per plan)
CREATE TABLE plan_limits (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL UNIQUE, -- free, pro, team, enterprise
  max_projects INTEGER DEFAULT 3,
  max_executions_per_month INTEGER DEFAULT 100,
  max_team_members INTEGER DEFAULT 1,
  max_storage_mb INTEGER DEFAULT 100,
  features TEXT, -- JSON array of enabled features
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plan limits
INSERT INTO plan_limits (id, plan, max_projects, max_executions_per_month, max_team_members, max_storage_mb, features) VALUES
  ('plan_free', 'free', 3, 100, 1, 100, '["basic_agents"]'),
  ('plan_pro', 'pro', -1, 1000, 5, 1000, '["basic_agents","advanced_agents","custom_prompts","priority_support"]'),
  ('plan_team', 'team', -1, 5000, -1, 10000, '["basic_agents","advanced_agents","custom_prompts","priority_support","rbac","audit_log","sso"]'),
  ('plan_enterprise', 'enterprise', -1, -1, -1, -1, '["basic_agents","advanced_agents","custom_prompts","priority_support","rbac","audit_log","sso","self_hosted","dedicated_support"]');
