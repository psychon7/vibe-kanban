# Vibe Kanban API Reference

> Version: 1.0.0 | Base URL: `/api/v1`

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Workspaces](#workspaces)
- [Projects](#projects)
- [Tasks](#tasks)
- [Prompts](#prompts)
- [Audit](#audit)
- [Health Checks](#health-checks)
- [Error Codes](#error-codes)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <session_token>
```

### POST /auth/signup

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "session_token",
  "expiresAt": "2026-01-15T00:00:00.000Z"
}
```

### POST /auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "session_token",
  "expiresAt": "2026-01-15T00:00:00.000Z"
}
```

### POST /auth/logout

🔒 **Requires Authentication**

Logout and invalidate session.

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

### GET /auth/me

🔒 **Requires Authentication**

Get current authenticated user.

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "createdAt": "2026-01-13T00:00:00.000Z"
  }
}
```

### POST /auth/refresh

🔒 **Requires Authentication**

Refresh session token.

**Response:** `200 OK`
```json
{
  "user": { ... },
  "token": "new_session_token",
  "expiresAt": "2026-01-15T00:00:00.000Z"
}
```

---

## Users

### GET /users/:userId

🔒 **Requires Authentication**

Get user profile by ID.

---

## Workspaces

All workspace endpoints require the `X-Workspace-Id` header for context-aware operations.

### GET /workspaces

🔒 **Requires Authentication**

List user's workspaces.

**Response:** `200 OK`
```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "slug": "my-workspace",
      "user_role": "Owner",
      "created_by_name": "John Doe",
      "created_at": "2026-01-13T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /workspaces

🔒 **Requires Authentication**

Create a new workspace.

**Request Body:**
```json
{
  "name": "My Workspace",
  "slug": "my-workspace"
}
```

**Response:** `201 Created`
```json
{
  "workspace": {
    "id": "uuid",
    "name": "My Workspace",
    "slug": "my-workspace",
    "createdBy": "user_id",
    "userRole": "Owner"
  }
}
```

### GET /workspaces/:id

🔒 **Requires Authentication** | **Requires Membership**

Get workspace details.

**Response:** `200 OK`
```json
{
  "workspace": {
    "id": "uuid",
    "name": "My Workspace",
    "slug": "my-workspace",
    "user_role": "Owner",
    "memberCount": 5,
    "projectCount": 3
  }
}
```

### PATCH /workspaces/:id

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `workspace.settings`

Update workspace settings.

**Request Body:**
```json
{
  "name": "Updated Name",
  "slug": "updated-slug"
}
```

### DELETE /workspaces/:id

🔒 **Requires Authentication** | 🛡️ **Requires:** Owner only

Delete workspace and all associated data.

### GET /workspaces/:id/members

🔒 **Requires Authentication** | **Requires Membership**

List workspace members.

**Response:** `200 OK`
```json
{
  "members": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "Owner",
      "status": "active",
      "joined_at": "2026-01-13T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /workspaces/:id/members/invite

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `member.invite`

Invite a user to workspace.

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "Member"
}
```

**Roles:** `Admin`, `Member`, `Viewer`

### DELETE /workspaces/:id/members/:userId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `member.remove`

Remove a member from workspace.

### PATCH /workspaces/:id/members/:userId/role

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `member.role.change`

Change member's role.

**Request Body:**
```json
{
  "role": "Admin"
}
```

### GET /workspaces/:id/prompt-settings

🔒 **Requires Authentication** | **Requires Membership**

Get workspace prompt enhancement settings.

**Response:** `200 OK`
```json
{
  "settings": {
    "auto_enhance_enabled": false,
    "preferred_model": "gpt-4-turbo",
    "enhancement_style": "balanced",
    "include_codebase_context": true,
    "include_git_history": false,
    "custom_instructions": null
  }
}
```

### PATCH /workspaces/:id/prompt-settings

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.settings.edit`

Update prompt enhancement settings.

---

## Projects

All project endpoints require `X-Workspace-Id` header.

### GET /projects

🔒 **Requires Authentication** | **Requires Membership**

List projects in workspace.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `active` | Filter by status: `active`, `archived`, `deleted` |

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Description",
      "status": "active",
      "created_by_name": "John Doe",
      "task_count": 10,
      "created_at": "2026-01-13T00:00:00.000Z"
    }
  ],
  "count": 1
}
```

### POST /projects

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `project.create`

Create a new project.

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Optional description"
}
```

### GET /projects/:projectId

🔒 **Requires Authentication** | **Requires Membership**

Get project details with task statistics.

**Response:** `200 OK`
```json
{
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "taskStats": {
      "todo": 5,
      "inprogress": 3,
      "inreview": 2,
      "done": 10,
      "cancelled": 0
    }
  }
}
```

### PATCH /projects/:projectId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `project.edit`

Update project.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "archived"
}
```

### DELETE /projects/:projectId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `project.delete`

Soft delete project.

---

## Tasks

All task endpoints require `X-Workspace-Id` header.

### GET /tasks

🔒 **Requires Authentication** | **Requires Membership**

List tasks with filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | uuid | Filter by project |
| `status` | string | `todo`, `inprogress`, `inreview`, `done`, `cancelled` |
| `assigned_to` | uuid | Filter by assignee |
| `priority` | string | `low`, `medium`, `high`, `urgent` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 50, max: 100) |

**Response:** `200 OK`
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Task Title",
      "description": "Description",
      "status": "todo",
      "priority": "medium",
      "visibility": "workspace",
      "project_name": "Project Name",
      "assigned_to_name": "John Doe",
      "created_by_name": "Jane Doe"
    }
  ],
  "count": 10,
  "total": 50,
  "page": 1,
  "limit": 50
}
```

### POST /tasks

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `task.create`

Create a new task.

**Request Body:**
```json
{
  "project_id": "uuid",
  "title": "Task Title",
  "description": "Optional description",
  "priority": "medium",
  "visibility": "workspace",
  "assigned_to_user_id": "uuid",
  "due_date": "2026-01-20T00:00:00.000Z"
}
```

**Visibility Options:** `workspace`, `private`, `restricted`

### GET /tasks/:taskId

🔒 **Requires Authentication** | **Requires Membership**

Get task by ID. Access is controlled by visibility settings.

### PATCH /tasks/:taskId

🔒 **Requires Authentication** | **Requires Membership**

Update task fields.

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "inprogress",
  "priority": "high",
  "visibility": "private",
  "due_date": "2026-01-25T00:00:00.000Z"
}
```

### DELETE /tasks/:taskId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `task.delete`

Delete task permanently.

### PATCH /tasks/:taskId/assign

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `task.assign`

Assign or unassign task.

**Request Body:**
```json
{
  "user_id": "uuid or null"
}
```

### PATCH /tasks/:taskId/visibility

🔒 **Requires Authentication** | **Requires:** Task Creator only

Change task visibility.

**Request Body:**
```json
{
  "visibility": "restricted",
  "user_ids": ["uuid1", "uuid2"]
}
```

### POST /tasks/:taskId/enhance

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.enhance`

Enhance task prompt using AI.

---

## Prompts

### POST /prompts/enhance

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.enhance`

Enhance a prompt using AI.

**Request Body:**
```json
{
  "prompt": "Original prompt text",
  "task_id": "optional-uuid",
  "style": "balanced",
  "include_context": true
}
```

**Styles:** `minimal`, `balanced`, `comprehensive`

**Response:** `200 OK`
```json
{
  "enhancement": {
    "id": "uuid",
    "originalPrompt": "Original prompt text",
    "enhancedPrompt": "Enhanced prompt with better structure...",
    "originalScore": 35,
    "enhancedScore": 78,
    "improvement": 43,
    "model": "llama-2-7b-chat-int8",
    "style": "balanced"
  }
}
```

### POST /prompts/score

🔒 **Requires Authentication**

Score a prompt's quality.

**Request Body:**
```json
{
  "prompt": "Prompt to score"
}
```

**Response:** `200 OK`
```json
{
  "score": 65,
  "maxScore": 100,
  "feedback": [
    "Consider using bullet points or numbered lists for clarity.",
    "Add expected behavior or acceptance criteria."
  ]
}
```

### POST /prompts/enhance/:enhancementId/feedback

🔒 **Requires Authentication**

Provide feedback on enhancement.

**Request Body:**
```json
{
  "accepted": true,
  "edited": false,
  "final_prompt": "Optional final version if edited"
}
```

### GET /prompts/templates

🔒 **Requires Authentication**

List prompt templates.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | `bug-fix`, `feature`, `refactor`, `docs`, `test`, `other` |

### POST /prompts/templates

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.template.create`

Create prompt template.

**Request Body:**
```json
{
  "name": "Bug Fix Template",
  "description": "Template for bug fixes",
  "template_text": "Fix the following bug: {{bug_description}}\n\nExpected: {{expected}}\nActual: {{actual}}",
  "category": "bug-fix"
}
```

### GET /prompts/templates/:templateId

🔒 **Requires Authentication**

Get template with placeholders.

**Response:** `200 OK`
```json
{
  "template": {
    "id": "uuid",
    "name": "Bug Fix Template",
    "template_text": "...",
    "placeholders": ["bug_description", "expected", "actual"]
  }
}
```

### POST /prompts/templates/:templateId/render

🔒 **Requires Authentication**

Render template with variables.

**Request Body:**
```json
{
  "variables": {
    "bug_description": "Login button not working",
    "expected": "User should be redirected to dashboard",
    "actual": "Page shows error 500"
  }
}
```

**Response:** `200 OK`
```json
{
  "rendered": "Fix the following bug: Login button not working...",
  "missingPlaceholders": [],
  "complete": true
}
```

### PATCH /prompts/templates/:templateId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.template.create`

Update template (creator only).

### DELETE /prompts/templates/:templateId

🔒 **Requires Authentication** | 🛡️ **Requires Permission:** `prompt.template.create`

Delete template (creator only).

### GET /prompts/usage

🔒 **Requires Authentication** | **Requires Membership**

Get prompt enhancement usage statistics.

**Response:** `200 OK`
```json
{
  "usage": {
    "enhancements": {
      "total": 150,
      "accepted": 120,
      "rejected": 30,
      "avgImprovement": 42
    },
    "templates": {
      "count": 10,
      "totalUses": 500
    }
  }
}
```

---

## Audit

All audit endpoints require `X-Workspace-Id` header.

### GET /audit

🔒 **Requires Authentication** | **Requires Membership**

List audit logs with filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entity_type` | string | Filter by entity type |
| `action` | string | Filter by action |
| `actor_id` | uuid | Filter by actor |
| `from_date` | datetime | Start date (ISO 8601) |
| `to_date` | datetime | End date (ISO 8601) |
| `page` | number | Page number |
| `limit` | number | Items per page (max: 100) |

**Response:** `200 OK`
```json
{
  "logs": [
    {
      "id": "uuid",
      "entity_type": "task",
      "entity_id": "task-uuid",
      "action": "create",
      "actor_name": "John Doe",
      "actor_email": "john@example.com",
      "created_at": "2026-01-13T12:00:00.000Z"
    }
  ],
  "count": 50,
  "total": 500,
  "page": 1,
  "limit": 50
}
```

### GET /audit/:auditId

🔒 **Requires Authentication** | **Requires Membership**

Get specific audit log entry with payload.

### GET /audit/entity/:type/:entityId

🔒 **Requires Authentication** | **Requires Membership**

Get audit history for a specific entity.

### POST /audit/export

🔒 **Requires Authentication** | **Requires Membership**

Export audit logs to R2 as CSV.

**Request Body:**
```json
{
  "from_date": "2026-01-01T00:00:00.000Z",
  "to_date": "2026-01-14T00:00:00.000Z"
}
```

**Response:** `200 OK`
```json
{
  "message": "Export created successfully",
  "fileName": "audit-export-workspace-id-1705233600000.csv",
  "recordCount": 500
}
```

---

## Health Checks

### GET /health

Basic health check.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T00:00:00.000Z",
  "environment": "production"
}
```

### GET /health/db

Database connectivity check.

**Response:** `200 OK`
```json
{
  "status": "ok",
  "database": "connected",
  "result": 1
}
```

---

## Error Codes

### Authentication Errors (401)

| Code | Description |
|------|-------------|
| `AUTH_001` | Invalid credentials |
| `AUTH_002` | Session expired |
| `AUTH_003` | Missing authentication |
| `INVALID_TOKEN` | Invalid token format |
| `TOKEN_EXPIRED` | Token has expired |

### Authorization Errors (403)

| Code | Description |
|------|-------------|
| `AUTH_004` | Insufficient permissions |
| `AUTH_005` | Account suspended |
| `RBAC_001` | Not a workspace member |
| `RBAC_002` | Role not assignable |
| `RBAC_003` | Cannot modify owner role |

### Validation Errors (400)

| Code | Description |
|------|-------------|
| `VAL_001` | Validation error |
| `VAL_002` | Invalid UUID format |
| `VALIDATION_ERROR` | Schema validation failed |
| `INVALID_INPUT` | Invalid input data |

### Resource Errors (404)

| Code | Description |
|------|-------------|
| `NOT_FOUND` | Resource not found |
| `USER_NOT_FOUND` | User not found |
| `WORKSPACE_NOT_FOUND` | Workspace not found |
| `PROJECT_NOT_FOUND` | Project not found |
| `TASK_NOT_FOUND` | Task not found |
| `TASK_002` | Task not visible |

### Conflict Errors (409)

| Code | Description |
|------|-------------|
| `CONFLICT` | Resource conflict |
| `ALREADY_EXISTS` | Resource already exists |

### Rate Limiting (429)

| Code | Description |
|------|-------------|
| `PROMPT_003` | Enhancement rate limited |
| `RATE_LIMITED` | Too many requests |

### Server Errors (500)

| Code | Description |
|------|-------------|
| `PROMPT_001` | Enhancement failed |
| `PROMPT_002` | Invalid template |
| `SYS_001` | Internal server error |
| `SYS_002` | Service unavailable |
| `AI_SERVICE_ERROR` | AI service error |

---

## Common Response Format

### Success Response
```json
{
  "resource": { ... }
}
```

### Error Response
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "requestId": "uuid"
}
```

### Paginated Response
```json
{
  "items": [ ... ],
  "count": 10,
  "total": 100,
  "page": 1,
  "limit": 10
}
```
