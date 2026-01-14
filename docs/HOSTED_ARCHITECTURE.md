# Vibe Kanban - Hosted Architecture

## Executive Summary

This document outlines the architecture for running Vibe Kanban as a hosted cloud service on Cloudflare's edge platform. The key challenge is adapting the local agent orchestration system (which spawns CLI processes) to work in a serverless environment.

## Architecture Decision: Hybrid Approach

After analyzing the options, we recommend a **hybrid approach** combining:
1. **API-based agents** for cloud-native execution (Claude API, OpenAI API)
2. **GitHub API** for git operations (no local git needed)
3. **Local relay** option for users who prefer local execution
4. **External environments** (Codespaces/Gitpod) for full CLI agent support

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOSTED VIBE KANBAN                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────────────────────────────────┐   │
│  │   Frontend  │────▶│         Cloudflare Workers API          │   │
│  │   (Pages)   │◀────│  ┌─────────┐ ┌────┐ ┌────┐ ┌─────────┐  │   │
│  └─────────────┘     │  │   D1    │ │ KV │ │ R2 │ │ Workers │  │   │
│                      │  │(SQLite) │ │    │ │    │ │   AI    │  │   │
│                      │  └─────────┘ └────┘ └────┘ └─────────┘  │   │
│                      └──────────────────┬──────────────────────┘   │
│                                         │                          │
│         ┌───────────────────────────────┼───────────────────────┐  │
│         │                               │                       │  │
│         ▼                               ▼                       ▼  │
│  ┌─────────────┐              ┌─────────────────┐      ┌──────────┐│
│  │  GitHub API │              │  LLM APIs       │      │  Local   ││
│  │  - Repos    │              │  - Claude API   │      │  Relay   ││
│  │  - Branches │              │  - OpenAI API   │      │  (WS)    ││
│  │  - PRs      │              │  - Gemini API   │      └────┬─────┘│
│  └─────────────┘              └─────────────────┘           │      │
│                                                             │      │
│                                                     ┌───────▼─────┐│
│                                                     │ Local Vibe  ││
│                                                     │   Kanban    ││
│                                                     └─────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend (Cloudflare Pages)

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Auth      │  │  Workspace  │  │    Project/Task     │  │
│  │   Pages     │  │  Management │  │    Management       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Kanban    │  │  Session    │  │    Execution        │  │
│  │   Board     │  │  Viewer     │  │    Logs             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Settings  │  │   GitHub    │  │    Agent            │  │
│  │   Pages     │  │   Connect   │  │    Selector         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Backend (Cloudflare Workers)

