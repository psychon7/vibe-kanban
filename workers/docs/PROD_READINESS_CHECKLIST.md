# Production Readiness Checklist

**Last Updated:** 2026-01-15  
**Purpose:** QA checklist mapped 1:1 to API endpoints and UI pages after redeploying to production.

---

## 🔧 Pre-Deployment Configuration

### Environment Variables
- [x] `VITE_API_URL` set correctly in `workers/frontend/wrangler.toml`
  - Production: `https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev`
  - Staging: `https://vibe-kanban-api-staging.sheshnarayan-iyer.workers.dev`
- [x] CI/CD workflow sets `VITE_API_URL` during build (`.github/workflows/deploy-production.yml`)
- [x] CORS supports wildcard for preview deployments (`*.vibe-kanban.pages.dev`)

### Required Secrets (Cloudflare Workers)
- [ ] `JWT_SECRET` - For JWT token signing
- [ ] `OPENAI_API_KEY` - For prompt enhancement (optional)
- [ ] `ANTHROPIC_API_KEY` - For Claude integration (optional)

---

## 🚀 Deployment Commands

### Deploy Backend to Production
```bash
cd workers
npx wrangler deploy --env production
```

### Deploy Frontend to Pages
```bash
cd workers/frontend
npm install
VITE_API_URL=https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev npm run build
npx wrangler pages deploy dist --project-name=vibe-kanban --commit-dirty=true
```

### Or trigger via Git (Recommended)
Push to `main` branch to trigger `.github/workflows/deploy-production.yml`

---

## ✅ API Endpoints QA Checklist

### Health Endpoints
| Endpoint | Method | Expected | Status |
|----------|--------|----------|--------|
| `/health` | GET | `{ status: "ok", environment: "production" }` | ⬜ |
| `/health/db` | GET | `{ status: "ok", database: "connected" }` | ⬜ |

### Auth (`/api/v1/auth`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/auth/register` | POST | Register new user | ⬜ |
| `/auth/login` | POST | Login, returns JWT | ⬜ |
| `/auth/refresh` | POST | Refresh JWT token | ⬜ |
| `/auth/me` | GET | Get current user | ⬜ |
| `/auth/logout` | POST | Invalidate session | ⬜ |

### Users (`/api/v1/users`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/users` | GET | List users (admin) | ⬜ |
| `/users/:id` | GET | Get user by ID | ⬜ |
| `/users/:id` | PATCH | Update user | ⬜ |

### Workspaces (`/api/v1/workspaces`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/workspaces` | GET | List workspaces | ⬜ |
| `/workspaces` | POST | Create workspace | ⬜ |
| `/workspaces/:id` | GET | Get workspace | ⬜ |
| `/workspaces/:id` | PATCH | Update workspace | ⬜ |
| `/workspaces/:id` | DELETE | Delete workspace | ⬜ |

### Projects (`/api/v1/projects`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/projects` | GET | List projects | ⬜ |
| `/projects` | POST | Create project | ⬜ |
| `/projects/:id` | GET | Get project | ⬜ |
| `/projects/:id` | PATCH | Update project | ⬜ |
| `/projects/:id` | DELETE | Delete project | ⬜ |

### Tasks (`/api/v1/tasks`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/tasks` | GET | List tasks (with filters) | ⬜ |
| `/tasks` | POST | Create task | ⬜ |
| `/tasks/:id` | GET | Get task | ⬜ |
| `/tasks/:id` | PATCH | Update task | ⬜ |
| `/tasks/:id` | DELETE | Delete task | ⬜ |
| `/tasks/:id/subtasks` | GET | List subtasks | ⬜ |
| `/tasks/:id/subtasks` | POST | Create subtask | ⬜ |

### Sessions (`/api/v1/sessions`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/sessions` | GET | List sessions | ⬜ |
| `/sessions` | POST | Create session | ⬜ |
| `/sessions/:id` | GET | Get session | ⬜ |
| `/sessions/:id/stop` | POST | Stop session | ⬜ |

### Agents (`/api/v1/agents`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/agents/execute` | POST | Execute agent | ⬜ |
| `/agents/executions/:id/logs` | GET | Get execution logs | ⬜ |
| `/agents/executions/:id/stream` | GET | SSE log stream | ⬜ |

### GitHub (`/api/v1/github`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/github/auth/init` | GET | Start OAuth flow | ⬜ |
| `/github/auth/callback` | GET | OAuth callback | ⬜ |
| `/github/status` | GET | Check connection status | ⬜ |
| `/github/repos` | GET | List repositories | ⬜ |
| `/github/repos/:owner/:repo/contents/*` | GET | Read file | ⬜ |
| `/github/repos/:owner/:repo/contents/*` | PUT | Write file | ⬜ |

