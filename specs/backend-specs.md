# Backend Specifications

> **Document Type:** Backend Architecture & Domain Model (Source of Truth)
> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Stack:** Cloudflare Workers, D1 (SQLite), R2 (Storage), AI Gateway, Access (Auth)

---

## 1. Cloudflare Stack Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE EDGE PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐   │
│   │ Cloudflare Pages │────>│ Cloudflare       │────>│ Cloudflare D1   │   │
│   │ (React Frontend) │     │ Workers (API)    │     │ (SQLite DB)     │   │
│   └──────────────────┘     └────────┬─────────┘     └─────────────────┘   │
│                                     │                                       │
│                    ┌────────────────┼────────────────┐                     │
│                    │                │                │                      │
│                    ▼                ▼                ▼                      │
│           ┌───────────────┐ ┌─────────────┐ ┌───────────────┐              │
│           │ Cloudflare R2 │ │ Cloudflare  │ │ Cloudflare    │              │
│           │ (File Storage)│ │ AI Gateway  │ │ Access (Auth) │              │
│           └───────────────┘ └─────────────┘ └───────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Stack Components

| Component | Cloudflare Service | Purpose |
|-----------|-------------------|---------|
| Frontend | **Pages** | React app hosting, global CDN |
| API | **Workers** | Edge compute, REST API |
| Database | **D1** | SQLite at the edge |
| File Storage | **R2** | Avatars, exports, attachments |
| Auth | **Access** | Zero Trust authentication |
| LLM Proxy | **AI Gateway** | OpenAI/Anthropic routing, caching |
| Secrets | **Workers Secrets** | API keys, tokens |
| KV Cache | **Workers KV** | Session cache, rate limiting |

### 1.2 Benefits of Cloudflare Stack

- **Global Edge** - Low latency worldwide
- **Serverless** - No infrastructure management
- **Integrated Auth** - Zero Trust with Access
- **Cost Effective** - Generous free tiers
- **D1 SQLite** - Familiar SQL, globally replicated
- **AI Gateway** - Built-in LLM caching and logging

---

## 2. Canonical Domain Model

This section defines all entities and their relationships. **This is the source of truth** for all other specs.

### 2.1 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          TEAM RBAC DOMAIN                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────┐     ┌──────────────────┐     ┌─────────┐                       │
│  │  User   │────<│ WorkspaceMember  │>────│  Role   │                       │
│  └────┬────┘     └────────┬─────────┘     └────┬────┘                       │
│       │                   │                    │                             │
│       │           ┌───────┴───────┐     ┌─────┴─────┐                       │
│       │           │ WorkspaceTeam │     │RolePermission│                    │
│       │           └───────┬───────┘     └─────┬─────┘                       │
│       │                   │                   │                             │
│       │           ┌───────┴───────┐     ┌─────┴─────┐                       │
│       └──────────>│   AuditLog    │     │Permission │                       │
│                   └───────────────┘     └───────────┘                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                       EXISTING VIBE KANBAN DOMAIN                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌─────────┐     ┌──────────────┐                       │
│  │   Project   │────<│  Task   │────<│  Workspace   │ (git worktree)        │
│  └─────────────┘     └────┬────┘     └──────┬───────┘                       │
│                           │                  │                               │
│                           │           ┌──────┴───────┐                       │
│                           │           │   Session    │                       │
│                           │           └──────┬───────┘                       │
│                           │                  │                               │
│                           │        ┌─────────┴─────────┐                    │
│                           │        │ExecutionProcess   │                    │
│                           │        └─────────┬─────────┘                    │
│                           │                  │                               │
│                           │        ┌─────────┴─────────┐                    │
│                           │        │CodingAgentTurn    │                    │
│                           │        └───────────────────┘                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                      AI PROMPT ENHANCEMENT DOMAIN                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐     ┌───────────────────────┐                      │
│  │ PromptEnhancement   │     │   PromptTemplate      │                      │
│  │ (per task)          │     │   (per workspace)     │                      │
│  └─────────────────────┘     └───────────────────────┘                      │
│                                                                              │
│  ┌─────────────────────────────────┐                                        │
│  │ PromptEnhancementSettings       │                                        │
│  │ (per team workspace)            │                                        │
│  └─────────────────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Entity Definitions

