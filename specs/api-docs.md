# API Documentation

> **Document Type:** API Contract Specification (Source of Truth for Frontend-Backend Integration)
> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Base URL:** `https://api.vibe-kanban.workers.dev/api`
> **Platform:** Cloudflare Workers
> **Protocol:** REST over HTTPS with Durable Objects for real-time updates

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Global Conventions](#3-global-conventions)
4. [Authentication Endpoints](#4-authentication-endpoints)
5. [User Endpoints](#5-user-endpoints)
6. [Team Workspace Endpoints](#6-team-workspace-endpoints)
7. [Member Management Endpoints](#7-member-management-endpoints)
8. [Project Endpoints](#8-project-endpoints)
9. [Task Endpoints](#9-task-endpoints)
10. [Prompt Enhancement Endpoints](#10-prompt-enhancement-endpoints)
11. [Prompt Template Endpoints](#11-prompt-template-endpoints)
12. [Prompt Settings Endpoints](#12-prompt-settings-endpoints)
13. [Audit Log Endpoints](#13-audit-log-endpoints)
14. [Data Schemas](#14-data-schemas)
15. [WebSocket Events](#15-websocket-events)

---

## 1. API Overview

### 1.1 Base URL and Environment

| Environment | Base URL |
|-------------|----------|
| Production | `https://api.vibe-kanban.workers.dev/api` |
| Preview | `https://{branch}.api.vibe-kanban.workers.dev/api` |
| Local Development | `http://localhost:8787/api` |

The API runs on Cloudflare Workers with global edge deployment (300+ locations).

### 1.2 API Versioning

- **Strategy:** URL path prefix (e.g., `/api/v1/...`)
- **Current Version:** v1 (implicit, no prefix required for v1)
- **Deprecation Policy:** Deprecated endpoints will return `Deprecation` header with sunset date

### 1.3 Content Types

| Content Type | Usage |
|--------------|-------|
| `application/json` | Request/Response bodies (default) |
| `multipart/form-data` | File uploads (images to R2) |

### 1.4 API Stability

All endpoints documented here are considered **stable** unless marked with:
- `[BETA]` - May change without notice
- `[DEPRECATED]` - Scheduled for removal

---

## 2. Authentication & Authorization

### 2.1 Authentication Scheme

**Method:** Cloudflare Access (Zero Trust) with JWT validation

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloudflare      │────>│ Workers API      │────>│ Cloudflare D1   │
│ Pages (React)   │     │ (Hono)           │     │ (SQLite)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │  CF-Access-JWT-       │
        │  Assertion (Header)   │
        │──────────────────────>│
```

### 2.1.1 Cloudflare Access Flow

1. User visits app → Redirected to CF Access login
2. User authenticates via Google/GitHub/Email OTP
3. CF Access issues JWT cookie (`CF_Authorization`)
4. Workers validate JWT on each request
5. User info extracted from JWT claims

### 2.2 Session Token

| Property | Value |
|----------|-------|
| Name | `vk_session` |
| Type | HTTP-only cookie |
| Lifetime | 7 days (configurable) |
| Secure | `true` (when applicable) |
| SameSite | `Strict` |

### 2.3 Authorization Header (Alternative)

For programmatic access, a Bearer token can be used:

```
Authorization: Bearer <session_token>
```

### 2.4 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| Owner | 4 | Workspace creator, full control |
| Admin | 3 | Full permissions except workspace deletion |
| Member | 2 | Create/edit own tasks, limited assignment |
| Viewer | 1 | Read-only access |

### 2.5 Permission Keys

```
workspace.delete        - Delete team workspace (Owner only)
workspace.settings      - Modify workspace settings
member.invite           - Invite new members
member.remove           - Remove members
member.role.change      - Change member roles
project.create          - Create projects
project.delete          - Delete projects
task.create             - Create tasks
task.assign             - Assign tasks to members
task.edit               - Edit task content
task.delete             - Delete tasks
task.view.private       - View private tasks
attempt.run             - Run agent attempts
attempt.approve         - Approve attempt results
prompt.enhance          - Use prompt enhancement
prompt.template.create  - Create prompt templates
prompt.settings.edit    - Edit prompt enhancement settings
```

---

## 3. Global Conventions

### 3.1 Success Response Envelope

All successful responses follow this structure:

```json
{
  "success": true,
  "data": { /* response payload */ }
}
```

### 3.2 Error Response Envelope

All error responses follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### 3.3 Extended Error Response (for validation errors)

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VAL_001",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### 3.4 Error Code Taxonomy

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_001 | 401 | Invalid credentials |
| AUTH_002 | 401 | Session expired |
| AUTH_003 | 401 | Missing authentication |
| AUTH_004 | 403 | Insufficient permissions |
| AUTH_005 | 403 | Account suspended |
| RBAC_001 | 403 | Not a workspace member |
| RBAC_002 | 403 | Role not assignable |
| RBAC_003 | 403 | Cannot modify owner role |
| TASK_001 | 404 | Task not found |
| TASK_002 | 403 | Task not visible |
| TASK_003 | 400 | Invalid task status transition |
| PROMPT_001 | 500 | Enhancement failed |
| PROMPT_002 | 400 | Invalid template |
| PROMPT_003 | 429 | Enhancement rate limited |
| VAL_001 | 400 | Validation error |
| VAL_002 | 400 | Invalid UUID format |
| SYS_001 | 500 | Internal server error |
| SYS_002 | 503 | Service unavailable |

### 3.5 Pagination (Cursor-Based)

List endpoints use cursor-based pagination:

**Request Parameters:**
```
?cursor=<opaque_cursor>&limit=<number>
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| cursor | string | null | - | Opaque cursor from previous response |
| limit | integer | 50 | 100 | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMzQ1In0=",
    "has_more": true,
    "total_count": 150
  }
}
```

### 3.6 Filtering

Query parameters for filtering:

```
?filter[status]=active&filter[assigned_to]=<user_id>
```

### 3.7 Sorting

```
?sort=created_at:desc&sort=title:asc
```

### 3.8 Rate Limiting

Rate limit headers included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
```

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Signup | 3 requests | 1 hour |
| Prompt Enhancement | 20 requests | 1 hour |
| General API | 1000 requests | 1 hour |

### 3.9 Common Headers

**Request Headers:**
```
Content-Type: application/json
Accept: application/json
X-Request-ID: <uuid>  (optional, for request tracing)
```

**Response Headers:**
```
Content-Type: application/json
X-Request-ID: <uuid>
X-RateLimit-Limit: <number>
X-RateLimit-Remaining: <number>
X-RateLimit-Reset: <unix_timestamp>
```

### 3.10 Timestamps

All timestamps are ISO-8601 format in UTC:

```
"2026-01-13T10:30:00.000Z"
```

### 3.11 ID Format

All entity IDs are UUIDs (v4):

```
"550e8400-e29b-41d4-a716-446655440000"
```

---

## 4. Authentication Endpoints

### 4.1 POST /api/auth/signup

**Purpose:** Create a new user account

**Authentication Required:** No

**Rate Limit:** 3 requests per hour

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "securePassword123"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | string | Yes | Valid email, max 255 chars, unique |
| name | string | Yes | 1-100 chars |
| password | string | Yes | Min 8 chars |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar_url": null,
      "created_at": "2026-01-13T10:30:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    },
    "default_workspace": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Personal Workspace",
      "created_by": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-01-13T10:30:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    }
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error (invalid email format, password too short) |
| 409 | AUTH_006 | Email already registered |
| 429 | - | Rate limit exceeded |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "securePassword123"
  }'
```

---

### 4.2 POST /api/auth/login

**Purpose:** Authenticate user and create session

**Authentication Required:** No

**Rate Limit:** 5 requests per 15 minutes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | string | Yes | Valid email |
| password | string | Yes | Non-empty |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar_url": null,
      "created_at": "2026-01-13T10:30:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    },
    "workspaces": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Personal Workspace",
        "role": "Owner"
      }
    ]
  }
}
```

**Response Headers:**
```
Set-Cookie: vk_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_001 | Invalid credentials |
| 403 | AUTH_005 | Account suspended |
| 429 | - | Rate limit exceeded |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

---

### 4.3 POST /api/auth/logout

**Purpose:** Invalidate current session

**Authentication Required:** Yes

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Response Headers:**
```
Set-Cookie: vk_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/logout \
  -b cookies.txt
```

---

### 4.4 GET /api/auth/me

**Purpose:** Get current authenticated user

**Authentication Required:** Yes

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "avatar_url": "https://example.com/avatar.jpg",
      "created_at": "2026-01-13T10:30:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    },
    "workspaces": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Personal Workspace",
        "role": "Owner",
        "status": "active"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440002",
        "name": "Team Project",
        "role": "Member",
        "status": "active"
      }
    ]
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_002 | Session expired |
| 401 | AUTH_003 | Missing authentication |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/auth/me \
  -b cookies.txt
```

---

### 4.5 POST /api/auth/refresh

**Purpose:** Refresh session token

**Authentication Required:** Yes (valid or recently expired session)

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expires_at": "2026-01-20T10:30:00.000Z"
  }
}
```

**Response Headers:**
```
Set-Cookie: vk_session=<new_token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_002 | Session expired (beyond refresh window) |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/auth/refresh \
  -b cookies.txt -c cookies.txt
```

---

## 5. User Endpoints

### 5.1 GET /api/users/:id

**Purpose:** Get user profile by ID

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "created_at": "2026-01-13T10:30:00.000Z"
  }
}
```

**Note:** Email is only visible if the requesting user shares a workspace with the target user.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 404 | - | User not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -b cookies.txt
```

---

### 5.2 PATCH /api/users/:id

**Purpose:** Update user profile

**Authentication Required:** Yes

**Roles Allowed:** Self only (users can only update their own profile)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | User ID (must match authenticated user) |

**Request Body:**
```json
{
  "name": "John Smith",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | No | 1-100 chars |
| avatar_url | string | No | Valid URL or null |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Smith",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "created_at": "2026-01-13T10:30:00.000Z",
    "updated_at": "2026-01-13T12:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Cannot update other users |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "John Smith"
  }'
```

---

### 5.3 GET /api/users/search

**Purpose:** Search users for member invitation

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| q | string | Yes | - | Search query (email or name) |
| limit | integer | No | 10 | Max results (1-50) |
| exclude_workspace | UUID | No | - | Exclude users already in this workspace |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "avatar_url": null
    }
  ]
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Query parameter 'q' required (min 2 chars) |
| 401 | AUTH_003 | Missing authentication |

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/users/search?q=jane&limit=5" \
  -b cookies.txt
```

---

## 6. Team Workspace Endpoints

### 6.1 GET /api/workspaces-team

**Purpose:** List all team workspaces the user belongs to

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Personal Workspace",
      "created_by": "550e8400-e29b-41d4-a716-446655440000",
      "created_at": "2026-01-13T10:30:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z",
      "member_count": 1,
      "my_role": "Owner"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "name": "Engineering Team",
      "created_by": "550e8400-e29b-41d4-a716-446655440002",
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-01-12T15:30:00.000Z",
      "member_count": 5,
      "my_role": "Member"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 2
  }
}
```

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/workspaces-team \
  -b cookies.txt
```

---

### 6.2 POST /api/workspaces-team

**Purpose:** Create a new team workspace

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Request Body:**
```json
{
  "name": "New Project Team"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 1-100 chars |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440003",
    "name": "New Project Team",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-01-13T14:00:00.000Z",
    "updated_at": "2026-01-13T14:00:00.000Z",
    "member_count": 1,
    "my_role": "Owner"
  }
}
```

**Note:** The creating user is automatically assigned as Owner.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error (name required) |
| 401 | AUTH_003 | Missing authentication |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/workspaces-team \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "New Project Team"}'
```

---

### 6.3 GET /api/workspaces-team/:id

**Purpose:** Get team workspace details

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner (workspace members only)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Engineering Team",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-12T15:30:00.000Z",
    "member_count": 5,
    "project_count": 3,
    "my_role": "Admin",
    "owner": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "avatar_url": null
    }
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### 6.4 PATCH /api/workspaces-team/:id

**Purpose:** Update team workspace settings

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `workspace.settings`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Request Body:**
```json
{
  "name": "Updated Team Name"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | No | 1-100 chars |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Updated Team Name",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-13T16:00:00.000Z",
    "member_count": 5,
    "my_role": "Owner"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Updated Team Name"}'
```

---

### 6.5 DELETE /api/workspaces-team/:id

**Purpose:** Delete team workspace

**Authentication Required:** Yes

**Roles Allowed:** Owner only

**Required Permission:** `workspace.delete`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Note:** This is a destructive operation. All projects, tasks, and member associations within the workspace will be deleted.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Only Owner can delete workspace |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X DELETE http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

## 7. Member Management Endpoints

### 7.1 GET /api/workspaces-team/:id/members

**Purpose:** List all members of a team workspace

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |
| filter[status] | string | No | all | Filter by status: active, invited, suspended |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "email": "john@example.com",
        "avatar_url": null
      },
      "role": {
        "id": "770e8400-e29b-41d4-a716-446655440001",
        "name": "Owner"
      },
      "status": "active",
      "joined_at": "2026-01-10T08:00:00.000Z"
    },
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440001",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "avatar_url": "https://example.com/avatar.jpg"
      },
      "role": {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "name": "Member"
      },
      "status": "active",
      "joined_at": "2026-01-11T10:30:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 2
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/members?filter[status]=active" \
  -b cookies.txt
```

---

### 7.2 POST /api/workspaces-team/:id/members/invite

**Purpose:** Invite a user to join the team workspace

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `member.invite`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role_name": "Member"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| email | string | Yes | Valid email, registered user |
| role_name | string | No | Owner, Admin, Member (default), Viewer |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440005",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "New Member",
      "email": "newmember@example.com",
      "avatar_url": null
    },
    "role": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Member"
    },
    "status": "invited",
    "joined_at": "2026-01-13T18:00:00.000Z"
  }
}
```

**Note:** An invitation notification will be sent to the user (in-app notification). The user must accept to become an active member.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error (invalid email) |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | RBAC_002 | Cannot assign Owner role via invite |
| 404 | - | User not found with this email |
| 409 | - | User already a member of this workspace |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/members/invite \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "newmember@example.com",
    "role_name": "Member"
  }'
```

---

### 7.3 POST /api/workspaces-team/:id/members/:userId/accept

**Purpose:** Accept a workspace invitation

**Authentication Required:** Yes

**Roles Allowed:** The invited user only

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |
| userId | UUID | Yes | User ID (must match authenticated user) |

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440005",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440005",
      "name": "New Member",
      "email": "newmember@example.com",
      "avatar_url": null
    },
    "role": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Member"
    },
    "status": "active",
    "joined_at": "2026-01-13T18:30:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | - | Can only accept your own invitation |