```
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Workers (Hono)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Routes:                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ /api/v1/auth/*        - Authentication              │   │
│  │ /api/v1/workspaces/*  - Workspace CRUD              │   │
│  │ /api/v1/projects/*    - Project CRUD                │   │
│  │ /api/v1/tasks/*       - Task CRUD                   │   │
│  │ /api/v1/sessions/*    - Workspace Sessions (NEW)    │   │
│  │ /api/v1/github/*      - GitHub Integration (NEW)    │   │
│  │ /api/v1/agents/*      - Agent Execution (NEW)       │   │
│  │ /api/v1/mcp/*         - MCP Server API (NEW)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Services:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AuthService      - JWT, sessions, RBAC              │   │
│  │ GitHubService    - GitHub API integration           │   │
│  │ AgentService     - LLM API orchestration            │   │
│  │ ExecutionService - Manage agent executions          │   │
│  │ StreamService    - SSE/WebSocket streaming          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Data Layer

```
┌─────────────────────────────────────────────────────────────┐
│                       Data Storage                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  D1 (SQLite) - Persistent Data                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ users, workspaces, workspace_members                │   │
│  │ projects, tasks, task_acl                           │   │
│  │ workspace_sessions, execution_processes (NEW)       │   │
│  │ github_connections, connected_repos (NEW)           │   │
│  │ prompt_templates, prompt_settings                   │   │
│  │ audit_logs, subscriptions, usage_records (NEW)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  KV - Fast Access / Session State                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ session:{token} - Auth sessions                     │   │
│  │ exec:{id}:status - Execution status                 │   │
│  │ exec:{id}:logs - Recent logs (buffer)               │   │
│  │ relay:{user_id} - Local relay connection            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  R2 - Object Storage                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ logs/{session_id}/*.log - Execution logs            │   │
│  │ artifacts/{session_id}/* - Generated files          │   │
│  │ uploads/{workspace_id}/* - User uploads             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Agent Execution Models

### Model A: API-Based Agents (Primary)

For cloud-native execution without external dependencies:

```
┌──────────────────────────────────────────────────────────────────┐
│                    API-Based Agent Execution                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Request                                                    │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ Workers API │───▶│ AgentService │───▶│ Claude/OpenAI API   │ │
│  └─────────────┘    └──────────────┘    └─────────────────────┘ │
│       │                    │                      │              │
│       │                    │                      ▼              │
│       │                    │            ┌─────────────────────┐ │
│       │                    │            │   Tool Execution    │ │
│       │                    │            │   - read_file       │ │
│       │                    │            │   - write_file      │ │
│       │                    │            │   - search_code     │ │
│       │                    │            │   - create_branch   │ │
│       │                    │            └──────────┬──────────┘ │
│       │                    │                       │             │
│       │                    │                       ▼             │
│       │                    │            ┌─────────────────────┐ │
│       │                    │            │    GitHub API       │ │
│       │                    │            │    (via Octokit)    │ │
│       │                    │            └─────────────────────┘ │
│       │                    │                                     │
│       ▼                    ▼                                     │
│  ┌─────────────┐    ┌──────────────┐                            │
│  │    SSE      │◀───│  Log Stream  │                            │
│  │   Stream    │    │   Buffer     │                            │
│  └─────────────┘    └──────────────┘                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Supported Agents:**
| Agent | API | Tool Use |
|-------|-----|----------|
| Claude | Anthropic API | ✅ Native |
| GPT-4 | OpenAI API | ✅ Function Calling |
| Gemini | Google AI API | ✅ Function Calling |
| Codex | OpenAI API | ⚠️ Limited |

**Tools Available:**
```typescript
const HOSTED_TOOLS = [
  // File Operations (via GitHub API)
  { name: 'read_file', description: 'Read file from repository' },
  { name: 'write_file', description: 'Write/update file in repository' },
  { name: 'delete_file', description: 'Delete file from repository' },
  { name: 'list_files', description: 'List files in directory' },
  
  // Git Operations (via GitHub API)
  { name: 'create_branch', description: 'Create new branch' },
  { name: 'commit_changes', description: 'Commit staged changes' },
  { name: 'get_diff', description: 'Get diff between branches' },
  { name: 'create_pr', description: 'Create pull request' },
  
  // Search (via GitHub API + Workers AI)
  { name: 'search_code', description: 'Search code in repository' },
  { name: 'search_files', description: 'Search for files by name' },
  
  // CI/CD (via GitHub Actions API)
  { name: 'run_workflow', description: 'Trigger GitHub Actions workflow' },
  { name: 'get_workflow_status', description: 'Check workflow status' },
];
```

### Model B: Local Relay (Optional)

For users who prefer local execution:

```
┌──────────────────────────────────────────────────────────────────┐
│                      Local Relay Architecture                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐                           ┌─────────────────┐  │
│  │   Browser   │                           │  Local Machine  │  │
│  │  Dashboard  │                           │                 │  │
│  └──────┬──────┘                           │  ┌───────────┐  │  │
│         │                                  │  │   Vibe    │  │  │
│         ▼                                  │  │  Kanban   │  │  │
│  ┌─────────────┐     WebSocket            │  │  (local)  │  │  │
│  │  Workers    │◀─────────────────────────▶│  └─────┬─────┘  │  │
│  │    API      │     Relay                 │        │        │  │
│  └─────────────┘                           │        ▼        │  │
│         │                                  │  ┌───────────┐  │  │
│         │                                  │  │  Claude   │  │  │
│         │                                  │  │   Code    │  │  │
│         │                                  │  │ (or other)│  │  │
│         │                                  │  └───────────┘  │  │
│         │                                  │                 │  │
│         ▼                                  └─────────────────┘  │
│  ┌─────────────┐                                                │
│  │    D1       │  Sync tasks/status                             │
│  │  Database   │                                                │
│  └─────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**How it works:**
1. User generates connection token from web dashboard
2. Local vibe-kanban connects via: `vibe-kanban connect --token <token>`
3. WebSocket relay through Cloudflare Durable Objects
4. Commands sent from web, executed locally
5. Logs/status streamed back to web

### Model C: External Environments (Advanced)

For full CLI agent support:

```
┌──────────────────────────────────────────────────────────────────┐
│                External Environment Execution                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ Workers API │───▶│ Environment  │───▶│  GitHub Codespaces  │ │
│  └─────────────┘    │  Orchestrator│    │  - or -             │ │
│                     └──────────────┘    │  Gitpod             │ │
│                            │            │  - or -             │ │
│                            │            │  Replit             │ │
│                            │            └──────────┬──────────┘ │
│                            │                       │             │
│                            │                       ▼             │
│                            │            ┌─────────────────────┐ │
│                            │            │   Full CLI Agent    │ │
│                            │            │   - Claude Code     │ │
│                            │            │   - Cursor          │ │
│                            │            │   - Codex CLI       │ │
│                            │            └─────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│                     ┌──────────────┐                            │
│                     │   Cleanup    │  Auto-destroy after        │
│                     │   Service    │  execution completes       │
│                     └──────────────┘                            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Sequence Diagrams

### Task Execution Flow (API-Based)

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐
│Frontend│     │ Workers │     │  Agent   │     │  Claude  │     │ GitHub │
│        │     │   API   │     │ Service  │     │   API    │     │  API   │
└───┬────┘     └────┬────┘     └────┬─────┘     └────┬─────┘     └───┬────┘
    │               │               │               │               │
    │ Start Session │               │               │               │
    │──────────────▶│               │               │               │
    │               │               │               │               │
    │               │ Create Session│               │               │
    │               │──────────────▶│               │               │
    │               │               │               │               │
    │               │               │ Execute Agent │               │
    │               │               │──────────────▶│               │
    │               │               │               │               │
    │               │               │   Tool Call   │               │
    │               │               │◀──────────────│               │
    │               │               │               │               │
    │               │               │          read_file            │
    │               │               │──────────────────────────────▶│
    │               │               │               │               │
    │               │               │          file content         │
    │               │               │◀──────────────────────────────│
    │               │               │               │               │
    │               │               │  Tool Result  │               │
    │               │               │──────────────▶│               │
    │               │               │               │               │
    │    SSE: Log   │               │               │               │
    │◀──────────────│◀──────────────│               │               │
    │               │               │               │               │
    │               │               │   Tool Call   │               │
    │               │               │◀──────────────│               │
    │               │               │               │               │
    │               │               │         write_file            │
    │               │               │──────────────────────────────▶│
    │               │               │               │               │
    │    SSE: Log   │               │               │               │
    │◀──────────────│◀──────────────│               │               │
    │               │               │               │               │
    │               │               │  Completion   │               │
    │               │               │◀──────────────│               │
    │               │               │               │               │
    │  SSE: Done    │               │               │               │
    │◀──────────────│◀──────────────│               │               │
    │               │               │               │               │
```

### GitHub OAuth Flow

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│Frontend│     │ Workers │     │  GitHub  │     │    D1    │
│        │     │   API   │     │  OAuth   │     │ Database │
└───┬────┘     └────┬────┘     └────┬─────┘     └────┬─────┘
    │               │               │               │
    │ Connect GitHub│               │               │
    │──────────────▶│               │               │
    │               │               │               │
    │  Redirect URL │               │               │
    │◀──────────────│               │               │
    │               │               │               │
    │ Redirect to GitHub            │               │
    │──────────────────────────────▶│               │
    │               │               │               │
    │ User Authorizes               │               │
    │◀──────────────────────────────│               │
    │               │               │               │
    │ Callback with code            │               │
    │──────────────▶│               │               │
    │               │               │               │
    │               │ Exchange code │               │
    │               │──────────────▶│               │
    │               │               │               │
    │               │ Access token  │               │
    │               │◀──────────────│               │
    │               │               │               │
    │               │ Store encrypted token         │
    │               │──────────────────────────────▶│
    │               │               │               │
    │   Success     │               │               │
    │◀──────────────│               │               │
    │               │               │               │
```

## Database Schema (New Tables)

```sql
-- Workspace Sessions (agent execution context)
CREATE TABLE workspace_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  executor TEXT NOT NULL, -- CLAUDE_API, OPENAI_API, LOCAL_RELAY, CODESPACES
  branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  execution_mode TEXT NOT NULL DEFAULT 'api', -- api, relay, external
  agent_working_dir TEXT,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Execution Processes (individual runs within a session)
CREATE TABLE execution_processes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workspace_sessions(id) ON DELETE CASCADE,
  run_reason TEXT NOT NULL, -- codingagent, setupscript, review
  status TEXT NOT NULL DEFAULT 'pending',
  exit_code INTEGER,
  token_usage INTEGER,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- GitHub Connections (OAuth tokens)
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

-- Connected Repositories
CREATE TABLE connected_repositories (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  github_connection_id TEXT REFERENCES github_connections(id) ON DELETE SET NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT GENERATED ALWAYS AS (repo_owner || '/' || repo_name) STORED,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_private BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, repo_owner, repo_name)
);

-- Local Relay Connections
CREATE TABLE relay_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_token_hash TEXT NOT NULL,
  machine_name TEXT,
  last_heartbeat TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## API Contracts

### Session Management

```typescript
// POST /api/v1/sessions
interface CreateSessionRequest {
  task_id: string;
  executor: 'CLAUDE_API' | 'OPENAI_API' | 'GEMINI_API' | 'LOCAL_RELAY' | 'CODESPACES';
  repo_id: string;
  branch?: string; // Auto-generated if not provided
}

interface CreateSessionResponse {
  session: WorkspaceSession;
  branch: string;
}

// GET /api/v1/sessions/:id/stream
// Returns SSE stream
interface SessionStreamEvent {
  type: 'status' | 'log' | 'tool_call' | 'tool_result' | 'error' | 'complete';
  data: any;
  timestamp: string;
}

// POST /api/v1/sessions/:id/stop
interface StopSessionResponse {
  session: WorkspaceSession;
  stopped_at: string;
}
```

### GitHub Integration

```typescript
// POST /api/v1/github/connect
interface ConnectGitHubResponse {
  redirect_url: string;
}

// GET /api/v1/github/repos
interface ListReposResponse {
  repos: GitHubRepo[];
}

// POST /api/v1/github/repos/:repoId/connect
interface ConnectRepoRequest {
  workspace_id: string;
}
```

### Agent Execution

```typescript
// POST /api/v1/agents/execute
interface ExecuteAgentRequest {
  session_id: string;
  prompt: string;
  context?: {
    files?: string[]; // Files to include in context
    max_tokens?: number;
  };
}

interface ExecuteAgentResponse {
  execution_id: string;
  stream_url: string; // SSE endpoint
}
```

## Security Considerations

### Token Encryption
- GitHub tokens encrypted at rest using AES-256-GCM
- Encryption key stored in Cloudflare secrets
- Tokens never logged or exposed in responses

### Rate Limiting
- Per-user rate limits on API calls
- Per-workspace limits on agent executions
- Token usage tracking for billing

### RBAC Integration
- Session creation requires `task.execute` permission
- GitHub connection requires `workspace.settings` permission
- Audit logging for all sensitive operations

## Migration Path

### From Local to Hosted

1. **Data Export**: Export projects/tasks from local SQLite
2. **Import**: Import via API to hosted workspace
3. **GitHub Reconnect**: Re-authorize GitHub in hosted version
4. **Optional Relay**: Connect local instance for hybrid mode

### Gradual Rollout

| Phase | Features | Timeline |
|-------|----------|----------|
| 1 | Basic UI, Task Management | Done |
| 2 | API-based Agent Execution | Week 1-2 |
| 3 | GitHub Integration | Week 2-3 |
| 4 | Local Relay | Week 3-4 |
| 5 | External Environments | Week 4-5 |
| 6 | Billing & Templates | Week 5-6 |

## Cost Analysis

### Cloudflare Services
| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Workers | 100K req/day | $5/10M req |
| D1 | 5M rows read/day | $0.001/M reads |
| KV | 100K reads/day | $0.50/M reads |
| R2 | 10GB storage | $0.015/GB |
| Pages | Unlimited | Free |

### External APIs
| API | Cost |
|-----|------|
| Claude API | ~$3/M input, $15/M output |
| OpenAI GPT-4 | ~$30/M input, $60/M output |
| GitHub API | Free (with rate limits) |
| Codespaces | $0.18/hour (2-core) |

## Conclusion

The hybrid architecture provides flexibility for different use cases:
- **Quick tasks**: API-based agents (fastest, no setup)
- **Complex projects**: Local relay (full CLI agent power)
- **Team collaboration**: Hosted dashboard with any execution mode
- **Enterprise**: External environments for isolation

This approach preserves the core vibe-kanban functionality while adapting to cloud constraints.