#### 2.2.1 User

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| email | TEXT | Yes | Unique, max 255 chars | Login email (from CF Access) |
| name | TEXT | Yes | max 100 chars | Display name |
| avatar_url | TEXT | No | Valid URL | Profile picture (R2 or external) |
| cf_access_id | TEXT | No | Unique | Cloudflare Access identity ID |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |
| updated_at | TEXT | Yes | ISO 8601 | Last update timestamp |

#### 2.2.2 WorkspaceTeam

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| name | TEXT | Yes | max 100 chars | Team workspace name |
| slug | TEXT | Yes | Unique, URL-safe | URL identifier |
| created_by | TEXT | Yes | FK → User.id | Owner user |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |
| updated_at | TEXT | Yes | ISO 8601 | Last update timestamp |

#### 2.2.3 Role

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| workspace_team_id | TEXT | No | FK → WorkspaceTeam.id | Null = global role |
| name | TEXT | Yes | Owner/Admin/Member/Viewer | Role name |
| is_default | INTEGER | Yes | 0 or 1 | Default role for new members |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |

**Global Roles (workspace_team_id = NULL):**
- Owner
- Admin
- Member
- Viewer

#### 2.2.4 Permission

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| key | TEXT | Yes | Unique, dot-notation | Permission identifier |
| description | TEXT | No | - | Human-readable description |

**Permission Keys:**
```
workspace.delete
workspace.settings
member.invite
member.remove
member.role.change
project.create
project.delete
task.create
task.assign
task.edit
task.delete
task.view.private
attempt.run
attempt.approve
prompt.enhance
prompt.template.create
prompt.settings.edit
```

#### 2.2.5 RolePermission

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| role_id | TEXT | Yes | PK, FK → Role.id | Role reference |
| permission_id | TEXT | Yes | PK, FK → Permission.id | Permission reference |

#### 2.2.6 WorkspaceMember

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| workspace_team_id | TEXT | Yes | PK, FK → WorkspaceTeam.id | Team workspace |
| user_id | TEXT | Yes | PK, FK → User.id | User reference |
| role_id | TEXT | Yes | FK → Role.id | Assigned role |
| status | TEXT | Yes | active/invited/suspended | Membership status |
| joined_at | TEXT | Yes | ISO 8601 | Join timestamp |

#### 2.2.7 AuditLog

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| workspace_team_id | TEXT | No | FK → WorkspaceTeam.id | Team context |
| actor_user_id | TEXT | Yes | FK → User.id | Who performed action |
| entity_type | TEXT | Yes | task/workspace/project/etc | Target entity type |
| entity_id | TEXT | Yes | - | Target entity ID |
| action | TEXT | Yes | created/updated/assigned/etc | Action performed |
| payload_json | TEXT | No | Valid JSON | Change details |
| created_at | TEXT | Yes | ISO 8601 | Action timestamp |

#### 2.2.8 TaskAcl

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| task_id | TEXT | Yes | PK, FK → Task.id | Task reference |
| user_id | TEXT | Yes | PK, FK → User.id | User reference |
| access_level | TEXT | Yes | view/comment/run/admin | Access level |

#### 2.2.9 Project (MODIFIED)

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| name | TEXT | Yes | - | Project name |
| default_agent_working_dir | TEXT | No | - | Default working directory |
| remote_project_id | TEXT | No | UUID | Remote sync reference |
| **team_workspace_id** | TEXT | No | FK → WorkspaceTeam.id | **Team ownership** |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |
| updated_at | TEXT | Yes | ISO 8601 | Last update timestamp |

#### 2.2.10 Task (MODIFIED)

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| project_id | TEXT | Yes | FK → Project.id | Parent project |
| title | TEXT | Yes | - | Task title |
| description | TEXT | No | - | Task description/prompt |
| status | TEXT | Yes | todo/inprogress/inreview/done/cancelled | Task status |
| parent_workspace_id | TEXT | No | FK → Workspace.id | Parent workspace reference |
| shared_task_id | TEXT | No | UUID | Remote shared task |
| **assigned_to_user_id** | TEXT | No | FK → User.id | **Assignee** |
| **created_by_user_id** | TEXT | No | FK → User.id | **Creator** |
| **visibility** | TEXT | Yes | workspace/private/restricted | **Access level** |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |
| updated_at | TEXT | Yes | ISO 8601 | Last update timestamp |

