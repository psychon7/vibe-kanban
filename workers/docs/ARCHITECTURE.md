# Vibe Kanban API - Architecture Documentation

> Generated: 2026-01-14

## Overview

Vibe Kanban is a task management API built on **Cloudflare Workers** using the **Hono** framework. It provides team workspace management, project organization, task tracking with role-based access control (RBAC), and AI-powered prompt enhancement capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE NETWORK                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────────────────────┐    │
│  │   Clients    │───▶│              Cloudflare Workers                     │    │
│  │  (Web/API)   │    │                                                     │    │
│  └──────────────┘    │  ┌─────────────────────────────────────────────┐   │    │
│                      │  │              Hono Application                │   │    │
│                      │  │                                              │   │    │
│                      │  │  ┌────────────────────────────────────────┐ │   │    │
│                      │  │  │           Middleware Stack             │ │   │    │
│                      │  │  │  • CORS • Logger • SecureHeaders       │ │   │    │
│                      │  │  │  • Request ID • Timing • Error Handler │ │   │    │
│                      │  │  │  • Auth • Workspace Context            │ │   │    │
│                      │  │  │  • Permission Checks • Membership      │ │   │    │
│                      │  │  └────────────────────────────────────────┘ │   │    │
│                      │  │                      │                      │   │    │
│                      │  │  ┌────────────────────────────────────────┐ │   │    │
│                      │  │  │            Route Handlers              │ │   │    │
│                      │  │  │  /api/v1/auth       /api/v1/audit      │ │   │    │
│                      │  │  │  /api/v1/users      /api/v1/prompts    │ │   │    │
│                      │  │  │  /api/v1/workspaces /api/v1/tasks      │ │   │    │
│                      │  │  │  /api/v1/projects                      │ │   │    │
│                      │  │  └────────────────────────────────────────┘ │   │    │
│                      │  └─────────────────────────────────────────────┘   │    │
│                      └───────────────┬──────┬──────┬──────┬───────────────┘    │
│                                      │      │      │      │                     │
│  ┌───────────────┐  ┌───────────────┐│      │      │      │┌───────────────┐   │
│  │   D1 Database │◀─┘               ││      │      │      ││  AI Gateway   │   │
│  │   (SQLite)    │   ┌──────────────┘│      │      │      ││  (Workers AI) │   │
│  │               │   │               │      │      │      │└───────────────┘   │
│  │ • users       │   ▼               ▼      │      │                           │
│  │ • workspaces  │  ┌───────────────┐│      │      │                           │
│  │ • projects    │  │  KV Namespace ││      │      │                           │
│  │ • tasks       │  │    (CACHE)    ││      │      │                           │
│  │ • roles       │  │               ││      │      │                           │
│  │ • permissions │  │ • Sessions    ││      │      │                           │
│  │ • audit_log   │  │ • Rate limits ││      │      │                           │
│  │ • prompts     │  └───────────────┘│      │      │                           │
│  └───────────────┘                   │      │      │                           │
│                                      ▼      │      │                           │
│                      ┌───────────────┐      │      │                           │
│                      │  R2 Storage   │◀─────┘      │                           │
│                      │   (STORAGE)   │             │                           │
│                      │               │             │                           │
│                      │ • Avatars     │             │                           │
│                      │ • Exports     │             │                           │
│                      │ • Attachments │             │                           │
│                      └───────────────┘             │                           │
│                                                    │                           │
└────────────────────────────────────────────────────┼───────────────────────────┘
                                                     │
                                                     ▼
                                        ┌───────────────────────┐
                                        │  Cloudflare Pages     │
                                        │  (Frontend - React)   │
                                        └───────────────────────┘
```

## Cloudflare Services Resource Map

| Service | Binding | Purpose | Environments |
|---------|---------|---------|--------------|
| **D1 Database** | `DB` | Primary data store (SQLite) | dev, staging, production |
| **R2 Storage** | `STORAGE` | File storage (avatars, exports) | dev, staging, production |
| **KV Namespace** | `CACHE` | Session cache, rate limiting | dev, staging, production |
| **Workers AI** | `AI` | LLM prompt enhancement | dev, staging, production |
| **Cloudflare Pages** | - | Frontend hosting | staging, production |

### Environment Configuration

| Environment | Database ID | CORS Origin |
|-------------|-------------|-------------|
| Development | `161a7750-7a11-4fa8-961c-3417afcc52c1` | `http://localhost:5173` |
| Staging | `668581ef-bfd4-4c11-84c0-1ba6bd043eb6` | `https://staging.vibe-kanban.pages.dev` |
| Production | `783e3bee-b734-4ff1-8b4b-9cbe9e599ac8` | `https://vibe-kanban.pages.dev` |