### Templates (`/api/v1/templates`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/templates` | GET | List templates | ⬜ |
| `/templates` | POST | Create template | ⬜ |
| `/templates/:id` | GET | Get template | ⬜ |
| `/templates/:id` | PATCH | Update template | ⬜ |
| `/templates/:id` | DELETE | Delete template | ⬜ |
| `/templates/seed` | POST | Seed built-in templates | ⬜ |

### MCP API (`/api/v1/mcp`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/mcp/keys` | GET | List API keys | ⬜ |
| `/mcp/keys` | POST | Create API key | ⬜ |
| `/mcp/keys/:id` | DELETE | Revoke API key | ⬜ |
| `/mcp/execute` | POST | Execute MCP tool | ⬜ |

### Prompts (`/api/v1/prompts`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/prompts` | GET | List prompts | ⬜ |
| `/prompts` | POST | Create prompt | ⬜ |
| `/prompts/:id` | GET | Get prompt | ⬜ |
| `/prompts/:id` | PATCH | Update prompt | ⬜ |
| `/prompts/:id` | DELETE | Delete prompt | ⬜ |

### Audit (`/api/v1/audit`)
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/audit` | GET | Get audit logs | ⬜ |

---

## 🖥️ Frontend Pages QA Checklist

### Authentication
| Page | Route | Tests | Status |
|------|-------|-------|--------|
| Login | `/login` | Login form, validation, error handling | ⬜ |
| Signup | `/signup` | Registration form, password requirements | ⬜ |

### Dashboard
| Page | Route | Tests | Status |
|------|-------|-------|--------|
| Dashboard | `/` | Workspace overview, recent activity | ⬜ |

### Projects
| Page | Route | Tests | Status |
|------|-------|-------|--------|
| Projects List | `/projects` | List, create, delete projects | ⬜ |
| Kanban Board | `/projects/:id` | Drag & drop, task cards, columns | ⬜ |

### Tasks
| Component | Tests | Status |
|-----------|-------|--------|
| Task Modal | View, edit, delete task | ⬜ |
| Task Creation | Create task with all fields | ⬜ |
| Subtasks | Add, complete, delete subtasks | ⬜ |
| Sessions Panel | Start session, view logs | ⬜ |
| Execution Logs | Real-time log streaming | ⬜ |

### Settings
| Page | Route | Tests | Status |
|------|-------|-------|--------|
| Members | `/settings/members` | Add, remove, change roles | ⬜ |
| Prompts | `/settings/prompts` | Manage prompt templates | ⬜ |
| Audit Log | `/settings/audit` | View audit history | ⬜ |

---

## 🔒 Security Checklist

| Item | Description | Status |
|------|-------------|--------|
| JWT Auth | Tokens expire, refresh works | ⬜ |
| CORS | Only allowed origins can make requests | ⬜ |
| Rate Limiting | Prevents abuse (TODO: implement) | ⬜ |
| Input Validation | All inputs sanitized | ⬜ |
| SQL Injection | Parameterized queries used | ⬜ |
| XSS Prevention | Output encoding in place | ⬜ |

---

## 📊 Performance Checklist

| Item | Expected | Status |
|------|----------|--------|
| API Response Time | < 200ms average | ⬜ |
| Page Load Time | < 2s on 3G | ⬜ |
| Bundle Size | < 500KB gzipped | ⬜ |
| Lighthouse Score | > 90 performance | ⬜ |

---

## 🧪 Quick Smoke Test

Run this sequence after deployment to verify core functionality:

```bash
API_URL="https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev"

# 1. Health check
curl -s "$API_URL/health" | jq .

# 2. DB health check
curl -s "$API_URL/health/db" | jq .

# 3. Register test user (if not exists)
curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}' | jq .

# 4. Login
TOKEN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' | jq -r '.token')
echo "Token: $TOKEN"

# 5. Get current user
curl -s "$API_URL/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. List projects
curl -s "$API_URL/api/v1/projects" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 📝 Post-Deployment Actions

After successful QA:

1. [ ] Monitor error rates in Cloudflare dashboard
2. [ ] Set up alerts for API errors > 1%
3. [ ] Document any issues found
4. [ ] Update PROJECT_STATUS.md with deployment date
5. [ ] Announce deployment to team

---

## 🔗 Production URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://vibe-kanban.pages.dev |
| **Backend API** | https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev |
| **API Docs** | https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev/ |
| **Health Check** | https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev/health |

---

**Legend:**
- ⬜ Not tested
- ✅ Passed
- ❌ Failed
- ⚠️ Partial/Issues