| 404 | - | Invitation not found |
| 409 | - | Invitation already accepted |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/members/550e8400-e29b-41d4-a716-446655440005/accept \
  -b cookies.txt
```

---

### 7.4 PATCH /api/workspaces-team/:id/members/:userId/role

**Purpose:** Change a member's role

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `member.role.change`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |
| userId | UUID | Yes | Target user ID |

**Request Body:**
```json
{
  "role_name": "Admin"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| role_name | string | Yes | Admin, Member, Viewer |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "avatar_url": null
    },
    "role": {
      "id": "770e8400-e29b-41d4-a716-446655440003",
      "name": "Admin"
    },
    "status": "active",
    "joined_at": "2026-01-11T10:30:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Invalid role name |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | RBAC_002 | Cannot assign Owner role |
| 403 | RBAC_003 | Cannot modify Owner's role |
| 404 | - | Member not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/members/550e8400-e29b-41d4-a716-446655440001/role \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"role_name": "Admin"}'
```

---

### 7.5 DELETE /api/workspaces-team/:id/members/:userId

**Purpose:** Remove a member from the workspace

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner (or self-removal)

**Required Permission:** `member.remove` (except for self-removal)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |
| userId | UUID | Yes | User ID to remove |

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Note:**
- Users can remove themselves from a workspace (leave)
- Owner cannot be removed or leave
- Admins cannot remove other Admins or the Owner

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | RBAC_003 | Cannot remove Owner |
| 404 | - | Member not found |

**Example Request:**
```bash
curl -X DELETE http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/members/550e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

