# Self-Hosting Guide

Deploy your own instance of Vibe Kanban on Cloudflare's global network.

## Prerequisites

- Cloudflare account (free tier works)
- GitHub account (for OAuth integration)
- Node.js 18+ installed locally
- Git installed locally

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/vibe-kanban.git
cd vibe-kanban/workers
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Authenticate with Cloudflare

```bash
npx wrangler login
```

This opens a browser window to authenticate with your Cloudflare account.

### 4. Create Cloudflare Resources

#### Create D1 Database

```bash
# Create the database
npx wrangler d1 create vibe-kanban-db

# Note the database_id from the output
# Add to wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "vibe-kanban-db"
# database_id = "<your-database-id>"
```

#### Create KV Namespace

```bash
# Create KV namespace
npx wrangler kv:namespace create "CACHE"

# Note the id from the output
# Add to wrangler.toml:
# [[kv_namespaces]]
# binding = "CACHE"
# id = "<your-namespace-id>"
```

#### Create R2 Bucket

```bash
# Create R2 bucket
npx wrangler r2 bucket create vibe-kanban-storage

# Add to wrangler.toml:
# [[r2_buckets]]
# binding = "STORAGE"
# bucket_name = "vibe-kanban-storage"
```

### 5. Configure wrangler.toml

Update your `wrangler.toml`:

```toml
name = "vibe-kanban-api"
main = "dist/index.js"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[[d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db"
database_id = "<your-database-id>"

[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-id>"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "vibe-kanban-storage"

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "info"
CORS_ORIGIN = "https://your-frontend-domain.pages.dev"
```

### 6. Run Database Migrations

```bash
# Apply all migrations locally first
for f in migrations/*.sql; do
  npx wrangler d1 execute vibe-kanban-db --local --file=$f
done

# Apply to production
for f in migrations/*.sql; do
  npx wrangler d1 execute vibe-kanban-db --remote --file=$f
done
```

### 7. Set Secrets

```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -hex 32)
npx wrangler secret put JWT_SECRET
# Paste the generated secret when prompted

# Add API keys (if using AI features)
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put OPENAI_API_KEY
```

### 8. Set Up GitHub OAuth

1. Go to GitHub Developer Settings: https://github.com/settings/developers
2. Create a new OAuth App:
   - Application name: `Vibe Kanban`
   - Homepage URL: `https://your-domain.pages.dev`
   - Authorization callback URL: `https://your-api.workers.dev/api/v1/github/callback`
3. Note the Client ID and generate a Client Secret
4. Add to Workers:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

### 9. Deploy the API

```bash
npm run build
npx wrangler deploy
```

Note the deployed URL (e.g., `https://vibe-kanban-api.your-subdomain.workers.dev`)

### 10. Deploy the Frontend

```bash
cd ../workers/frontend

# Update API URL in .env
echo "VITE_API_URL=https://vibe-kanban-api.your-subdomain.workers.dev" > .env

# Build
npm run build

# Deploy to Pages
npx wrangler pages deploy dist --project-name=vibe-kanban
```

Note the Pages URL (e.g., `https://vibe-kanban.pages.dev`)

### 11. Update CORS Origin

Update your Workers CORS to allow your frontend:

```bash
# In wrangler.toml, update:
# CORS_ORIGIN = "https://vibe-kanban.pages.dev"

npx wrangler deploy
```

## Environment Configuration

### Development

```toml
[env.development]
name = "vibe-kanban-api-dev"
vars = { ENVIRONMENT = "development", LOG_LEVEL = "debug" }
```

### Staging

```toml
[env.staging]
name = "vibe-kanban-api-staging"
vars = { ENVIRONMENT = "staging", LOG_LEVEL = "debug" }

[[env.staging.d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db-staging"
database_id = "<staging-db-id>"
```

### Production

```toml
[env.production]
name = "vibe-kanban-api-production"
vars = { ENVIRONMENT = "production", LOG_LEVEL = "info" }

[[env.production.d1_databases]]
binding = "DB"
database_name = "vibe-kanban-db-production"
database_id = "<production-db-id>"
```

