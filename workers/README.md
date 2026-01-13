# Vibe Kanban API - Cloudflare Workers

A Cloudflare Workers API for Vibe Kanban team features, using Hono framework and D1 (SQLite) for the database.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Hono](https://hono.dev/) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Cache | Cloudflare Workers KV |
| AI | Cloudflare AI Gateway |

## Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Wrangler CLI**: `npm install -g wrangler`
3. **Authentication**: Run `wrangler login` to authenticate

## Quick Start

```bash
# Install dependencies
npm install

# Apply migrations locally
npm run d1:migrate

# Seed development data
npm run d1:seed

# Start local development server
npm run dev:local
```

The API will be available at `http://localhost:8787`

## Project Structure

```
workers/
├── migrations/               # D1 SQL migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_roles_permissions.sql
├── scripts/
│   └── seed.sql              # Development seed data
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── types/
│   │   └── env.ts            # Environment bindings
│   ├── middleware/
│   │   ├── index.ts          # Barrel export
│   │   ├── auth.ts           # Authentication middleware
│   │   ├── permissions.ts    # RBAC middleware
│   │   ├── error-handler.ts  # Error handling
│   │   └── request-id.ts     # Request tracing
│   └── routes/
│       ├── index.ts          # Barrel export
│       ├── auth.ts           # /api/v1/auth/*
│       ├── users.ts          # /api/v1/users/*
│       ├── workspaces.ts     # /api/v1/workspaces/*
│       ├── projects.ts       # /api/v1/projects/*
│       ├── tasks.ts          # /api/v1/tasks/*
│       ├── prompts.ts        # /api/v1/prompts/*
│       └── audit.ts          # /api/v1/audit/*
├── package.json
├── tsconfig.json
└── wrangler.toml             # Cloudflare configuration
```

## Environments

| Environment | D1 Database | Status |
|-------------|-------------|--------|
| Development | `vibe-kanban-db` (local) | ✅ Ready |
| Staging | `vibe-kanban-db-staging` | ✅ Deployed |
| Production | `vibe-kanban-db-production` | ✅ Deployed |

## API Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/health/db` | Database connectivity |

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/signup` | Create account |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Get current user |

### Workspaces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/workspaces` | List workspaces |
| POST | `/api/v1/workspaces` | Create workspace |
| GET | `/api/v1/workspaces/:id` | Get workspace |
| PATCH | `/api/v1/workspaces/:id` | Update workspace |
| DELETE | `/api/v1/workspaces/:id` | Delete workspace |
| GET | `/api/v1/workspaces/:id/members` | List members |
| POST | `/api/v1/workspaces/:id/members/invite` | Invite member |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/tasks` | List tasks |
| POST | `/api/v1/tasks` | Create task |
| GET | `/api/v1/tasks/:id` | Get task |
| PATCH | `/api/v1/tasks/:id` | Update task |
| PATCH | `/api/v1/tasks/:id/assign` | Assign task |
| POST | `/api/v1/tasks/:id/enhance` | Enhance prompt |

### Prompts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/prompts/enhance` | Enhance prompt |
| POST | `/api/v1/prompts/score` | Score prompt quality |
| GET | `/api/v1/prompts/templates` | List templates |
| POST | `/api/v1/prompts/templates` | Create template |

## D1 Database Commands

### Migrations

```bash
# Apply migrations locally
npm run d1:migrate

# Apply to staging
npm run d1:migrate:staging

# Apply to production
npm run d1:migrate:prod

# List migrations
npm run d1:migrate:list
```

### Query Database

```bash
# Local query
npm run d1:query -- --command "SELECT * FROM users"

# Staging query
npm run d1:query:staging -- --command "SELECT * FROM roles"

# Production query
npm run d1:query:prod -- --command "SELECT * FROM roles"
```

### Seeding

```bash
# Seed local database
npm run d1:seed

# Seed staging
npm run d1:seed:staging
```

### Reset Local Database

```bash
npm run d1:reset
```

## Deployment

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

## Configuration

### Secrets

Set secrets per environment via `wrangler secret put`:

```bash
wrangler secret put JWT_SECRET
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
```

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | JWT token signing key |
| `OPENAI_API_KEY` | OpenAI API (optional) |
| `ANTHROPIC_API_KEY` | Anthropic API (optional) |

### KV Namespaces

Create KV namespaces for each environment:

```bash
# Development
wrangler kv:namespace create CACHE

# Staging
wrangler kv:namespace create CACHE --env staging

# Production
wrangler kv:namespace create CACHE --env production
```

Update the `id` values in `wrangler.toml` after creation.

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `workspaces_team` | Team workspaces |
| `roles` | RBAC roles (Owner, Admin, Member, Viewer) |
| `permissions` | Permission definitions |
| `role_permissions` | Role-permission mappings |
| `workspace_members` | Team membership |
| `workspace_invitations` | Pending invitations |
| `audit_log` | Activity audit trail |
| `task_acl` | Task-level access control |
| `prompt_enhancements` | AI prompt enhancement history |
| `prompt_templates` | Reusable prompt templates |
| `prompt_enhancement_settings` | Per-workspace AI settings |

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| Owner | All permissions including `workspace.delete` |
| Admin | All permissions except `workspace.delete` |
| Member | Create/edit tasks, run attempts, use prompts |
| Viewer | Read-only access |

## Development

### Type Checking

```bash
npm run typecheck
```

### Local Testing

```bash
npm run test:local
```

This runs migrations, seeds data, and starts the dev server.

## Troubleshooting

### "Database not found" error

Use the binding name `DB` with environment flag:

```bash
wrangler d1 migrations apply DB --env production --remote
```

### Migration errors

Check SQL syntax. D1 uses SQLite, not PostgreSQL.

### Local development issues

Reset local state:

```bash
npm run d1:reset
```

### CORS issues

Verify `CORS_ORIGIN` in `wrangler.toml` matches your frontend URL.