## 8. Project Endpoints

### 8.1 GET /api/projects

**Purpose:** List all projects (optionally filtered by team workspace)

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_team_id | UUID | No | null | Filter by team workspace |
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "name": "Backend API",
      "default_agent_working_dir": "/src",
      "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
      "remote_project_id": null,
      "created_at": "2026-01-10T09:00:00.000Z",
      "updated_at": "2026-01-13T12:00:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 1
  }
}
```

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/projects?workspace_team_id=660e8400-e29b-41d4-a716-446655440001" \
  -b cookies.txt
```

---

### 8.2 POST /api/projects

**Purpose:** Create a new project

**Authentication Required:** Yes

**Roles Allowed:** Member, Admin, Owner

**Required Permission:** `project.create`

**Request Body:**
```json
{
  "name": "New Feature Project",
  "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
  "repositories": [
    {
      "display_name": "main-repo",
      "git_repo_path": "/Users/dev/projects/main-repo"
    }
  ]
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | Yes | 1-255 chars |
| team_workspace_id | UUID | No | Must be member of workspace |
| repositories | array | Yes | At least one repository |
| repositories[].display_name | string | Yes | 1-100 chars |
| repositories[].git_repo_path | string | Yes | Valid git repository path |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440002",
    "name": "New Feature Project",
    "default_agent_working_dir": null,
    "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
    "remote_project_id": null,
    "created_at": "2026-01-13T20:00:00.000Z",
    "updated_at": "2026-01-13T20:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 400 | - | Path does not exist |
| 400 | - | Path is not a directory |
| 400 | - | Path is not a git repository |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 409 | - | Duplicate repository path |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/projects \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "New Feature Project",
    "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
    "repositories": [{
      "display_name": "main-repo",
      "git_repo_path": "/Users/dev/projects/main-repo"
    }]
  }'
```

