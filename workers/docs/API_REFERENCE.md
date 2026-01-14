# API Documentation

## Overview

The Vibe Kanban API is a RESTful API built on Cloudflare Workers. All endpoints return JSON responses and require authentication unless otherwise noted.

**Base URL**: `https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev`

## Authentication

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Register
```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### Using Authentication
Include the JWT token in the Authorization header:
```http
Authorization: Bearer <token>
```

---

## Workspaces API

### List Workspaces
```http
GET /api/v1/workspaces
Authorization: Bearer <token>
```

### Create Workspace
```http
POST /api/v1/workspaces
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Workspace",
  "slug": "my-workspace"
}
```

### Get Workspace
```http
GET /api/v1/workspaces/:id
Authorization: Bearer <token>
```

### Update Workspace
```http
PATCH /api/v1/workspaces/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Workspace
```http
DELETE /api/v1/workspaces/:id
Authorization: Bearer <token>
```

### Workspace Members

#### List Members
```http
GET /api/v1/workspaces/:id/members
Authorization: Bearer <token>
```

#### Add Member
```http
POST /api/v1/workspaces/:id/members
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "role": "member"  // owner, admin, member, viewer
}
```

#### Update Member Role
```http
PATCH /api/v1/workspaces/:id/members/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "admin"
}
```

#### Remove Member
```http
DELETE /api/v1/workspaces/:id/members/:userId
Authorization: Bearer <token>
```

---

## Projects API

### List Projects
```http
GET /api/v1/projects?workspace_id=<workspace_id>
Authorization: Bearer <token>
```

### Create Project
```http
POST /api/v1/projects
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": "uuid",
  "name": "My Project",
  "description": "Project description"
}
```

### Get Project
```http
GET /api/v1/projects/:id
Authorization: Bearer <token>
```

### Update Project
```http
PATCH /api/v1/projects/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Project
```http
DELETE /api/v1/projects/:id
Authorization: Bearer <token>
```

---

## Tasks API

### List Tasks
```http
GET /api/v1/tasks?project_id=<project_id>&status=<status>
Authorization: Bearer <token>
```

Query Parameters:
- `project_id` (required): Project UUID
- `status` (optional): Filter by status (todo, inprogress, inreview, done, cancelled)
- `limit` (optional): Max results (default: 50)

### Create Task
```http
POST /api/v1/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "project_id": "uuid",
  "title": "Task Title",
  "description": "Task description",
  "status": "todo"
}
```

### Get Task
```http
GET /api/v1/tasks/:id
Authorization: Bearer <token>
```

### Update Task
```http
PATCH /api/v1/tasks/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "status": "inprogress"
}
```

### Delete Task
```http
DELETE /api/v1/tasks/:id
Authorization: Bearer <token>
```

---

## Sessions API (Agent Execution)

Sessions manage workspace/agent execution contexts for tasks.

### Create Session
```http
POST /api/v1/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "task_id": "uuid",
  "executor": "CLAUDE_API",  // or OPENAI_API, LOCAL_RELAY
  "execution_mode": "cloud", // or local
  "branch": "vibe/task-name-abc123"  // optional, auto-generated if not provided
}
```

**Response:**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "workspace_id": "uuid",
  "executor": "CLAUDE_API",
  "execution_mode": "cloud",
  "branch": "vibe/task-name-abc123",
  "status": "pending",
  "created_at": "2026-01-14T12:00:00Z"
}
```

### List Sessions
```http
GET /api/v1/sessions?task_id=<task_id>&workspace_id=<workspace_id>&status=<status>
Authorization: Bearer <token>
```

Query Parameters:
- `task_id` (optional): Filter by task
- `workspace_id` (optional): Filter by workspace
- `status` (optional): Filter by status (pending, running, completed, failed, cancelled)
- `limit` (optional): Max results (default: 50)

### Get Session
```http
GET /api/v1/sessions/:id
Authorization: Bearer <token>
```

Returns session details including execution processes.

### Update Session
```http
PATCH /api/v1/sessions/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "cancelled"
}
```

### Delete Session
```http
DELETE /api/v1/sessions/:id
Authorization: Bearer <token>
```

### Start Session
```http
POST /api/v1/sessions/:id/start
Authorization: Bearer <token>
```

Starts agent execution for the session.

### Stop Session
```http
POST /api/v1/sessions/:id/stop
Authorization: Bearer <token>
```

Stops running agent execution.

### Get Session Status (Real-time)
```http
GET /api/v1/sessions/:id/status
Authorization: Bearer <token>
```

Returns real-time status from KV cache.

---

## Agents API (AI Agent Execution)

### Execute Agent
```http
POST /api/v1/agents/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": "uuid",
  "agent_type": "CLAUDE_API",
  "task_description": "Implement the login feature",
  "context_files": ["src/auth.ts", "src/api/routes.ts"],
  "api_key": "sk-..."  // optional, uses platform key if not provided
}
```

**Response:**
```json
{
  "id": "execution-uuid",
  "session_id": "uuid",
  "status": "completed",
  "started_at": "2026-01-14T12:00:00Z",
  "completed_at": "2026-01-14T12:05:00Z",
  "summary": "Implemented login feature with JWT authentication",
  "files_changed": ["src/auth.ts", "src/api/login.ts"],
  "tokens_used": 12500,
  "cost_usd": 0.15
}
```

### Get Execution
```http
GET /api/v1/agents/executions/:id
Authorization: Bearer <token>
```

