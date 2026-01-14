-- Migration: Workspace Sessions
-- Stores agent execution sessions for tasks

CREATE TABLE workspace_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  executor TEXT NOT NULL, -- CLAUDE_API, OPENAI_API, GEMINI_API, LOCAL_RELAY, CODESPACES
  execution_mode TEXT NOT NULL DEFAULT 'api', -- api, relay, external
  branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  agent_working_dir TEXT,
  error_message TEXT,
  token_usage INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ws_sessions_task ON workspace_sessions(task_id);
CREATE INDEX idx_ws_sessions_workspace ON workspace_sessions(workspace_id);
CREATE INDEX idx_ws_sessions_status ON workspace_sessions(status);

-- Execution Processes (individual runs within a session)
CREATE TABLE execution_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  run_reason TEXT NOT NULL, -- codingagent, setupscript, review, followup
  executor_action TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, killed
  exit_code INTEGER,
  token_usage INTEGER DEFAULT 0,
  dropped BOOLEAN DEFAULT FALSE,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exec_proc_session ON execution_processes(session_id);
CREATE INDEX idx_exec_proc_status ON execution_processes(status);