#### 2.2.11 PromptEnhancement

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| task_id | TEXT | Yes | FK → Task.id | Associated task |
| original_prompt | TEXT | Yes | - | Original prompt text |
| enhanced_prompt | TEXT | Yes | - | Enhanced prompt text |
| enhancement_model | TEXT | Yes | - | LLM used |
| techniques_applied | TEXT | Yes | JSON array | Techniques used |
| original_score | INTEGER | No | 0-100 | Original quality score |
| enhanced_score | INTEGER | No | 0-100 | Enhanced quality score |
| user_accepted | INTEGER | No | 0 or 1 | User accepted enhancement |
| user_edited | INTEGER | No | 0 or 1 | User modified enhancement |
| final_prompt | TEXT | No | - | Actually used prompt |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |

#### 2.2.12 PromptTemplate

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | TEXT | Yes | Primary Key, UUID | Unique identifier |
| workspace_team_id | TEXT | No | FK → WorkspaceTeam.id | Owner (null = global) |
| name | TEXT | Yes | max 100 chars | Template name |
| description | TEXT | No | - | Template description |
| template_text | TEXT | Yes | - | Template with {{placeholders}} |
| category | TEXT | No | bug-fix/feature/refactor/docs | Template category |
| is_global | INTEGER | Yes | 0 or 1 | Available to all |
| usage_count | INTEGER | Yes | Default: 0 | Usage counter |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |

#### 2.2.13 PromptEnhancementSettings

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| workspace_team_id | TEXT | Yes | PK, FK → WorkspaceTeam.id | Team workspace |
| auto_enhance_enabled | INTEGER | Yes | 0 or 1 | Auto-enhance on create |
| preferred_model | TEXT | Yes | gpt-4/claude-3/etc | Default LLM provider |
| enhancement_style | TEXT | Yes | minimal/balanced/comprehensive | Enhancement level |
| include_codebase_context | INTEGER | Yes | 0 or 1 | Include code context |
| include_git_history | INTEGER | Yes | 0 or 1 | Include git context |
| custom_instructions | TEXT | No | - | Additional rules |
| created_at | TEXT | Yes | ISO 8601 | Creation timestamp |
| updated_at | TEXT | Yes | ISO 8601 | Last update timestamp |

---

## 3. Database Schema (Cloudflare D1)

### 3.1 D1 Configuration

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db"
database_id = "<your-database-id>"
migrations_dir = "migrations"
```

### 3.2 Migration Files

```sql
-- migrations/0001_initial_schema.sql

-- Users table (synced from Cloudflare Access)
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    cf_access_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cf_access_id ON users(cf_access_id);