---

### 8.3 GET /api/projects/:id

**Purpose:** Get project details

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner (workspace members)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Project ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "name": "Backend API",
    "default_agent_working_dir": "/src",
    "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
    "remote_project_id": null,
    "created_at": "2026-01-10T09:00:00.000Z",
    "updated_at": "2026-01-13T12:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Project not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/projects/880e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### 8.4 PUT /api/projects/:id

**Purpose:** Update project

**Authentication Required:** Yes

**Roles Allowed:** Member (own projects), Admin, Owner

**Required Permission:** `project.create` (for updating own) or Admin/Owner role

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Project ID |

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "default_agent_working_dir": "/src/app"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | No | 1-255 chars |
| default_agent_working_dir | string | No | Valid path |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440001",
    "name": "Updated Project Name",
    "default_agent_working_dir": "/src/app",
    "team_workspace_id": "660e8400-e29b-41d4-a716-446655440001",
    "remote_project_id": null,
    "created_at": "2026-01-10T09:00:00.000Z",
    "updated_at": "2026-01-13T21:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | - | Project not found |

**Example Request:**
```bash
curl -X PUT http://127.0.0.1:8080/api/projects/880e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Updated Project Name"}'
```

---

### 8.5 DELETE /api/projects/:id

**Purpose:** Delete project

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `project.delete`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Project ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Note:** This deletes all tasks and workspaces within the project.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | - | Project not found |

**Example Request:**
```bash
curl -X DELETE http://127.0.0.1:8080/api/projects/880e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

## 9. Task Endpoints

### 9.1 GET /api/tasks

**Purpose:** List tasks for a project

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| project_id | UUID | Yes | - | Filter by project |
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |
| filter[status] | string | No | all | todo, inprogress, inreview, done, cancelled |
| filter[assigned_to] | UUID | No | null | Filter by assignee |
| filter[created_by] | UUID | No | null | Filter by creator |
| filter[visibility] | string | No | all | workspace, private, restricted |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "task": {
        "id": "990e8400-e29b-41d4-a716-446655440001",
        "project_id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Implement user authentication",
        "description": "Add JWT-based authentication to the API",
        "status": "inprogress",
        "parent_workspace_id": null,
        "shared_task_id": null,
        "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
        "created_by_user_id": "550e8400-e29b-41d4-a716-446655440000",
        "visibility": "workspace",
        "created_at": "2026-01-12T10:00:00.000Z",
        "updated_at": "2026-01-13T14:30:00.000Z"
      },
      "has_in_progress_attempt": true,
      "last_attempt_failed": false,
      "executor": "claude-code"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 1
  }
}
```

**Note:** Private tasks are only visible to the creator and users with `task.view.private` permission.

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/tasks?project_id=880e8400-e29b-41d4-a716-446655440001&filter[status]=inprogress" \
  -b cookies.txt
```

---

### 9.2 POST /api/tasks

**Purpose:** Create a new task

**Authentication Required:** Yes

**Roles Allowed:** Member, Admin, Owner

**Required Permission:** `task.create`

**Request Body:**
```json
{
  "project_id": "880e8400-e29b-41d4-a716-446655440001",
  "title": "Add user profile endpoint",
  "description": "Create GET /api/users/:id endpoint with proper authorization",
  "visibility": "workspace",
  "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
  "image_ids": []
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| project_id | UUID | Yes | Must exist |
| title | string | Yes | 1-500 chars |
| description | string | No | Max 10000 chars |
| visibility | string | No | workspace (default), private, restricted |
| assigned_to_user_id | UUID | No | Must be workspace member |
| image_ids | array | No | Previously uploaded image IDs |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440002",
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Add user profile endpoint",
    "description": "Create GET /api/users/:id endpoint with proper authorization",
    "status": "todo",
    "parent_workspace_id": null,
    "shared_task_id": null,
    "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
    "created_by_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "visibility": "workspace",
    "created_at": "2026-01-13T22:00:00.000Z",
    "updated_at": "2026-01-13T22:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | - | Project not found |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Add user profile endpoint",
    "description": "Create GET /api/users/:id endpoint with proper authorization"
  }'