## Request Flow

```
┌─────────┐     ┌─────────────────────────────────────────────────────────────────┐
│ Request │────▶│                    Middleware Pipeline                          │
└─────────┘     │                                                                 │
                │  ┌──────────┐ ┌────────┐ ┌──────────────┐ ┌───────────────────┐│
                │  │RequestID │▶│ Timing │▶│   Logger     │▶│  SecureHeaders    ││
                │  └──────────┘ └────────┘ └──────────────┘ └───────────────────┘│
                │        │                                            │           │
                │        ▼                                            ▼           │
                │  ┌──────────┐ ┌────────────────────┐ ┌──────────────────────┐  │
                │  │   CORS   │▶│  requireAuth()     │▶│  workspaceContext()  │  │
                │  └──────────┘ └────────────────────┘ └──────────────────────┘  │
                │        │                                            │           │
                │        ▼                                            ▼           │
                │  ┌──────────────────────┐ ┌─────────────────────────────────┐  │
                │  │ requireMembership()  │▶│  requirePermission(permission)  │  │
                │  └──────────────────────┘ └─────────────────────────────────┘  │
                │                                            │                    │
                └────────────────────────────────────────────┼────────────────────┘
                                                             │
                                                             ▼
                                                    ┌─────────────────┐
                                                    │  Route Handler  │
                                                    └─────────────────┘
                                                             │
                                                             ▼
                ┌─────────────────────────────────────────────────────────────────┐
                │                     Error Handler                               │
                │  • ZodError → 400 Validation Error                              │
                │  • ApiError → Custom status with code                           │
                │  • HTTPException → Mapped status                                │
                │  • Unknown → 500 Internal Error                                 │
                └─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Authentication Flow

```
┌─────────┐    ┌─────────────────┐    ┌────────────────┐    ┌──────────────┐
│  User   │───▶│ POST /auth/login│───▶│ Verify Password│───▶│Create Session│
└─────────┘    └─────────────────┘    │   (PBKDF2)     │    │   in KV      │
                                      └────────────────┘    └──────┬───────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────┐
                                                          │ Return Token │
                                                          │ + User Data  │
                                                          └──────────────┘
```

### Task Creation Flow

```
┌─────────┐    ┌──────────────┐    ┌────────────────┐    ┌───────────────┐
│  User   │───▶│ POST /tasks  │───▶│ Check Project  │───▶│ Verify Assignee│
└─────────┘    │              │    │ Exists in      │    │ is Workspace   │
               │ + Auth Token │    │ Workspace      │    │ Member        │
               │ + Workspace  │    └────────────────┘    └───────┬───────┘
               │   Header     │                                  │
               └──────────────┘                                  ▼
                                                         ┌──────────────┐
                                                         │ Insert Task  │
                                                         │ into D1      │
                                                         └──────┬───────┘
                                                                │
                                                                ▼
                                                         ┌──────────────┐
                                                         │Return Created│
                                                         │    Task      │
                                                         └──────────────┘
```

### Prompt Enhancement Flow

```
┌─────────┐    ┌────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  User   │───▶│POST /prompts/  │───▶│Score Original   │───▶│Build System      │
└─────────┘    │    enhance     │    │    Prompt       │    │   Prompt         │
               └────────────────┘    └─────────────────┘    └────────┬─────────┘
                                                                     │
                                                                     ▼
┌──────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌───────────────┐
│Return Enhanced│◀───│ Store in        │◀───│Score Enhanced │◀───│ Call Workers  │
│Prompt + Scores│    │ prompt_enhance- │    │    Prompt     │    │ AI (LLaMA)    │
└──────────────┘    │ ments table     │    └────────────────┘    └───────────────┘
```

## Database Schema

```
┌─────────────────┐       ┌───────────────────────┐       ┌──────────────────┐
│     users       │       │   workspaces_team     │       │      roles       │
├─────────────────┤       ├───────────────────────┤       ├──────────────────┤
│ id (PK)         │       │ id (PK)               │       │ id (PK)          │
│ email           │◀──────│ created_by (FK)       │       │ workspace_team_id│
│ name            │       │ name                  │       │ name             │
│ password_hash   │       │ slug                  │       │ is_default       │
│ avatar_url      │       │ created_at            │       └────────┬─────────┘
│ cf_access_id    │       │ updated_at            │                │
│ created_at      │       └───────────┬───────────┘                │
│ updated_at      │                   │                            │
└────────┬────────┘                   │                            │
         │                            │                            │
         │       ┌────────────────────┴────────────────────────────┘
         │       │
         ▼       ▼
