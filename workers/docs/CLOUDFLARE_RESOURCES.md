# Vibe Kanban - Cloudflare Services Resource Mapping

> Generated: 2026-01-14

This document provides a comprehensive mapping of all Cloudflare services used in the Vibe Kanban application.

## Service Overview

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE SERVICES TOPOLOGY                             │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                           ┌─────────────────────┐                               │
│                           │   Cloudflare Edge   │                               │
│                           │   (Global Network)  │                               │
│                           └──────────┬──────────┘                               │
│                                      │                                          │
│            ┌─────────────────────────┼─────────────────────────┐               │
│            │                         │                         │               │
│            ▼                         ▼                         ▼               │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐         │
│   │ Cloudflare Pages│     │Cloudflare Workers│     │ Cloudflare DNS  │         │
│   │   (Frontend)    │     │    (API/Backend) │     │                 │         │
│   │                 │     │                  │     │                 │         │
│   │ • React SPA     │     │ • Hono Framework │     │ • Domain mgmt   │         │
│   │ • Static assets │     │ • API routes     │     │ • SSL/TLS       │         │
│   └────────┬────────┘     └────────┬─────────┘     └─────────────────┘         │
│            │                       │                                            │
│            │                       │                                            │
│            │         ┌─────────────┼─────────────────────┐                     │
│            │         │             │                     │                     │
│            │         ▼             ▼                     ▼                     │
│            │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│            │   │    D1    │  │    KV    │  │    R2    │  │Workers AI│         │
│            │   │ Database │  │ Namespace│  │ Storage  │  │ Gateway  │         │
│            │   │          │  │          │  │          │  │          │         │
│            │   │ • SQLite │  │ • Session│  │ • Files  │  │ • LLaMA  │         │
│            │   │ • ACID   │  │ • Cache  │  │ • Exports│  │ • Prompt │         │
│            │   │ • SQL    │  │ • Rate   │  │ • Avatars│  │   enhance│         │
│            │   └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│            │                                                                    │
│            └───────────────────── API Calls ───────────────────────────────────│
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Cloudflare Workers

**Purpose:** API backend runtime

### Configuration

```toml
# wrangler.toml
name = "vibe-kanban-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[dev]
port = 8787
local_protocol = "http"
```

### Environment Variables

| Variable | Development | Staging | Production |
|----------|-------------|---------|------------|
| `ENVIRONMENT` | `development` | `staging` | `production` |
| `LOG_LEVEL` | `debug` | `debug` | `info` |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://staging.vibe-kanban.pages.dev` | `https://vibe-kanban.pages.dev` |

### Secrets (via `wrangler secret put`)

| Secret | Purpose | Required |
|--------|---------|----------|
| `JWT_SECRET` | Session token signing | Yes |
| `OPENAI_API_KEY` | Prompt enhancement (optional) | No |
| `ANTHROPIC_API_KEY` | Claude integration (optional) | No |
| `CF_ACCESS_CLIENT_ID` | Cloudflare Access auth | No |
| `CF_ACCESS_CLIENT_SECRET` | Cloudflare Access auth | No |

---

## 2. D1 Database (SQLite)

**Purpose:** Primary data store

### Binding Configuration

```toml
# Development
[[d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db"
database_id = "161a7750-7a11-4fa8-961c-3417afcc52c1"
migrations_dir = "migrations"

# Staging
[[env.staging.d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db-staging"
database_id = "668581ef-bfd4-4c11-84c0-1ba6bd043eb6"

# Production
[[env.production.d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db-production"
database_id = "783e3bee-b734-4ff1-8b4b-9cbe9e599ac8"
```

### Database Schema Tables

