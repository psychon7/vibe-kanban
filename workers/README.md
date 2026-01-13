# Vibe Kanban Cloudflare Workers

This directory contains the Cloudflare Workers API for Vibe Kanban team features, using D1 (SQLite) for the database.

## Prerequisites

1. **Cloudflare Account** with Workers and D1 enabled
2. **Wrangler CLI**: `npm install -g wrangler`
3. **Authentication**: Run `wrangler login` to authenticate

## Quick Start

```bash
# Install dependencies
pnpm install

# Create D1 database
pnpm run d1:create
# Note: Copy the database_id from output to wrangler.toml

# Apply migrations locally
pnpm run d1:migrate

# Seed development data
pnpm run d1:seed

# Start local development server
pnpm run dev:local
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

## D1 Database Commands

### Create Database
```bash
pnpm run d1:create
```
After running, copy the `database_id` from the output to `wrangler.toml`.

### Migrations
```bash
# List pending migrations
pnpm run d1:migrate:list

# Apply migrations locally
pnpm run d1:migrate

# Apply migrations to production
pnpm run d1:migrate:prod
```

### Query Database
```bash
# Interactive query (local)
pnpm run d1:query -- --command "SELECT * FROM users"

# Interactive query (production)
pnpm run d1:query:prod -- --command "SELECT * FROM roles"
```

### Reset Local Database
```bash
pnpm run d1:reset
```

## Configuration

### wrangler.toml Setup

After creating resources, update `wrangler.toml`:

1. **D1 Database**: Replace `<your-database-id>` with actual ID from `d1:create`
2. **KV Namespace**: Replace `<your-kv-namespace-id>` with ID from `kv:create`

### Secrets

Set secrets for production:
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

## Development

### Local Development
```bash
# Uses local SQLite for D1, no cloud resources needed
pnpm run dev:local
```

### Remote Development
```bash
# Uses remote D1 database (requires setup)
pnpm run dev
```

## Deployment

### Deploy to Production
```bash
# Apply migrations first
pnpm run d1:migrate:prod

# Then deploy worker
pnpm run deploy:prod
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
| `audit_log` | Activity audit trail |
| `task_acl` | Task-level access control |
| `prompt_enhancements` | AI prompt enhancement history |
| `prompt_templates` | Reusable prompt templates |
| `prompt_enhancement_settings` | Per-workspace AI settings |

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
Run `pnpm run d1:create` and update the `database_id` in `wrangler.toml`.

### Migration errors
Check SQL syntax. D1 uses SQLite, not PostgreSQL.

### Local development issues
Reset local state: `pnpm run d1:reset`