┌─────────────────────────┐       ┌──────────────────────────────┐
│   workspace_members     │       │         permissions          │
├─────────────────────────┤       ├──────────────────────────────┤
│ workspace_team_id (PK)  │       │ id (PK)                      │
│ user_id (PK, FK)        │       │ key (UNIQUE)                 │
│ role_id (FK)            │       │ description                  │
│ status                  │       └─────────────┬────────────────┘
│ joined_at               │                     │
└─────────────────────────┘                     │
                                                ▼
                                  ┌──────────────────────────────┐
                                  │       role_permissions       │
                                  ├──────────────────────────────┤
                                  │ role_id (PK, FK)             │
                                  │ permission_id (PK, FK)       │
                                  └──────────────────────────────┘

┌──────────────────┐       ┌──────────────────────────────┐
│     projects     │       │            tasks             │
├──────────────────┤       ├──────────────────────────────┤
│ id (PK)          │◀──────│ project_id (FK)              │
│ workspace_team_id│       │ id (PK)                      │
│ name             │       │ title                        │
│ description      │       │ description                  │
│ status           │       │ status                       │
│ created_by (FK)  │       │ priority                     │
│ created_at       │       │ assigned_to_user_id (FK)     │
│ updated_at       │       │ created_by_user_id (FK)      │
└──────────────────┘       │ visibility                   │
                           │ due_date                     │
                           │ created_at                   │
                           │ updated_at                   │
                           └──────────────────────────────┘

┌──────────────────────────────┐       ┌──────────────────────────────┐
│          task_acl            │       │       prompt_enhancements    │
├──────────────────────────────┤       ├──────────────────────────────┤
│ task_id (PK)                 │       │ id (PK)                      │
│ user_id (PK, FK)             │       │ task_id (FK)                 │
│ access_level                 │       │ original_prompt              │
│ created_at                   │       │ enhanced_prompt              │
└──────────────────────────────┘       │ enhancement_model            │
                                       │ techniques_applied           │
┌──────────────────────────────┐       │ original_score               │
│       prompt_templates       │       │ enhanced_score               │
├──────────────────────────────┤       │ user_accepted                │
│ id (PK)                      │       │ user_edited                  │
│ workspace_team_id (FK)       │       │ final_prompt                 │
│ name                         │       │ created_at                   │
│ description                  │       └──────────────────────────────┘
│ template_text                │
│ category                     │       ┌──────────────────────────────┐
│ is_global                    │       │         audit_log            │
│ usage_count                  │       ├──────────────────────────────┤
│ created_by (FK)              │       │ id (PK)                      │
│ created_at                   │       │ workspace_team_id (FK)       │
│ updated_at                   │       │ actor_user_id (FK)           │
└──────────────────────────────┘       │ entity_type                  │
                                       │ entity_id                    │
                                       │ action                       │
                                       │ payload_json                 │
                                       │ created_at                   │
                                       └──────────────────────────────┘
```

## RBAC (Role-Based Access Control)

### Roles Hierarchy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              ROLE PERMISSIONS                                 │
├──────────┬──────────────────┬────────────────┬───────────────┬───────────────┤
│Permission│      Owner       │     Admin      │    Member     │    Viewer     │
├──────────┼──────────────────┼────────────────┼───────────────┼───────────────┤
│Workspace │                  │                │               │               │
│ .delete  │        ✓         │       ✗        │       ✗       │       ✗       │
│ .settings│        ✓         │       ✓        │       ✗       │       ✗       │
├──────────┼──────────────────┼────────────────┼───────────────┼───────────────┤
│Member    │                  │                │               │               │
│ .invite  │        ✓         │       ✓        │       ✗       │       ✗       │
│ .remove  │        ✓         │       ✓        │       ✗       │       ✗       │
│ .role    │        ✓         │       ✓        │       ✗       │       ✗       │
├──────────┼──────────────────┼────────────────┼───────────────┼───────────────┤
│Project   │                  │                │               │               │
│ .create  │        ✓         │       ✓        │       ✓       │       ✗       │
│ .delete  │        ✓         │       ✓        │       ✗       │       ✗       │
│ .edit    │        ✓         │       ✓        │       ✗       │       ✗       │
├──────────┼──────────────────┼────────────────┼───────────────┼───────────────┤
│Task      │                  │                │               │               │
│ .create  │        ✓         │       ✓        │       ✓       │       ✗       │
│ .edit    │        ✓         │       ✓        │       ✓       │       ✗       │
│ .assign  │        ✓         │       ✓        │       ✓       │       ✗       │
│ .delete  │        ✓         │       ✓        │       ✗       │       ✗       │
├──────────┼──────────────────┼────────────────┼───────────────┼───────────────┤
│Prompt    │                  │                │               │               │
│ .enhance │        ✓         │       ✓        │       ✓       │       ✗       │
│ .template│        ✓         │       ✓        │       ✗       │       ✗       │
│ .settings│        ✓         │       ✓        │       ✗       │       ✗       │
└──────────┴──────────────────┴────────────────┴───────────────┴───────────────┘
```