```

---

### 9.3 GET /api/tasks/:id

**Purpose:** Get task details

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner (with visibility constraints)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440001",
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "status": "inprogress",
    "parent_workspace_id": null,
    "shared_task_id": null,
    "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
    "created_by_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "visibility": "workspace",
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-13T14:30:00.000Z",
    "assignee": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Jane Smith",
      "avatar_url": null
    },
    "creator": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "avatar_url": null
    }
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | TASK_002 | Task not visible |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### 9.4 PUT /api/tasks/:id

**Purpose:** Update task

**Authentication Required:** Yes

**Roles Allowed:** Member (own/assigned tasks), Admin, Owner

**Required Permission:** `task.edit`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body:**
```json
{
  "title": "Updated task title",
  "description": "Updated description",
  "status": "inreview",
  "parent_workspace_id": null,
  "image_ids": []
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| title | string | No | 1-500 chars |
| description | string | No | Max 10000 chars (empty string clears) |
| status | string | No | todo, inprogress, inreview, done, cancelled |
| parent_workspace_id | UUID | No | Valid workspace ID |
| image_ids | array | No | Image IDs to associate |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440001",
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Updated task title",
    "description": "Updated description",
    "status": "inreview",
    "parent_workspace_id": null,
    "shared_task_id": null,
    "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
    "created_by_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "visibility": "workspace",
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-13T23:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 400 | TASK_003 | Invalid status transition |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X PUT http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"status": "inreview"}'
```

---

### 9.5 DELETE /api/tasks/:id

**Purpose:** Delete task

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `task.delete`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Response (202 Accepted):**
```json
{
  "success": true,
  "data": null
}
```

**Note:** Returns 202 as cleanup happens asynchronously in the background.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X DELETE http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### 9.6 PATCH /api/tasks/:id/assign

**Purpose:** Assign or unassign a task

**Authentication Required:** Yes

**Roles Allowed:** Member (own tasks), Admin, Owner

**Required Permission:** `task.assign`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body:**
```json
{
  "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| assigned_to_user_id | UUID | No | Workspace member ID, null to unassign |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440001",
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API",
    "status": "inprogress",
    "assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001",
    "created_by_user_id": "550e8400-e29b-41d4-a716-446655440000",
    "visibility": "workspace",
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-14T08:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | RBAC_001 | Assignee not a workspace member |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001/assign \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"assigned_to_user_id": "550e8400-e29b-41d4-a716-446655440001"}'
```

---

### 9.7 PATCH /api/tasks/:id/visibility

**Purpose:** Change task visibility

**Authentication Required:** Yes

**Roles Allowed:** Creator, Admin, Owner

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Request Body:**
```json
{
  "visibility": "private"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| visibility | string | Yes | workspace, private, restricted |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440001",
    "project_id": "880e8400-e29b-41d4-a716-446655440001",
    "title": "Implement user authentication",
    "visibility": "private",
    "created_at": "2026-01-12T10:00:00.000Z",
    "updated_at": "2026-01-14T09:00:00.000Z"
  }
}
```

**Visibility Levels:**
- `workspace`: Visible to all workspace members
- `private`: Visible only to creator and assignee
- `restricted`: Visible based on TaskAcl entries

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Invalid visibility value |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Only creator can change visibility |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001/visibility \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"visibility": "private"}'
```

---

## 10. Prompt Enhancement Endpoints

### 10.1 POST /api/prompts/enhance

**Purpose:** Enhance a task prompt using AI

**Authentication Required:** Yes

**Roles Allowed:** Member, Admin, Owner

**Required Permission:** `prompt.enhance`

**Rate Limit:** 20 requests per hour

**Request Body:**
```json
{
  "prompt": "Add user authentication",
  "task_id": "990e8400-e29b-41d4-a716-446655440001",
  "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| prompt | string | Yes | 1-10000 chars |
| task_id | UUID | No | Associate with task |
| workspace_team_id | UUID | No | Use workspace settings |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "original_prompt": "Add user authentication",
    "enhanced_prompt": "## Goal\nImplement secure user authentication for the application.\n\n## Context\nThe application currently has no authentication mechanism. Users need to be able to register, login, and maintain sessions.\n\n## Requirements\n- Implement JWT-based authentication\n- Create user registration endpoint with email verification\n- Create login endpoint with password hashing (Argon2)\n- Implement session management with refresh tokens\n- Add authentication middleware for protected routes\n\n## Success Criteria\n- Users can register with email and password\n- Users can login and receive a JWT token\n- Protected routes reject unauthenticated requests\n- Passwords are securely hashed\n- Sessions expire after 7 days",
    "enhancement_model": "gpt-4-turbo",
    "techniques_applied": [
      "goal_clarification",
      "context_injection",
      "requirements_extraction",
      "success_criteria"
    ],
    "original_score": 15,
    "enhanced_score": 85
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error (prompt required) |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 429 | PROMPT_003 | Rate limit exceeded |
| 500 | PROMPT_001 | Enhancement failed |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/prompts/enhance \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "prompt": "Add user authentication",
    "task_id": "990e8400-e29b-41d4-a716-446655440001"
  }'
```

---

### 10.2 GET /api/prompts/score

**Purpose:** Get quality score for a prompt

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prompt | string | Yes | Prompt text to score (URL encoded) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "score": 45,
    "breakdown": {
      "clarity": 60,
      "specificity": 30,
      "context": 20,
      "actionability": 70
    },
    "suggestions": [
      "Add specific success criteria",
      "Include technical context or constraints",
      "Break down into smaller, measurable steps"
    ]
  }
}
```

**Score Ranges:**
- 0-25: Poor - needs significant improvement
- 26-50: Fair - missing key elements
- 51-75: Good - clear but could be more detailed
- 76-100: Excellent - comprehensive and actionable

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/prompts/score?prompt=Add%20user%20authentication" \
  -b cookies.txt
```

---

### 10.3 POST /api/prompts/feedback

**Purpose:** Submit feedback on an enhancement

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Request Body:**
```json
{
  "enhancement_id": "aa0e8400-e29b-41d4-a716-446655440001",
  "accepted": true,
  "edited": true,
  "final_prompt": "## Goal\nImplement user authentication...\n\n(user's edited version)"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| enhancement_id | UUID | Yes | Must exist |
| accepted | boolean | Yes | Whether user accepted enhancement |
| edited | boolean | No | Whether user edited the enhancement |
| final_prompt | string | No | The final prompt used (if edited) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 404 | - | Enhancement not found |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/prompts/feedback \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "enhancement_id": "aa0e8400-e29b-41d4-a716-446655440001",
    "accepted": true,
    "edited": false
  }'
```