### Stop Execution
```http
DELETE /api/v1/agents/executions/:id
Authorization: Bearer <token>
```

### Stream Execution Events (SSE)
```http
GET /api/v1/agents/executions/:id/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

Events:
- `start` - Execution started
- `thinking` - Agent is processing
- `tool_call` - Agent called a tool
- `tool_result` - Tool returned result
- `message` - Agent message
- `file_change` - File was modified
- `error` - Error occurred
- `complete` - Execution finished

### List Agent Types
```http
GET /api/v1/agents/types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "agents": [
    {
      "type": "CLAUDE_API",
      "name": "Claude (Anthropic)",
      "description": "Advanced AI assistant with strong coding capabilities",
      "requires_api_key": true,
      "capabilities": ["code_generation", "code_review", "refactoring", "debugging"],
      "status": "available"
    }
  ]
}
```

### List Available Tools
```http
GET /api/v1/agents/tools
Authorization: Bearer <token>
```

---

## GitHub API

### Check Connection Status
```http
GET /api/v1/github/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "connected": true,
  "connection": {
    "id": "uuid",
    "github_user_id": "12345",
    "github_username": "username",
    "scopes": "repo read:user user:email",
    "connected_at": "2026-01-14T12:00:00Z"
  }
}
```

### Start OAuth Flow
```http
GET /api/v1/github/connect
Authorization: Bearer <token>
```

**Response:**
```json
{
  "authorization_url": "https://github.com/login/oauth/authorize?...",
  "state": "uuid"
}
```

### OAuth Callback
```http
GET /api/v1/github/callback?code=<code>&state=<state>
```

Redirects to frontend after successful connection.

### Disconnect GitHub
```http
DELETE /api/v1/github/disconnect
Authorization: Bearer <token>
```

### List Repositories
```http
GET /api/v1/github/repos?page=1&per_page=30
Authorization: Bearer <token>
```

**Response:**
```json
{
  "repositories": [
    {
      "id": 12345,
      "name": "repo-name",
      "full_name": "owner/repo-name",
      "private": false,
      "description": "Repository description",
      "default_branch": "main",
      "html_url": "https://github.com/owner/repo-name",
      "updated_at": "2026-01-14T12:00:00Z",
      "owner": "owner"
    }
  ],
  "page": 1,
  "per_page": 30
}
```

### Connect Repository to Workspace
```http
POST /api/v1/github/repos/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": "uuid",
  "repo_owner": "owner",
  "repo_name": "repo-name",
  "default_branch": "main"
}
```

### List Connected Repositories
```http
GET /api/v1/github/repos/connected?workspace_id=<workspace_id>
Authorization: Bearer <token>
```

### Disconnect Repository
```http
DELETE /api/v1/github/repos/:id
Authorization: Bearer <token>
```

### Create Branch
```http
POST /api/v1/github/branches
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": "uuid",
  "repo_owner": "owner",
  "repo_name": "repo-name",
  "branch_name": "vibe/feature-abc123",
  "base_branch": "main"
}
```

### Get Branch Info
```http
GET /api/v1/github/branches/:owner/:repo/:branch
Authorization: Bearer <token>
```

### Create Pull Request
```http
POST /api/v1/github/pull-requests
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": "uuid",
  "repo_owner": "owner",
  "repo_name": "repo-name",
  "title": "Implement feature X",
  "body": "Description of changes",
  "head": "vibe/feature-abc123",
  "base": "main",
  "draft": false
}
```

### Get Pull Request
```http
GET /api/v1/github/pull-requests/:owner/:repo/:number
Authorization: Bearer <token>
```

---

## Prompts API

### Enhance Prompt
```http
POST /api/v1/prompts/enhance
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "add login",
  "workspace_id": "uuid"
}
```

**Response:**
```json
{
  "enhanced_prompt": "Implement a secure user authentication system with JWT-based login. Include:\n- Email/password validation\n- Password hashing with bcrypt\n- JWT token generation and verification\n- Login/logout endpoints\n- Error handling for invalid credentials",
  "original_prompt": "add login",
  "tokens_used": 150
}
```

### List Templates
```http
GET /api/v1/prompts/templates?workspace_id=<workspace_id>
Authorization: Bearer <token>
```

### Create Template
```http
POST /api/v1/prompts/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "workspace_id": "uuid",
  "name": "Bug Fix Template",
  "content": "Fix the following bug: {{description}}\n\nSteps to reproduce:\n{{steps}}\n\nExpected behavior:\n{{expected}}",
  "is_default": false
}
```

---

## Audit API

### List Audit Logs
```http
GET /api/v1/audit?workspace_id=<workspace_id>&limit=50
Authorization: Bearer <token>
```

Query Parameters:
- `workspace_id` (required): Workspace UUID
- `user_id` (optional): Filter by user
- `action` (optional): Filter by action type
- `limit` (optional): Max results (default: 50)

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "user_id": "uuid",
      "action": "task.created",
      "resource_type": "task",
      "resource_id": "uuid",
      "details": {"title": "New Task"},
      "created_at": "2026-01-14T12:00:00Z"
    }
  ],
  "count": 50
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}  // optional additional information
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limits

| Endpoint Category | Limit |
|-------------------|-------|
| Authentication | 10 req/min |
| Standard API | 100 req/min |
| Prompt Enhancement | 20 req/min |
| Agent Execution | 10 req/min |

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp
