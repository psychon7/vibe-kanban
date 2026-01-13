# Vibe Kanban Cloudflare Workers

This directory contains the Cloudflare Workers API for Vibe Kanban team features, using D1 (SQLite) for the database.

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

## Project Structure

```
workers/
├── migrations/           # D1 SQL migrations
│   ├── 0001_initial_schema.sql
│   └── 0002_seed_roles_permissions.sql
├── scripts/
│   └── seed.sql          # Development seed data
├── src/
│   └── index.ts          # Worker entry point
├── package.json
├── tsconfig.json
└── wrangler.toml         # Cloudflare configuration
```

## Environments

| Environment | Database | Status |
|-------------|----------|--------|
| Development | `vibe-kanban-db` (local) | ✅ Ready |
| Staging | `vibe-kanban-db-staging` | ✅ Deployed |
| Production | `vibe-kanban-db-production` | ✅ Deployed |

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

# Seed staging (development data)
npm run d1:seed:staging

# Seed production (NOT recommended for dev data)
npm run d1:seed:prod
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

Secrets are configured per environment via `wrangler secret put`:

| Secret | Description |
|--------|-------------|
| `JWT_SECRET` | JWT token signing key |
| `AI_GATEWAY_TOKEN` | AI Gateway authentication |
| `DATABASE_ENCRYPTION_KEY` | Sensitive data encryption |
| `OPENAI_API_KEY` | OpenAI API (optional) |
| `ANTHROPIC_API_KEY` | Anthropic API (optional) |

### KV Namespaces

KV namespace IDs need to be created and added to wrangler.toml:
```bash
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --env staging
wrangler kv:namespace create CACHE --env production
```

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (synced from CF Access) |
| `workspaces_team` | Team workspaces for collaboration |
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
| `user_sessions` | Session management |
| `rate_limits` | Rate limiting tracking |

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| Owner | All permissions including workspace.delete |
| Admin | All permissions except workspace.delete |
| Member | Create/edit tasks, run attempts, use prompts |
| Viewer | Read-only access |

## API Endpoints

- `GET /health` - Health check
- `GET /health/db` - Database health check
- `GET /api/*` - API routes (see API documentation)

## Troubleshooting

### "Database not found" error
Use binding name `DB` with environment flag:
```bash
wrangler d1 migrations apply DB --env production --remote
```

### Migration errors
Check SQL syntax. D1 uses SQLite, not PostgreSQL.

### Local development issues
Reset local state: `npm run d1:reset`