---

### 10.4 GET /api/tasks/:id/enhancements

**Purpose:** Get prompt enhancement history for a task

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner (with task visibility)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Task ID |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 10 | Items per page (max 50) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "task_id": "990e8400-e29b-41d4-a716-446655440001",
      "original_prompt": "Add user authentication",
      "enhanced_prompt": "## Goal\n...",
      "enhancement_model": "gpt-4-turbo",
      "techniques_applied": ["goal_clarification", "context_injection"],
      "original_score": 15,
      "enhanced_score": 85,
      "user_accepted": true,
      "user_edited": false,
      "final_prompt": null,
      "created_at": "2026-01-13T22:30:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 1
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | TASK_002 | Task not visible |
| 404 | TASK_001 | Task not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/tasks/990e8400-e29b-41d4-a716-446655440001/enhancements \
  -b cookies.txt
```

---

## 11. Prompt Template Endpoints

### 11.1 GET /api/prompt-templates

**Purpose:** List prompt templates

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| workspace_team_id | UUID | No | null | Filter by workspace |
| category | string | No | null | Filter by category |
| include_global | boolean | No | true | Include global templates |
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440001",
      "workspace_team_id": null,
      "name": "Bug Fix Template",
      "description": "Standard template for bug fix tasks",
      "template_text": "## Bug Report\n\n**Description:** {{description}}\n\n**Steps to Reproduce:**\n1. {{step1}}\n2. {{step2}}\n\n**Expected Behavior:** {{expected}}\n\n**Actual Behavior:** {{actual}}\n\n## Fix Requirements\n- Identify root cause\n- Implement fix\n- Add regression test",
      "category": "bug-fix",
      "is_global": true,
      "usage_count": 150,
      "created_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440002",
      "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Team Feature Template",
      "description": "Our team's feature request template",
      "template_text": "## Feature: {{title}}\n\n**User Story:** As a {{persona}}, I want {{action}} so that {{benefit}}.\n\n**Acceptance Criteria:**\n- {{criteria1}}\n- {{criteria2}}",
      "category": "feature",
      "is_global": false,
      "usage_count": 25,
      "created_at": "2026-01-10T12:00:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 2
  }
}
```

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/prompt-templates?category=bug-fix" \
  -b cookies.txt
