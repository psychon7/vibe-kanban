# Cloudflare Services Resource Map

## Overview

Vibe Kanban Hosted uses multiple Cloudflare services to provide a fully serverless, globally distributed application.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Edge Network                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐            │
│  │   Cloudflare   │    │   Cloudflare   │    │   Cloudflare   │            │
│  │     Pages      │    │    Workers     │    │    Workers     │            │
│  │   (Frontend)   │    │     (API)      │    │     (AI)       │            │
│  │                │    │                │    │                │            │
│  │  React + Vite  │───▶│   Hono + TS   │───▶│  Workers AI    │            │
│  │   Tailwind     │    │                │    │                │            │
│  └────────────────┘    └───────┬────────┘    └────────────────┘            │
│                                │                                            │
│         ┌──────────────────────┼───────────────────────┐                   │
│         │                      │                       │                    │
│         ▼                      ▼                       ▼                    │
│  ┌────────────┐         ┌────────────┐          ┌────────────┐            │
│  │     D1     │         │     KV     │          │     R2     │            │
│  │  Database  │         │   Cache    │          │   Storage  │            │
│  │            │         │            │          │            │            │
│  │  SQLite    │         │ Sessions   │          │   Logs     │            │
│  │  at Edge   │         │ Real-time  │          │  Avatars   │            │
│  └────────────┘         └────────────┘          └────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Services Detail

### 1. Cloudflare Pages (Frontend)

**Purpose**: Host the React frontend application

| Environment | URL | Branch |
|-------------|-----|--------|
| Production | `https://vibe-kanban.pages.dev` | `main` |
| Staging | `https://staging.vibe-kanban.pages.dev` | `develop` |

**Configuration**:
- Framework: React with Vite
- Build command: `npm run build`
- Build output: `frontend/dist`
- Node version: 18

**Features Used**:
- Automatic HTTPS
- Global CDN distribution
- Preview deployments for PRs
- Rollback capability

---

### 2. Cloudflare Workers (API)

**Purpose**: Serverless API backend

| Environment | URL | Worker Name |
|-------------|-----|-------------|
| Production | `vibe-kanban-api-production.*.workers.dev` | `vibe-kanban-api-production` |
| Staging | `vibe-kanban-api-staging.*.workers.dev` | `vibe-kanban-api-staging` |
| Development | Local | `vibe-kanban-api` |

**Configuration** (`wrangler.toml`):
```toml
name = "vibe-kanban-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[env.production]
name = "vibe-kanban-api-production"
vars = { ENVIRONMENT = "production", LOG_LEVEL = "info" }

[env.staging]
name = "vibe-kanban-api-staging"
vars = { ENVIRONMENT = "staging", LOG_LEVEL = "debug" }
```

**Bindings**:
- D1 Database
- KV Namespace
- R2 Bucket
- AI Gateway

---

### 3. D1 Database

**Purpose**: Primary data storage (SQLite at the edge)

| Environment | Database Name | Database ID |
|-------------|---------------|-------------|
| Production | `vibe-kanban-db-production` | `783e3bee-b734-4ff1-8b4b-9cbe9e599ac8` |
| Staging | `vibe-kanban-db-staging` | TBD |
| Development | `vibe-kanban-db` | `161a7750-96f5-47b7-8b2d-95fb3dab6c1f` |

**Schema Overview**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           D1 Database Schema                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Core Entities                                                      │
│  ┌────────────┐    ┌─────────────────┐    ┌────────────────┐       │
│  │   users    │───▶│ workspace_teams │◀───│workspace_members│      │
│  └────────────┘    └─────────────────┘    └────────────────┘       │
│                            │                                        │
│                            ▼                                        │
│  ┌────────────┐    ┌────────────────┐     ┌────────────────┐       │
│  │   tasks    │◀───│    projects    │     │  audit_logs    │       │
│  └────────────┘    └────────────────┘     └────────────────┘       │
│        │                                                            │
│        ▼                                                            │
│  ┌──────────────────┐    ┌──────────────────────┐                  │
│  │workspace_sessions│───▶│ execution_processes  │                  │
│  └──────────────────┘    └──────────────────────┘                  │
│                                                                     │
│  GitHub Integration                                                 │
│  ┌───────────────────┐    ┌───────────────────────┐                │
│  │github_connections │───▶│connected_repositories │                │
│  └───────────────────┘    └───────────────────────┘                │
│                                                                     │
│  Billing & Templates                                                │
│  ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │  subscriptions│  │  usage_records  │  │workspace_templates│     │
│  └───────────────┘  └─────────────────┘  └─────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Migrations**:
- `0001_init.sql` - Core tables (users, workspaces, projects, tasks)
- `0002_task_assignment.sql` - Task assignment columns
- `0003_audit_logs.sql` - Audit logging
- `0004_prompt_templates.sql` - Prompt templates
- `0005_workspace_sessions.sql` - Agent sessions
- `0006_github_integration.sql` - GitHub OAuth
- `0007_templates_billing.sql` - Templates and billing
- `0008_mcp_api_keys.sql` - MCP API keys

---

### 4. KV Namespace