## Custom Domain Setup

### API Domain

1. Go to Cloudflare Dashboard → Your account → Workers & Pages
2. Select your Worker
3. Go to Settings → Domains & Routes
4. Add custom domain: `api.yourdomain.com`

### Frontend Domain

1. Go to Cloudflare Dashboard → Your account → Workers & Pages
2. Select your Pages project
3. Go to Custom domains
4. Add domain: `app.yourdomain.com`

## Seeding Test Data

Create a test admin user:

```bash
npx wrangler d1 execute vibe-kanban-db --remote --command="
INSERT INTO users (id, email, password_hash, name, role, status, created_at, updated_at)
VALUES (
  'admin-user-id',
  'admin@yourdomain.com',
  '\$2b\$10\$...',  -- bcrypt hash of your password
  'Admin User',
  'admin',
  'active',
  datetime('now'),
  datetime('now')
);
"
```

Or use the signup endpoint:

```bash
curl -X POST https://your-api.workers.dev/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@yourdomain.com", "password": "securepassword", "name": "Admin"}'
```

## Monitoring

### Tail Logs

```bash
# Development
npx wrangler tail

# Production
npx wrangler tail --env production
```

### View Analytics

Go to Cloudflare Dashboard → Workers & Pages → Your Worker → Analytics

### Database Queries

```bash
# Check recent users
npx wrangler d1 execute vibe-kanban-db --remote \
  --command="SELECT id, email, name FROM users ORDER BY created_at DESC LIMIT 10"

# Check session counts
npx wrangler d1 execute vibe-kanban-db --remote \
  --command="SELECT status, COUNT(*) FROM workspace_sessions GROUP BY status"
```

## Backup & Recovery

### Export Database

```bash
# Export to SQL
npx wrangler d1 export vibe-kanban-db --remote --output=backup.sql
```

### Restore Database

```bash
# Restore from SQL
npx wrangler d1 execute vibe-kanban-db --remote --file=backup.sql
```

## Troubleshooting

### CORS Errors

If you see CORS errors:
1. Verify `CORS_ORIGIN` in wrangler.toml matches your frontend URL
2. Redeploy the Worker

### Database Errors

If migrations fail:
1. Check migration order (must be sequential)
2. Verify column types match
3. Drop and recreate for development: 
   ```bash
   npx wrangler d1 delete vibe-kanban-db
   npx wrangler d1 create vibe-kanban-db
   ```

### Authentication Issues

If JWT errors occur:
1. Verify `JWT_SECRET` is set
2. Check token expiration (default: 7 days)
3. Ensure frontend sends token in Authorization header

### GitHub OAuth Issues

1. Verify callback URL matches exactly
2. Check Client ID and Secret are correct
3. Ensure required scopes are approved

## Cost Optimization

### Free Tier Limits

Stay within free tier:
- Workers: 100K requests/day
- D1: 5M rows read, 100K writes/day
- KV: 100K reads, 1K writes/day
- R2: 10GB storage

### Reducing Costs

1. **Caching**: Use KV for frequent reads
2. **Pagination**: Limit query results
3. **Cleanup**: Delete old execution logs
4. **Compression**: Gzip API responses

## Security Checklist

- [ ] Strong JWT_SECRET (32+ chars)
- [ ] GitHub OAuth secrets are secret
- [ ] CORS restricted to your domains
- [ ] Rate limiting enabled
- [ ] Audit logging configured
- [ ] Encrypt GitHub tokens (TODO)
- [ ] Regular dependency updates

## Upgrading

### Pull Latest Changes

```bash
git pull origin main
cd workers
npm install
```

### Run New Migrations

```bash
# Check for new migrations
ls migrations/

# Apply new migrations
npx wrangler d1 execute vibe-kanban-db --remote --file=migrations/XXXX_new.sql
```

### Redeploy

```bash
npm run build
npx wrangler deploy --env production
```

## Support

- GitHub Issues: [link to repo]
- Documentation: [link to docs]
- Community Discord: [link]