```

---

### 11.2 POST /api/prompt-templates

**Purpose:** Create a new prompt template

**Authentication Required:** Yes

**Roles Allowed:** Member, Admin, Owner

**Required Permission:** `prompt.template.create`

**Request Body:**
```json
{
  "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Refactoring Template",
  "description": "Template for code refactoring tasks",
  "template_text": "## Refactoring Task\n\n**Target:** {{target_code}}\n\n**Goals:**\n- {{goal1}}\n- {{goal2}}\n\n**Constraints:**\n- Maintain backward compatibility\n- No functional changes\n\n**Testing:**\n- Run existing test suite\n- Add coverage for refactored code",
  "category": "refactor"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| workspace_team_id | UUID | No | null = global (admin only) |
| name | string | Yes | 1-100 chars |
| description | string | No | Max 500 chars |
| template_text | string | Yes | 1-10000 chars |
| category | string | No | bug-fix, feature, refactor, docs, test, other |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440003",
    "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Refactoring Template",
    "description": "Template for code refactoring tasks",
    "template_text": "## Refactoring Task\n...",
    "category": "refactor",
    "is_global": false,
    "usage_count": 0,
    "created_at": "2026-01-14T10:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 400 | PROMPT_002 | Invalid template (missing placeholders) |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |

**Example Request:**
```bash
curl -X POST http://127.0.0.1:8080/api/prompt-templates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Refactoring Template",
    "template_text": "## Refactoring Task\n\n**Target:** {{target_code}}",
    "category": "refactor"
  }'
```

---

### 11.3 GET /api/prompt-templates/:id

**Purpose:** Get prompt template details

**Authentication Required:** Yes

**Roles Allowed:** Any authenticated user (workspace members for non-global)

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Template ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "workspace_team_id": null,
    "name": "Bug Fix Template",
    "description": "Standard template for bug fix tasks",
    "template_text": "## Bug Report\n\n**Description:** {{description}}...",
    "category": "bug-fix",
    "is_global": true,
    "usage_count": 150,
    "created_at": "2026-01-01T00:00:00.000Z",
    "placeholders": ["description", "step1", "step2", "expected", "actual"]
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Template not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/prompt-templates/bb0e8400-e29b-41d4-a716-446655440001 \
  -b cookies.txt
```

---

### 11.4 PATCH /api/prompt-templates/:id

**Purpose:** Update a prompt template

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner (or creator for workspace templates)

**Required Permission:** `prompt.template.create`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Template ID |

**Request Body:**
```json
{
  "name": "Updated Template Name",
  "description": "Updated description",
  "template_text": "Updated template content with {{placeholder}}",
  "category": "feature"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| name | string | No | 1-100 chars |
| description | string | No | Max 500 chars |
| template_text | string | No | 1-10000 chars |
| category | string | No | bug-fix, feature, refactor, docs, test, other |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440003",
    "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Updated Template Name",
    "description": "Updated description",
    "template_text": "Updated template content with {{placeholder}}",
    "category": "feature",
    "is_global": false,
    "usage_count": 0,
    "created_at": "2026-01-14T10:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 400 | PROMPT_002 | Invalid template |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | - | Template not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/prompt-templates/bb0e8400-e29b-41d4-a716-446655440003 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Updated Template Name"}'
```

---

### 11.5 DELETE /api/prompt-templates/:id

**Purpose:** Delete a prompt template

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `prompt.template.create`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Template ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": null
}
```

**Note:** Global templates can only be deleted by system administrators.

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 403 | - | Cannot delete global templates |
| 404 | - | Template not found |

**Example Request:**
```bash
curl -X DELETE http://127.0.0.1:8080/api/prompt-templates/bb0e8400-e29b-41d4-a716-446655440003 \
  -b cookies.txt
```

---

## 12. Prompt Settings Endpoints

### 12.1 GET /api/workspaces-team/:id/prompt-settings

**Purpose:** Get prompt enhancement settings for a workspace

**Authentication Required:** Yes

**Roles Allowed:** Viewer, Member, Admin, Owner

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
    "auto_enhance_enabled": false,
    "preferred_model": "gpt-4-turbo",
    "enhancement_style": "balanced",
    "include_codebase_context": true,
    "include_git_history": false,
    "custom_instructions": null,
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-13T15:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X GET http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/prompt-settings \
  -b cookies.txt
```

---

### 12.2 PATCH /api/workspaces-team/:id/prompt-settings

**Purpose:** Update prompt enhancement settings

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Required Permission:** `prompt.settings.edit`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Request Body:**
```json
{
  "auto_enhance_enabled": true,
  "preferred_model": "claude-3-opus",
  "enhancement_style": "comprehensive",
  "include_codebase_context": true,
  "include_git_history": true,
  "custom_instructions": "Always include error handling requirements. Prefer TypeScript over JavaScript."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| auto_enhance_enabled | boolean | No | Enable auto-enhance on task create |
| preferred_model | string | No | gpt-4, gpt-4-turbo, claude-3-opus, claude-3-sonnet, llama-3-70b |
| enhancement_style | string | No | minimal, balanced, comprehensive |
| include_codebase_context | boolean | No | Include code patterns in context |
| include_git_history | boolean | No | Include recent git commits |
| custom_instructions | string | No | Additional enhancement rules (max 2000 chars) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
    "auto_enhance_enabled": true,
    "preferred_model": "claude-3-opus",
    "enhancement_style": "comprehensive",
    "include_codebase_context": true,
    "include_git_history": true,
    "custom_instructions": "Always include error handling requirements. Prefer TypeScript over JavaScript.",
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-14T11:00:00.000Z"
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 400 | VAL_001 | Validation error |
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Insufficient permissions |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X PATCH http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/prompt-settings \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "auto_enhance_enabled": true,
    "preferred_model": "claude-3-opus"
  }'
```

---

## 13. Audit Log Endpoints

### 13.1 GET /api/workspaces-team/:id/audit-log

**Purpose:** Get audit log for a team workspace

**Authentication Required:** Yes

**Roles Allowed:** Admin, Owner

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Workspace ID |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |
| filter[entity_type] | string | No | all | task, workspace, project, attempt, member, prompt |
| filter[action] | string | No | all | created, updated, deleted, assigned, etc. |
| filter[actor_id] | UUID | No | null | Filter by actor |
| date_from | string | No | null | ISO-8601 date (inclusive) |
| date_to | string | No | null | ISO-8601 date (inclusive) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440001",
      "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440000",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "avatar_url": null
      },
      "entity_type": "task",
      "entity_id": "990e8400-e29b-41d4-a716-446655440001",
      "action": "assigned",
      "payload_json": {
        "assigned_to": "550e8400-e29b-41d4-a716-446655440001",
        "previous_assignee": null
      },
      "created_at": "2026-01-14T08:00:00.000Z"
    },
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440002",
      "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440000",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "avatar_url": null
      },
      "entity_type": "member",
      "entity_id": "550e8400-e29b-41d4-a716-446655440005",
      "action": "invited",
      "payload_json": {
        "email": "newmember@example.com",
        "role": "Member"
      },
      "created_at": "2026-01-13T18:00:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMS0xM1QxODowMDowMC4wMDBaIn0=",
    "has_more": true,
    "total_count": 125
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | Only Admin/Owner can view audit log |
| 403 | RBAC_001 | Not a workspace member |
| 404 | - | Workspace not found |

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/workspaces-team/660e8400-e29b-41d4-a716-446655440001/audit-log?filter[entity_type]=task&limit=25" \
  -b cookies.txt
```

---

### 13.2 GET /api/audit-log

**Purpose:** Get global audit log (Owner view across all owned workspaces)

**Authentication Required:** Yes

**Roles Allowed:** Workspace Owners only (returns audit from all workspaces where user is Owner)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| cursor | string | No | null | Pagination cursor |
| limit | integer | No | 50 | Items per page (max 100) |
| filter[workspace_team_id] | UUID | No | null | Filter by specific workspace |
| filter[entity_type] | string | No | all | task, workspace, project, attempt, member, prompt |
| filter[action] | string | No | all | created, updated, deleted, assigned, etc. |
| date_from | string | No | null | ISO-8601 date |
| date_to | string | No | null | ISO-8601 date |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440003",
      "workspace_team_id": "660e8400-e29b-41d4-a716-446655440001",
      "workspace": {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Engineering Team"
      },
      "actor_user_id": "550e8400-e29b-41d4-a716-446655440001",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Jane Smith",
        "avatar_url": null
      },
      "entity_type": "project",
      "entity_id": "880e8400-e29b-41d4-a716-446655440001",
      "action": "created",
      "payload_json": {
        "name": "Backend API"
      },
      "created_at": "2026-01-10T09:00:00.000Z"
    }
  ],
  "pagination": {
    "next_cursor": null,
    "has_more": false,
    "total_count": 1
  }
}
```

**Error Cases:**
| Status | Code | Message |
|--------|------|---------|
| 401 | AUTH_003 | Missing authentication |
| 403 | AUTH_004 | No owned workspaces |

**Example Request:**
```bash
curl -X GET "http://127.0.0.1:8080/api/audit-log?date_from=2026-01-01" \
  -b cookies.txt