-- Team Workspaces
CREATE TABLE workspaces_team (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_workspaces_team_slug ON workspaces_team(slug);
CREATE INDEX idx_workspaces_team_created_by ON workspaces_team(created_by);

-- Roles
CREATE TABLE roles (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('Owner', 'Admin', 'Member', 'Viewer')),
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_roles_workspace_team ON roles(workspace_team_id);

-- Permissions
CREATE TABLE permissions (
    id TEXT PRIMARY KEY NOT NULL,
    key TEXT NOT NULL UNIQUE,
    description TEXT
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Workspace Members
CREATE TABLE workspace_members (
    workspace_team_id TEXT NOT NULL REFERENCES workspaces_team(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workspace_team_id, user_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- Audit Log
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE SET NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_workspace_team ON audit_log(workspace_team_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Task ACL for restricted visibility
CREATE TABLE task_acl (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL CHECK (access_level IN ('view', 'comment', 'run', 'admin')),
    PRIMARY KEY (task_id, user_id)
);

-- Prompt Enhancements
CREATE TABLE prompt_enhancements (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
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

CREATE INDEX idx_prompt_enhancements_task ON prompt_enhancements(task_id);

-- Prompt Templates
CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_team_id TEXT REFERENCES workspaces_team(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    template_text TEXT NOT NULL,
    category TEXT CHECK (category IN ('bug-fix', 'feature', 'refactor', 'docs', 'test', 'other')),
    is_global INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prompt_templates_workspace ON prompt_templates(workspace_team_id);

-- Prompt Enhancement Settings
CREATE TABLE prompt_enhancement_settings (
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
```

```sql
-- migrations/0002_modify_existing_tables.sql

-- Add team and assignment columns to tasks
ALTER TABLE tasks ADD COLUMN assigned_to_user_id TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'workspace'
    CHECK (visibility IN ('workspace', 'private', 'restricted'));

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_created_by ON tasks(created_by_user_id);
CREATE INDEX idx_tasks_visibility ON tasks(visibility);

-- Add team workspace to projects
ALTER TABLE projects ADD COLUMN team_workspace_id TEXT REFERENCES workspaces_team(id) ON DELETE SET NULL;

CREATE INDEX idx_projects_team_workspace ON projects(team_workspace_id);
```

```sql
-- migrations/0003_seed_roles_permissions.sql

-- Global roles
INSERT INTO roles (id, workspace_team_id, name, is_default) VALUES
    ('role-owner', NULL, 'Owner', 0),
    ('role-admin', NULL, 'Admin', 0),
    ('role-member', NULL, 'Member', 1),
    ('role-viewer', NULL, 'Viewer', 0);

-- Permissions
INSERT INTO permissions (id, key, description) VALUES
    ('perm-ws-delete', 'workspace.delete', 'Delete team workspace'),
    ('perm-ws-settings', 'workspace.settings', 'Modify workspace settings'),
    ('perm-mem-invite', 'member.invite', 'Invite new members'),
    ('perm-mem-remove', 'member.remove', 'Remove members'),
    ('perm-mem-role', 'member.role.change', 'Change member roles'),
    ('perm-proj-create', 'project.create', 'Create projects'),
    ('perm-proj-delete', 'project.delete', 'Delete projects'),
    ('perm-task-create', 'task.create', 'Create tasks'),
    ('perm-task-assign', 'task.assign', 'Assign tasks'),
    ('perm-task-edit', 'task.edit', 'Edit tasks'),
    ('perm-task-delete', 'task.delete', 'Delete tasks'),
    ('perm-task-private', 'task.view.private', 'View private tasks'),
    ('perm-attempt-run', 'attempt.run', 'Run agent attempts'),
    ('perm-attempt-approve', 'attempt.approve', 'Approve attempt results'),
    ('perm-prompt-enhance', 'prompt.enhance', 'Use prompt enhancement'),
    ('perm-prompt-template', 'prompt.template.create', 'Create prompt templates'),
    ('perm-prompt-settings', 'prompt.settings.edit', 'Edit prompt settings');

-- Owner permissions (all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-owner', id FROM permissions;

-- Admin permissions (all except workspace.delete)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-admin', id FROM permissions WHERE key != 'workspace.delete';

-- Member permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-member', id FROM permissions
WHERE key IN ('project.create', 'task.create', 'task.edit', 'task.assign', 'attempt.run', 'attempt.approve', 'prompt.enhance');

-- Viewer has no write permissions (implicit)
```

---

## 4. Authentication & Authorization

### 4.1 Cloudflare Access Authentication

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   User Browser  │────>│ Cloudflare Access│────>│ Identity Provider│
└─────────────────┘     │ (Zero Trust)     │     │ (Google, GitHub) │
                        └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ CF-Access-JWT    │
                        │ (Cookie)         │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Workers API      │
                        │ (Validates JWT)  │
                        └──────────────────┘
```

### 4.2 Access Application Setup

```yaml
# Cloudflare Access Application
application:
  name: "Vibe Kanban"
  domain: "vibe-kanban.your-domain.com"
  type: "self_hosted"
  session_duration: "30d"  # 30 day sessions

identity_providers:
  - Google
  - GitHub
  - Email OTP

policies:
  - name: "Allow authenticated users"
    decision: "allow"
    include:
      - everyone: true
```

### 4.3 JWT Validation in Workers

```typescript
// src/middleware/auth.ts
import { Context } from 'hono';
import { verify } from '@cloudflare/workers-types';

interface AccessJWT {
  sub: string;           // User ID
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export async function validateAccessJWT(c: Context): Promise<AccessJWT | null> {
  const jwt = c.req.header('CF-Access-JWT-Assertion');
  if (!jwt) return null;

  try {
    const payload = await verify(jwt, {
      audience: c.env.CF_ACCESS_AUD,
      issuer: `https://${c.env.CF_ACCESS_TEAM}.cloudflareaccess.com`,
    });
    return payload as AccessJWT;
  } catch {
    return null;
  }
}

export async function requireAuth(c: Context, next: () => Promise<void>) {
  const jwt = await validateAccessJWT(c);
  if (!jwt) {
    return c.json({ error: { code: 'AUTH_003', message: 'Authentication required' } }, 401);
  }

  // Upsert user in D1
  const user = await upsertUser(c.env.DB, jwt);
  c.set('user', user);

  await next();
}
```

### 4.4 Authorization Middleware

```typescript
// src/middleware/rbac.ts
export async function requirePermission(permission: string) {
  return async (c: Context, next: () => Promise<void>) => {
    const user = c.get('user');
    const workspaceId = c.req.param('workspaceId');

    const hasPermission = await checkPermission(c.env.DB, user.id, workspaceId, permission);
    if (!hasPermission) {
      return c.json({
        error: { code: 'AUTH_004', message: 'Insufficient permissions' }
      }, 403);
    }

    await next();
  };
}

async function checkPermission(
  db: D1Database,
  userId: string,
  workspaceId: string,
  permission: string
): Promise<boolean> {
  const result = await db.prepare(`
    SELECT 1 FROM workspace_members wm
    JOIN roles r ON wm.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE wm.user_id = ? AND wm.workspace_team_id = ? AND p.key = ?
  `).bind(userId, workspaceId, permission).first();

  return result !== null;
}
```

---

## 5. Workers API Architecture

### 5.1 Project Structure

```
workers/
├── src/
│   ├── index.ts              # Main entry, Hono app
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/*
│   │   ├── users.ts          # /api/users/*
│   │   ├── workspaces.ts     # /api/workspaces-team/*
│   │   ├── members.ts        # /api/workspaces-team/:id/members/*
│   │   ├── projects.ts       # /api/projects/*
│   │   ├── tasks.ts          # /api/tasks/*
│   │   ├── prompts.ts        # /api/prompts/*
│   │   ├── templates.ts      # /api/prompt-templates/*
│   │   └── audit.ts          # /api/audit/*
│   ├── middleware/
│   │   ├── auth.ts           # CF Access JWT validation
│   │   ├── rbac.ts           # Permission checking
│   │   └── rateLimit.ts      # KV-based rate limiting
│   ├── services/
│   │   ├── ai-gateway.ts     # AI Gateway client
│   │   ├── r2.ts             # R2 storage client
│   │   └── audit.ts          # Audit logging
│   └── utils/
│       ├── db.ts             # D1 helpers
│       └── validation.ts     # Zod schemas
├── wrangler.toml
└── package.json
```

### 5.2 Wrangler Configuration

```toml
# wrangler.toml
name = "vibe-kanban-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
CF_ACCESS_TEAM = "your-team"
CF_ACCESS_AUD = "your-access-application-aud"

[[d1_databases]]
binding = "DB"
database_name = "vibe-kanban"
database_id = "xxxxx-xxxxx-xxxxx"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "R2"
bucket_name = "vibe-kanban-storage"

[[kv_namespaces]]
binding = "KV"
id = "xxxxx"

[ai]
binding = "AI"

# AI Gateway configuration
[[ai.gateway]]
id = "vibe-kanban-gateway"
binding = "AI_GATEWAY"
```

### 5.3 Main Application (Hono)

```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './middleware/auth';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { workspaceRoutes } from './routes/workspaces';
import { taskRoutes } from './routes/tasks';
import { promptRoutes } from './routes/prompts';

type Bindings = {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  AI_GATEWAY: Ai;
  CF_ACCESS_TEAM: string;
  CF_ACCESS_AUD: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Pages frontend
app.use('/*', cors({
  origin: ['https://vibe-kanban.pages.dev', 'http://localhost:5173'],
  credentials: true,
}));

// Health check (public)
app.get('/api/health', (c) => c.json({ status: 'healthy' }));

// Protected routes
app.use('/api/*', requireAuth);

// Mount route modules
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/workspaces-team', workspaceRoutes);
app.route('/api/tasks', taskRoutes);
app.route('/api/prompts', promptRoutes);

export default app;
```

---

## 6. Cloudflare R2 Storage

### 6.1 Use Cases

| Content Type | Path Pattern | Access |
|--------------|--------------|--------|
| User Avatars | `avatars/{userId}.{ext}` | Public |
| Task Attachments | `attachments/{taskId}/{filename}` | Authenticated |
| Audit Exports | `exports/{workspaceId}/{date}.json` | Authenticated |
| Template Exports | `templates/{workspaceId}/{templateId}.json` | Authenticated |

### 6.2 R2 Operations

```typescript
// src/services/r2.ts
export async function uploadAvatar(
  r2: R2Bucket,
  userId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop();
  const key = `avatars/${userId}.${ext}`;

  await r2.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
    },
  });

  return `https://storage.vibe-kanban.com/${key}`;
}

export async function uploadAttachment(
  r2: R2Bucket,
  taskId: string,
  file: File
): Promise<{ key: string; url: string }> {
  const key = `attachments/${taskId}/${file.name}`;

  await r2.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { taskId },
  });

  return { key, url: `/api/attachments/${key}` };
}

export async function exportAuditLog(
  r2: R2Bucket,
  workspaceId: string,
  data: object
): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const key = `exports/${workspaceId}/audit-${date}.json`;

  await r2.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });

  return key;
}
```

---

## 7. Workers KV for Caching

### 7.1 Cache Patterns

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `session:{userId}` | 30d | Session data cache |
| `ratelimit:{userId}:{action}` | 1h | Rate limit counters |
| `permissions:{userId}:{workspaceId}` | 5m | Permission cache |
| `prompt-cache:{hash}` | 24h | LLM response cache |

### 7.2 Rate Limiting

```typescript
// src/middleware/rateLimit.ts
export async function rateLimit(
  kv: KVNamespace,
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `ratelimit:${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  const data = await kv.get(key, 'json') as { timestamps: number[] } | null;
  const timestamps = data?.timestamps?.filter(t => t > windowStart) || [];

  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  await kv.put(key, JSON.stringify({ timestamps }), { expirationTtl: windowMs / 1000 });

  return { allowed: true, remaining: limit - timestamps.length };
}
```

---

## 8. Error Handling

### 8.1 Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

### 8.2 Error Code Taxonomy

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

---

## 9. Deployment

### 9.1 Pages Deployment (Frontend)

```yaml
# .github/workflows/deploy-pages.yml
name: Deploy to Pages

on:
  push:
    branches: [main]
    paths: ['frontend/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build frontend
        working-directory: frontend
        run: |
          npm ci
          npm run build

      - name: Deploy to Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: vibe-kanban
          directory: frontend/dist
```

### 9.2 Workers Deployment (API)

```yaml
# .github/workflows/deploy-workers.yml
name: Deploy Workers

on:
  push:
    branches: [main]
    paths: ['workers/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: workers
        run: npm ci

      - name: Run migrations
        working-directory: workers
        run: npx wrangler d1 migrations apply vibe-kanban --remote
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

      - name: Deploy Worker
        working-directory: workers
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

### 9.3 Environment URLs

| Environment | Frontend URL | API URL |
|-------------|--------------|---------|
| Production | `https://vibe-kanban.pages.dev` | `https://api.vibe-kanban.workers.dev` |
| Preview | `https://{branch}.vibe-kanban.pages.dev` | `https://{branch}.api.vibe-kanban.workers.dev` |
| Local | `http://localhost:5173` | `http://localhost:8787` |

---

## 10. Local Development

### 10.1 Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 10.2 Local Commands

```bash
# Start Workers dev server
cd workers
wrangler dev

# Run D1 migrations locally
wrangler d1 migrations apply vibe-kanban --local

# Start Pages dev server
cd frontend
npm run dev
```

### 10.3 Local Environment Variables

```env
# .dev.vars (Workers)
CF_ACCESS_TEAM=your-team
CF_ACCESS_AUD=your-aud
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## 11. Security Considerations

### 11.1 Cloudflare Access Benefits

- **Zero Trust** - All requests authenticated at edge
- **SSO Integration** - Google, GitHub, SAML, OIDC
- **Session Management** - 30-day sessions with refresh
- **Audit Logging** - Built-in access logs

### 11.2 Data Protection

- **D1 Encryption** - Data encrypted at rest
- **R2 Encryption** - Objects encrypted at rest
- **Workers Secrets** - Encrypted secret storage
- **HTTPS Only** - All traffic encrypted in transit

### 11.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/prompts/enhance | 20 | 1 hour |
| POST /api/auth/* | 10 | 15 min |
| All other endpoints | 1000 | 1 min |

---

## 12. Migration from Existing Stack

### 12.1 Migration Path

1. **Export existing SQLite data** to JSON
2. **Import to D1** via Wrangler
3. **Migrate file storage** to R2
4. **Update frontend** API base URL
5. **Configure CF Access** for auth

### 12.2 Data Migration Script

```typescript
// scripts/migrate-to-d1.ts
import { readFileSync } from 'fs';

async function migrateToD1() {
  // Export from local SQLite
  const data = JSON.parse(readFileSync('export.json', 'utf-8'));

  // Import to D1
  for (const project of data.projects) {
    await db.prepare('INSERT INTO projects (id, name, ...) VALUES (?, ?, ...)')
      .bind(project.id, project.name, ...)
      .run();
  }

  // ... repeat for other tables
}
```