**Purpose**: Fast key-value storage for sessions and caching

| Environment | Namespace Name | Namespace ID |
|-------------|----------------|--------------|
| Production | `vibe-kanban-kv-production` | `303151e8558541539b348e48a56923a2` |
| Staging | `vibe-kanban-kv-staging` | TBD |
| Development | `vibe-kanban-kv` | `ca6d7c90d2c14c8bb1a34badc23c2ee4` |

**Data Stored**:

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `session:{id}` | Real-time session state | 1 hour |
| `execution:{id}` | Execution results | 24 hours |
| `github_oauth:{state}` | OAuth state tokens | 10 minutes |
| `rate_limit:{user_id}:{endpoint}` | Rate limiting | 1 minute |
| `cache:{hash}` | API response caching | Varies |

---

### 5. R2 Bucket

**Purpose**: Object storage for files and logs

| Environment | Bucket Name |
|-------------|-------------|
| Production | `vibe-kanban-storage-production` |
| Staging | `vibe-kanban-storage-staging` |
| Development | `vibe-kanban-storage` |

**Directory Structure**:
```
vibe-kanban-storage/
├── avatars/
│   └── {user_id}/
│       └── avatar.{ext}
├── exports/
│   └── {workspace_id}/
│       └── {timestamp}_export.json
├── logs/
│   └── {session_id}/
│       ├── execution.log
│       └── agent_output.log
└── artifacts/
    └── {execution_id}/
        └── {file}
```

---

### 6. Workers AI

**Purpose**: AI capabilities for prompt enhancement

**Models Used**:
- `@cf/meta/llama-2-7b-chat-int8` - Prompt enhancement
- `@cf/baai/bge-base-en-v1.5` - Text embeddings (future)

**Usage**:
```typescript
const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
  messages: [
    { role: 'system', content: 'Enhance this coding task prompt...' },
    { role: 'user', content: userPrompt }
  ]
});
```

---

## Secrets Management

Secrets are stored securely using `wrangler secret put`:

| Secret | Purpose |
|--------|---------|
| `JWT_SECRET` | JWT token signing |
| `OPENAI_API_KEY` | OpenAI API access |
| `ANTHROPIC_API_KEY` | Claude API access |
| `GITHUB_CLIENT_ID` | GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App |

**Setting Secrets**:
```bash
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ANTHROPIC_API_KEY --env production
npx wrangler secret put GITHUB_CLIENT_ID --env production
npx wrangler secret put GITHUB_CLIENT_SECRET --env production
```

---

## Cost Estimation

### Free Tier Limits

| Service | Free Tier | Overage Cost |
|---------|-----------|--------------|
| Workers | 100K req/day | $0.30/M requests |
| D1 | 5M rows read, 100K writes/day | $0.001/M reads |
| KV | 100K reads, 1K writes/day | $0.50/M reads |
| R2 | 10GB storage, 10M Class A ops | $0.015/GB |
| Workers AI | 10K neurons/day | $0.01/1K neurons |
| Pages | Unlimited bandwidth | Free |

### Estimated Monthly Costs (1000 users)

| Service | Usage | Cost |
|---------|-------|------|
| Workers | 5M requests | $1.50 |
| D1 | 50M reads, 500K writes | $0.50 |
| KV | 10M reads, 100K writes | $5.00 |
| R2 | 50GB storage | $0.75 |
| Workers AI | 1M neurons | $10.00 |
| **Total** | | **~$18/month** |

---

## Deployment Commands

### Deploy to Production
```bash
# Deploy Workers API
cd workers
npx wrangler deploy --env production

# Deploy Frontend (via Pages)
# Automatic on push to main branch
```

### Deploy to Staging
```bash
# Deploy Workers API
cd workers
npx wrangler deploy --env staging

# Deploy Frontend (via Pages)
# Automatic on push to develop branch
```

### Run Migrations
```bash
# Local
npx wrangler d1 execute vibe-kanban-db --local --file=migrations/XXXX_name.sql

# Production
npx wrangler d1 execute vibe-kanban-db-production --remote --file=migrations/XXXX_name.sql
```

### Check Database
```bash
# Production
npx wrangler d1 execute vibe-kanban-db-production --remote --command="SELECT * FROM users LIMIT 5"
```

---

## Monitoring & Observability

### Available Metrics

1. **Workers Analytics** (Cloudflare Dashboard)
   - Request count
   - CPU time
   - Error rates
   - Geographic distribution

2. **D1 Analytics**
   - Query count
   - Rows read/written
   - Query duration

3. **Custom Logging**
   - Request ID tracking (`X-Request-Id` header)
   - Structured JSON logs
   - Audit trail in D1

### Accessing Logs
```bash
# Tail production logs
npx wrangler tail --env production

# With filters
npx wrangler tail --env production --status error
```

---

## Security Considerations

1. **Authentication**: JWT-based with secure secrets
2. **CORS**: Configured per environment
3. **Rate Limiting**: Per-user, per-endpoint limits
4. **Data Encryption**: Secrets encrypted at rest
5. **GitHub Tokens**: Should be encrypted in D1 (TODO)
6. **Audit Logging**: All sensitive operations logged