```

---

## 14. Data Schemas

### 14.1 User

```json
{
  "id": "UUID",
  "email": "string (max 255)",
  "name": "string (max 100)",
  "avatar_url": "string | null",
  "created_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime"
}
```

### 14.2 WorkspaceTeam

```json
{
  "id": "UUID",
  "name": "string (max 100)",
  "created_by": "UUID (User.id)",
  "created_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime"
}
```

### 14.3 Role

```json
{
  "id": "UUID",
  "workspace_team_id": "UUID | null (null = global)",
  "name": "Owner | Admin | Member | Viewer",
  "is_default": "boolean",
  "created_at": "ISO-8601 datetime"
}
```

### 14.4 WorkspaceMember

```json
{
  "workspace_team_id": "UUID",
  "user_id": "UUID",
  "role_id": "UUID",
  "status": "active | invited | suspended",
  "joined_at": "ISO-8601 datetime"
}
```

### 14.5 Project

```json
{
  "id": "UUID",
  "name": "string",
  "default_agent_working_dir": "string | null",
  "team_workspace_id": "UUID | null",
  "remote_project_id": "UUID | null",
  "created_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime"
}
```

### 14.6 Task

```json
{
  "id": "UUID",
  "project_id": "UUID",
  "title": "string",
  "description": "string | null",
  "status": "todo | inprogress | inreview | done | cancelled",
  "parent_workspace_id": "UUID | null",
  "shared_task_id": "UUID | null",
  "assigned_to_user_id": "UUID | null",
  "created_by_user_id": "UUID | null",
  "visibility": "workspace | private | restricted",
  "created_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime"
}
```

### 14.7 PromptEnhancement

```json
{
  "id": "UUID",
  "task_id": "UUID",
  "original_prompt": "string",
  "enhanced_prompt": "string",
  "enhancement_model": "string",
  "techniques_applied": "string[] (JSON)",
  "original_score": "integer (0-100) | null",
  "enhanced_score": "integer (0-100) | null",
  "user_accepted": "boolean | null",
  "user_edited": "boolean | null",
  "final_prompt": "string | null",
  "created_at": "ISO-8601 datetime"
}
```

### 14.8 PromptTemplate

```json
{
  "id": "UUID",
  "workspace_team_id": "UUID | null (null = global)",
  "name": "string (max 100)",
  "description": "string | null",
  "template_text": "string",
  "category": "bug-fix | feature | refactor | docs | test | other | null",
  "is_global": "boolean",
  "usage_count": "integer",
  "created_at": "ISO-8601 datetime"
}
```

### 14.9 PromptEnhancementSettings

```json
{
  "workspace_team_id": "UUID",
  "auto_enhance_enabled": "boolean",
  "preferred_model": "string",
  "enhancement_style": "minimal | balanced | comprehensive",
  "include_codebase_context": "boolean",
  "include_git_history": "boolean",
  "custom_instructions": "string | null",
  "created_at": "ISO-8601 datetime",
  "updated_at": "ISO-8601 datetime"
}
```

### 14.10 AuditLog

```json
{
  "id": "UUID",
  "workspace_team_id": "UUID | null",
  "actor_user_id": "UUID",
  "entity_type": "task | workspace | project | attempt | member | prompt",
  "entity_id": "UUID",
  "action": "string",
  "payload_json": "object | null",
  "created_at": "ISO-8601 datetime"
}
```

### 14.11 TaskAcl

```json
{
  "task_id": "UUID",
  "user_id": "UUID",
  "access_level": "view | comment | run | admin"
}
```

---

## 15. WebSocket Events

### 15.1 Task Stream

**Endpoint:** `ws://127.0.0.1:{BACKEND_PORT}/api/tasks/stream/ws?project_id={project_id}`

**Authentication:** Session cookie required

**Events:**

```json
{
  "type": "task_created",
  "data": { /* Task object */ }
}
```

```json
{
  "type": "task_updated",
  "data": { /* Task object */ }
}
```

```json
{
  "type": "task_deleted",
  "data": { "id": "UUID" }
}
```

```json
{
  "type": "task_assigned",
  "data": {
    "task_id": "UUID",
    "assigned_to_user_id": "UUID | null"
  }
}
```

### 15.2 Project Stream

**Endpoint:** `ws://127.0.0.1:{BACKEND_PORT}/api/projects/stream/ws`

**Authentication:** Session cookie required

**Events:**

```json
{
  "type": "project_created",
  "data": { /* Project object */ }
}
```

```json
{
  "type": "project_updated",
  "data": { /* Project object */ }
}
```

```json
{
  "type": "project_deleted",
  "data": { "id": "UUID" }
}
```

---

## Appendix A: Health Check

### GET /api/health

**Purpose:** Health check endpoint

**Authentication Required:** No

**Response (200 OK):**
```json
{
  "success": true,
  "data": "OK"
}
```

---

## Appendix B: Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-13 | Initial API specification |

---

## Appendix C: Open Questions

The following items require clarification and may affect API design:

1. **Notification Delivery:** How should assignment notifications be delivered? (In-app only vs system notifications vs both) - Currently documented as in-app only.

2. **Offline Mode:** Should the app work fully offline? Currently, LLM-dependent features (prompt enhancement) require network.

3. **Session Refresh Window:** How long after expiration should session refresh be allowed? Currently assumed to be immediate (no grace period).

4. **Audit Log Retention:** How long should audit logs be retained? Currently assumed indefinite.

5. **Rate Limit Scope:** Should rate limits be per-user or per-workspace? Currently documented as per-user.

---

*This document serves as the authoritative contract between frontend and backend implementations. All deviations must be documented and agreed upon by both teams.*