### Task Visibility Levels

| Level | Description |
|-------|-------------|
| `workspace` | Visible to all workspace members |
| `private` | Visible only to task creator |
| `restricted` | Visible to creator + users in `task_acl` |

## Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY LAYERS                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 1: Transport Security (Cloudflare Edge)                           │ │
│  │ • Automatic HTTPS/TLS termination                                       │ │
│  │ • DDoS protection                                                       │ │
│  │ • WAF (Web Application Firewall)                                        │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 2: Application Security (Hono Middleware)                         │ │
│  │ • CORS with origin validation                                           │ │
│  │ • Secure headers (CSP, XSS protection, etc.)                            │ │
│  │ • Request ID for tracing                                                │ │
│  │ • Rate limiting (via KV)                                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 3: Authentication                                                  │ │
│  │ • Bearer token validation                                               │ │
│  │ • Session management in KV (24hr expiry)                                │ │
│  │ • Password hashing with PBKDF2 (100,000 iterations, SHA-256)            │ │
│  │ • Optional Cloudflare Access integration                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 4: Authorization (RBAC)                                           │ │
│  │ • Role-based permission checks                                          │ │
│  │ • Workspace membership validation                                       │ │
│  │ • Task visibility enforcement                                           │ │
│  │ • Resource ownership verification                                       │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 5: Data Validation                                                │ │
│  │ • Zod schema validation on all inputs                                   │ │
│  │ • SQL injection prevention via prepared statements                      │ │
│  │ • UUID format validation                                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 6: Audit & Monitoring                                             │ │
│  │ • Comprehensive audit logging                                           │ │
│  │ • Request/response timing                                               │ │
│  │ • Error tracking with request IDs                                       │ │
│  │ • Export capabilities to R2                                             │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Tech Stack Summary

| Component | Technology |
|-----------|------------|
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono v4.x |
| **Database** | Cloudflare D1 (SQLite) |
| **Object Storage** | Cloudflare R2 |
| **Cache/Sessions** | Cloudflare KV |
| **AI/LLM** | Cloudflare Workers AI |
| **Validation** | Zod |
| **Language** | TypeScript |
| **Frontend** | React + Vite + Tailwind |
| **Testing** | Vitest |

## Directory Structure

```
workers/
├── src/
│   ├── index.ts              # Main Hono app entry point
│   ├── types/
│   │   └── env.ts            # Environment bindings interface
│   ├── middleware/
│   │   ├── index.ts          # Middleware exports
│   │   ├── auth.ts           # Authentication & workspace context
│   │   ├── permissions.ts    # RBAC permission checks
│   │   ├── error-handler.ts  # Global error handling
│   │   └── request-id.ts     # Request ID generation
│   ├── routes/
│   │   ├── index.ts          # Route exports
│   │   ├── auth.ts           # /api/v1/auth/*
│   │   ├── users.ts          # /api/v1/users/*
│   │   ├── workspaces.ts     # /api/v1/workspaces/*
│   │   ├── projects.ts       # /api/v1/projects/*
│   │   ├── tasks.ts          # /api/v1/tasks/*
│   │   ├── prompts.ts        # /api/v1/prompts/*
│   │   └── audit.ts          # /api/v1/audit/*
│   ├── schemas/
│   │   ├── index.ts          # Schema exports
│   │   ├── auth.ts           # Auth validation schemas
│   │   ├── workspace.ts      # Workspace schemas
│   │   ├── project.ts        # Project schemas
│   │   └── task.ts           # Task schemas
│   └── utils/
│       ├── index.ts          # Utility exports
│       ├── password.ts       # PBKDF2 password hashing
│       └── session.ts        # KV session management
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_seed_roles_permissions.sql
│   ├── 0003_add_password_hash.sql
│   └── 0004_projects_tasks.sql
├── frontend/                 # React frontend app
├── docs/                     # Documentation
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json
├── vitest.config.ts
└── package.json
```