| Table | Purpose | Est. Row Count |
|-------|---------|----------------|
| `users` | User accounts | Low-Medium |
| `workspaces_team` | Team workspaces | Low |
| `workspace_members` | Workspace membership | Low-Medium |
| `workspace_invitations` | Pending invites | Low |
| `roles` | RBAC roles | Fixed (4) |
| `permissions` | Permission definitions | Fixed (~20) |
| `role_permissions` | Role-permission mapping | Fixed (~50) |
| `projects` | Project containers | Medium |
| `tasks` | Task items | High |
| `task_acl` | Task access control | Medium |
| `prompt_enhancements` | AI enhancement history | High |
| `prompt_templates` | Reusable templates | Low |
| `prompt_enhancement_settings` | Workspace AI settings | Low |
| `audit_log` | Activity history | Very High |
| `user_sessions` | Session tracking | Medium |
| `rate_limits` | Rate limit counters | Medium |

### Key Queries by Volume

| Query Type | Frequency | Index Coverage |
|------------|-----------|----------------|
| Task listing by project | Very High | `idx_tasks_project` |
| Task by status | High | `idx_tasks_status` |
| User by email | High | `idx_users_email` |
| Audit log by workspace | Medium | `idx_audit_log_workspace_team` |
| Members by workspace | Medium | `idx_workspace_members_user` |

### Migration Files

```
migrations/
├── 0001_initial_schema.sql      # Core tables, users, workspaces, RBAC
├── 0002_seed_roles_permissions.sql  # Default roles & permissions
├── 0003_add_password_hash.sql   # Password field for users
└── 0004_projects_tasks.sql      # Projects & tasks tables
```

---

## 3. KV Namespace

**Purpose:** Session storage and caching

### Binding Configuration

```toml
# Development
[[kv_namespaces]]
binding = "CACHE"
id = "placeholder-create-with-wrangler-kv-namespace-create-CACHE"

# Staging
[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "placeholder-create-with-wrangler-kv-namespace-create-CACHE-staging"

# Production
[[env.production.kv_namespaces]]
binding = "CACHE"
id = "placeholder-create-with-wrangler-kv-namespace-create-CACHE-production"
```

### Key Patterns

| Key Pattern | Purpose | TTL | Example |
|-------------|---------|-----|---------|
| `session:{token}` | User session data | 24 hours | `session:abc123...` |
| `rate:{userId}:{action}` | Rate limiting | 1 hour | `rate:user-id:enhance` |
| `cache:{workspaceId}:{key}` | General cache | Varies | `cache:ws-id:stats` |

### KV Data Structures

**Session Value:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "createdAt": "2026-01-14T00:00:00.000Z",
  "expiresAt": "2026-01-15T00:00:00.000Z"
}
```

### Setup Commands

```bash
# Create KV namespace
wrangler kv:namespace create CACHE

# For staging
wrangler kv:namespace create CACHE --env staging

# For production
wrangler kv:namespace create CACHE --env production
```

---

## 4. R2 Object Storage

**Purpose:** File storage for avatars, exports, attachments

### Binding Configuration

```toml
# Development
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vibe-kanban-storage"

# Staging
[[env.staging.r2_buckets]]
binding = "STORAGE"
bucket_name = "vibe-kanban-storage-staging"

# Production
[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "vibe-kanban-storage-production"
```

### Object Key Patterns

| Prefix | Purpose | Example |
|--------|---------|---------|
| `avatars/` | User profile images | `avatars/{userId}.jpg` |
| `exports/` | Audit log exports | `exports/audit-export-{wsId}-{timestamp}.csv` |
| `attachments/` | Task attachments | `attachments/{taskId}/{filename}` |

### R2 Metadata

**Audit Export Metadata:**
```json
{
  "contentType": "text/csv",
  "customMetadata": {
    "workspaceId": "uuid",
    "exportedBy": "user-id",
    "recordCount": "500"
  }
}
```

### Setup Commands

```bash
# Create R2 bucket
wrangler r2 bucket create vibe-kanban-storage

# For staging
wrangler r2 bucket create vibe-kanban-storage-staging

# For production
wrangler r2 bucket create vibe-kanban-storage-production
```

---

## 5. Workers AI

**Purpose:** AI-powered prompt enhancement

### Binding Configuration

```toml
# All environments
[ai]
binding = "AI"

[env.staging.ai]
binding = "AI"

[env.production.ai]
binding = "AI"
```

### Model Usage

| Model | Use Case | Input Limit |
|-------|----------|-------------|
| `@cf/meta/llama-2-7b-chat-int8` | Prompt enhancement | ~4K tokens |

### AI Request Pattern

```typescript
const response = await c.env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  max_tokens: 2000,
});
```

### Enhancement Styles

| Style | System Prompt Modifier |
|-------|----------------------|
| `minimal` | "Make minimal changes - only fix obvious issues" |
| `balanced` | "Provide a balanced enhancement that improves clarity" |
| `comprehensive` | "Provide comprehensive enhancement with detailed instructions" |

---

## 6. Cloudflare Pages

**Purpose:** Frontend hosting

### Deployment

| Environment | URL | Branch |
|-------------|-----|--------|
| Staging | `https://staging.vibe-kanban.pages.dev` | `develop` |
| Production | `https://vibe-kanban.pages.dev` | `main` |

### Build Configuration

```
# Frontend build
Framework: React (Vite)
Build command: npm run build
Output directory: dist
Node.js version: 20
```

---

## Resource Limits & Quotas

### Workers

| Limit | Free | Paid |
|-------|------|------|
| Requests/day | 100,000 | 10M+ |
| CPU time/request | 10ms | 30s |
| Memory | 128MB | 128MB |
| Script size | 1MB | 10MB |

### D1 Database

| Limit | Free | Paid |
|-------|------|------|
| Storage | 5GB | 10GB+ |
| Rows read/day | 5M | Unlimited |
| Rows written/day | 100K | Unlimited |
| Database size | 500MB | 2GB+ |

### KV Namespace

| Limit | Free | Paid |
|-------|------|------|
| Reads/day | 100,000 | 10M+ |
| Writes/day | 1,000 | 1M+ |
| Deletes/day | 1,000 | 1M+ |
| Storage | 1GB | 10GB+ |
| Value size | 25MB | 25MB |

### R2 Storage

| Limit | Free | Paid |
|-------|------|------|
| Storage | 10GB | 10GB+ |
| Class A ops/month | 1M | Metered |
| Class B ops/month | 10M | Metered |
| Egress | Free | Free |

### Workers AI

| Limit | Free | Paid |
|-------|------|------|
| Neurons/day | 10,000 | Metered |

---

## Deployment Commands

### Development

```bash
# Start local dev server
npx wrangler dev

# Apply migrations locally
npx wrangler d1 migrations apply vibe-kanban-db --local
```

### Staging

```bash
# Deploy to staging
npx wrangler deploy --env staging

# Apply migrations to staging
npx wrangler d1 migrations apply vibe-kanban-db-staging --env staging
```

### Production

```bash
# Deploy to production
npx wrangler deploy --env production

# Apply migrations to production
npx wrangler d1 migrations apply vibe-kanban-db-production --env production
```

---

## Monitoring & Observability

### Built-in Metrics (Cloudflare Dashboard)

- Worker invocations
- CPU time
- Error rates
- Request duration
- D1 query stats
- KV operations
- R2 operations
- AI inference calls

### Custom Logging

```typescript
// Request ID for tracing
X-Request-Id: uuid

// Response timing
X-Response-Time: 45ms
```

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health check |
| `GET /health/db` | Database connectivity |

---

## Cost Estimation (Monthly)

| Service | Usage Tier | Est. Cost |
|---------|------------|-----------|
| Workers | Paid | $5/month base + usage |
| D1 | Included | $0-5/month |
| KV | Included | $0-2/month |
| R2 | Included | $0-3/month |
| Workers AI | Metered | $5-20/month |
| Pages | Free | $0 |

**Estimated Total:** $10-35/month for typical usage
