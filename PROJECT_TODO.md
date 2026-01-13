# Vibe Kanban - Cloud Web Application with Team RBAC

> **Document Type:** Implementation Plan & Roadmap  
> **Created:** 2026-01-13  
> **Updated:** 2026-01-14  
> **Repository:** Forked from [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)

---

## 📋 Overview

This project transforms Vibe Kanban (an AI coding agent orchestration tool) into a **cloud-native web application** deployed on Cloudflare's edge platform with team-based role access control (RBAC) and task assignment capabilities.

### Target Users
- Developers using multiple coding agents in parallel
- Small teams (2–20) coordinating agent-driven tasks

### Core Goals
1. ✅ **Cloud-native web application** — Deployed to Cloudflare Pages with custom domain
2. ✅ Multi-user team workflow with workspace-based tenancy
3. ✅ Role-based access control (Owner/Admin/Member/Viewer)
4. ✅ Task assignment and permissioned visibility
5. ✅ Audit trail for all operations
6. ✅ **AI Prompt Enhancement** — Automatically improve task prompts using prompt engineering best practices

---

## 🏗️ Architecture

### Target Stack (Cloud-Native)

| Layer | Technology | Status |
|-------|------------|--------|
| **Frontend** | React + Vite → Cloudflare Pages | ✅ Ready |
| **API** | Cloudflare Workers (Hono) | ✅ Complete |
| **Database** | Cloudflare D1 (SQLite edge) | ✅ Complete |
| **Storage** | Cloudflare R2 | ✅ Complete |
| **Auth** | Session-based (KV) | ✅ Complete |
| **AI** | Cloudflare Workers AI | ✅ Complete |
| **Cache** | Cloudflare KV | ✅ Complete |
| **Domain** | Cloudflare DNS | ⏳ Pending |

### Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE EDGE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌───────────────────┐    ┌───────────────────┐                   │
│   │  Cloudflare Pages │    │ Cloudflare Workers│                   │
│   │  (React Frontend) │───▶│   (Hono API)      │                   │
│   │                   │    │                   │                   │
│   │  vibekanban.com   │    │ api.vibekanban.com│                   │
│   └───────────────────┘    └─────────┬─────────┘                   │
│                                      │                              │
│            ┌─────────────────────────┼─────────────────────────┐   │
│            │                         │                         │   │
│            ▼                         ▼                         ▼   │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐   │
│   │   Cloudflare D1 │    │   Cloudflare KV │    │ Cloudflare  │   │
│   │   (Database)    │    │   (Sessions)    │    │ R2 (Files)  │   │
│   └─────────────────┘    └─────────────────┘    └─────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │              Cloudflare Workers AI (Prompt Enhancement)      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Progress Tracker

### Phase 0: Baseline Setup ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Clone repository | ✅ Complete | BloopAI/vibe-kanban |
| Understand project structure | ✅ Complete | Rust crates + React frontend |
| Install dependencies | ✅ Complete | `pnpm i` |
| Verify dev server runs | ✅ Complete | `pnpm run dev` |
| Understand DB schema | ✅ Complete | 64 SQLite migrations |
| Document current API routes | ✅ Complete | See specs/ |

### Phase 1: Workers API Backend ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Set up Cloudflare Workers project | ✅ Complete | `workers/` directory |
| Configure D1 database bindings | ✅ Complete | Dev/staging/prod |
| Configure R2 storage bindings | ✅ Complete | For exports |
| Configure KV namespace bindings | ✅ Complete | For sessions |
| Configure AI Gateway | ✅ Complete | Workers AI |
| Create D1 migrations | ✅ Complete | 4 migration files |
| Implement Hono API framework | ✅ Complete | Full routing |
| Implement error handling middleware | ✅ Complete | Zod + ApiError |
| Implement request ID middleware | ✅ Complete | Tracing |

### Phase 2: Auth + Workspace Primitives ✅ COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Design auth database schema | ✅ Complete | users, workspaces, roles |
| Create D1 migrations | ✅ Complete | 0001-0004 |
| Implement User model | ✅ Complete | D1 queries |
| Implement Workspace model | ✅ Complete | D1 queries |
| Implement WorkspaceMember model | ✅ Complete | D1 queries |
| Implement Role + Permission models | ✅ Complete | D1 + seed data |
| Create auth middleware (requireAuth) | ✅ Complete | KV sessions |
| Implement POST /api/v1/auth/signup | ✅ Complete | PBKDF2 hashing |
| Implement POST /api/v1/auth/login | ✅ Complete | Session creation |
| Implement POST /api/v1/auth/logout | ✅ Complete | Session deletion |
| Implement GET /api/v1/auth/me | ✅ Complete | User details |
| Implement POST /api/v1/auth/refresh | ✅ Complete | Token rotation |
| Create login UI | 🔲 Pending | Frontend work |
| Create workspace creation UI | 🔲 Pending | Frontend work |

### Phase 3: Workspace & Member Management ✅ COMPLETE (API)
| Task | Status | Notes |
|------|--------|-------|
| Implement POST /api/v1/workspaces | ✅ Complete | Create workspace |
| Implement GET /api/v1/workspaces | ✅ Complete | List workspaces |
| Implement GET /api/v1/workspaces/:id | ✅ Complete | Get workspace |
| Implement PATCH /api/v1/workspaces/:id | ✅ Complete | Update workspace |
| Implement DELETE /api/v1/workspaces/:id | ✅ Complete | Owner only |
| Implement GET /api/v1/workspaces/:id/members | ✅ Complete | List members |
| Implement POST /api/v1/workspaces/:id/members/invite | ✅ Complete | Invite + direct add |
| Implement PATCH /api/v1/workspaces/:id/members/:userId/role | ✅ Complete | Change role |
| Implement DELETE /api/v1/workspaces/:id/members/:userId | ✅ Complete | Remove member |
| Create workspace switcher UI | 🔲 Pending | Frontend work |
| Create members management UI | 🔲 Pending | Frontend work |
| Create invite flow UI | 🔲 Pending | Frontend work |

### Phase 4: Task Assignment + Permissions ✅ COMPLETE (API)
| Task | Status | Notes |
|------|--------|-------|
| Add assigned_to_user_id to tasks | ✅ Complete | D1 migration |
| Add created_by_user_id to tasks | ✅ Complete | D1 migration |
| Add visibility field to tasks | ✅ Complete | workspace/private/restricted |
| Create task_acl table | ✅ Complete | Per-task overrides |
| Implement requirePermission middleware | ✅ Complete | RBAC checks |
| Implement requireMembership middleware | ✅ Complete | Workspace checks |
| Implement GET /api/v1/tasks (with visibility) | ✅ Complete | ACL filtering |
| Implement POST /api/v1/tasks | ✅ Complete | With assignment |
| Implement PATCH /api/v1/tasks/:taskId | ✅ Complete | Full update |
| Implement PATCH /api/v1/tasks/:taskId/assign | ✅ Complete | Assignment |
| Implement PATCH /api/v1/tasks/:taskId/visibility | ✅ Complete | + ACL management |
| Update task card UI (assignee avatar) | 🔲 Pending | Frontend work |
| Add "Assigned to me" filter | 🔲 Pending | Frontend work |
| Add assignee dropdown | 🔲 Pending | Frontend work |

### Phase 5: Audit Trail ✅ COMPLETE (API)
| Task | Status | Notes |
|------|--------|-------|
| Create audit_log table | ✅ Complete | D1 migration |
| Implement GET /api/v1/audit | ✅ Complete | With filtering |
| Implement GET /api/v1/audit/:id | ✅ Complete | Single entry |
| Implement GET /api/v1/audit/entity/:type/:id | ✅ Complete | Entity history |
| Implement POST /api/v1/audit/export | ✅ Complete | CSV to R2 |
| Create createAuditLog helper | ✅ Complete | Reusable function |
| Create audit log viewer UI | 🔲 Pending | Frontend work |
| Add export logs feature UI | 🔲 Pending | Frontend work |

### Phase 6: AI Prompt Enhancement ✅ COMPLETE (API)
| Task | Status | Notes |
|------|--------|-------|
| Design prompt enhancement architecture | ✅ Complete | Cloudflare AI |
| Create prompt_enhancements table | ✅ Complete | D1 migration |
| Create prompt_templates table | ✅ Complete | D1 migration |
| Create prompt_enhancement_settings table | ✅ Complete | D1 migration |
| Implement POST /api/v1/prompts/enhance | ✅ Complete | LLaMA 2 via Workers AI |
| Implement POST /api/v1/prompts/score | ✅ Complete | Quality scoring |
| Implement POST /api/v1/prompts/enhance/:id/feedback | ✅ Complete | Accept/reject |
| Implement GET /api/v1/prompts/templates | ✅ Complete | List templates |
| Implement POST /api/v1/prompts/templates | ✅ Complete | Create template |
| Implement GET /api/v1/prompts/templates/:id | ✅ Complete | Get + placeholders |
| Implement POST /api/v1/prompts/templates/:id/render | ✅ Complete | Variable substitution |
| Implement PATCH /api/v1/prompts/templates/:id | ✅ Complete | Update |
| Implement DELETE /api/v1/prompts/templates/:id | ✅ Complete | Delete |
| Implement GET /api/v1/prompts/usage | ✅ Complete | Statistics |
| Create "Enhance Prompt" button UI | 🔲 Pending | Frontend work |
| Add side-by-side comparison view | 🔲 Pending | Frontend work |
| Add prompt quality score indicator | 🔲 Pending | Frontend work |
| Create enhancement settings panel | 🔲 Pending | Frontend work |

### Phase 7: Cloudflare Deployment 🔄 IN PROGRESS
| Task | Status | Notes |
|------|--------|-------|
| Create KV namespaces (dev/staging/prod) | 🔲 Pending | `wrangler kv:namespace create` |
| Replace placeholder KV IDs in wrangler.toml | 🔲 Pending | Update config |
| Create R2 buckets (dev/staging/prod) | 🔲 Pending | `wrangler r2 bucket create` |
| Deploy Workers API to staging | 🔲 Pending | `pnpm run workers:deploy` |
| Apply D1 migrations to staging | 🔲 Pending | `pnpm run workers:d1:migrate` |
| Build React frontend for Pages | 🔲 Pending | `cd frontend && pnpm build` |
| Deploy frontend to Cloudflare Pages | 🔲 Pending | Via dashboard or CLI |
| Configure custom domain | 🔲 Pending | DNS setup |
| Configure CORS for production | 🔲 Pending | Update wrangler.toml |
| Test end-to-end flow | 🔲 Pending | Manual QA |
| Deploy to production | 🔲 Pending | Final deployment |

### Phase 8: Frontend Integration 🔲 PENDING
| Task | Status | Notes |
|------|--------|-------|
| Create AuthContext for Workers API | 🔲 Pending | Replace current auth |
| Create Login/Signup pages | 🔲 Pending | New pages |
| Create WorkspaceSwitcher component | 🔲 Pending | Header dropdown |
| Create MembersPanel component | 🔲 Pending | Settings page |
| Create InviteModal component | 🔲 Pending | Member invite flow |
| Update TaskCard with assignee avatar | 🔲 Pending | UI enhancement |
| Create AssigneeSelector component | 🔲 Pending | Task assignment |
| Add visibility toggle to task form | 🔲 Pending | Privacy controls |
| Create PromptEnhanceButton component | 🔲 Pending | AI feature |
| Create PromptComparisonDialog | 🔲 Pending | Side-by-side view |
| Create PromptScoreIndicator component | 🔲 Pending | Quality display |
| Create AuditLogViewer component | 🔲 Pending | History view |
| Connect all components to Workers API | 🔲 Pending | API integration |

---

## 🔐 Permission Matrix

| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| workspace.delete | ✅ | ❌ | ❌ | ❌ |
| workspace.settings | ✅ | ✅ | ❌ | ❌ |
| member.invite | ✅ | ✅ | ❌ | ❌ |
| member.remove | ✅ | ✅ | ❌ | ❌ |
| member.role.change | ✅ | ❌ | ❌ | ❌ |
| project.create | ✅ | ✅ | ✅ | ❌ |
| project.edit | ✅ | ✅ | ✅ | ❌ |
| project.delete | ✅ | ✅ | ❌ | ❌ |
| task.create | ✅ | ✅ | ✅ | ❌ |
| task.assign | ✅ | ✅ | ⚠️* | ❌ |
| task.edit | ✅ | ✅ | ⚠️* | ❌ |
| task.delete | ✅ | ✅ | ❌ | ❌ |
| task.view | ✅ | ✅ | ✅ | ✅ |
| prompt.enhance | ✅ | ✅ | ✅ | ❌ |
| prompt.settings.edit | ✅ | ✅ | ❌ | ❌ |
| prompt.template.create | ✅ | ✅ | ✅ | ❌ |

*⚠️ = Only for own tasks or assigned tasks

---

## 🔌 API Endpoints (Workers API)

### Base URL
- **Development:** `http://localhost:8787/api/v1`
- **Staging:** `https://vibe-kanban-api.{account}.workers.dev/api/v1`
- **Production:** `https://api.vibekanban.com/api/v1`

### Authentication
```
POST /auth/signup        ✅ Create new user account
POST /auth/login         ✅ Login and get session token
POST /auth/logout        ✅ Logout and invalidate session
GET  /auth/me            ✅ Get current user info
POST /auth/refresh       ✅ Refresh session token
```

### Users
```
GET   /users/me          ✅ Get current user profile
PATCH /users/me          ✅ Update current user profile
GET   /users/search      ✅ Search users by email/name
GET   /users/:userId     ✅ Get user by ID
```

### Workspaces
```
GET    /workspaces                              ✅ List user's workspaces
POST   /workspaces                              ✅ Create workspace
GET    /workspaces/:id                          ✅ Get workspace details
PATCH  /workspaces/:id                          ✅ Update workspace
DELETE /workspaces/:id                          ✅ Delete workspace (Owner only)
GET    /workspaces/:id/members                  ✅ List members
POST   /workspaces/:id/members/invite           ✅ Invite member
PATCH  /workspaces/:id/members/:userId/role     ✅ Change member role
DELETE /workspaces/:id/members/:userId          ✅ Remove member
GET    /workspaces/:id/prompt-settings          ✅ Get prompt settings
PATCH  /workspaces/:id/prompt-settings          ✅ Update prompt settings
```

### Projects
```
GET    /projects                    ✅ List projects in workspace
POST   /projects                    ✅ Create project
GET    /projects/:projectId         ✅ Get project with task stats
PATCH  /projects/:projectId         ✅ Update project
DELETE /projects/:projectId         ✅ Delete project (soft delete)
```

### Tasks
```
GET    /tasks                       ✅ List tasks with visibility filtering
POST   /tasks                       ✅ Create task
GET    /tasks/:taskId               ✅ Get task with visibility check
PATCH  /tasks/:taskId               ✅ Update task
DELETE /tasks/:taskId               ✅ Delete task
PATCH  /tasks/:taskId/assign        ✅ Assign task to user
PATCH  /tasks/:taskId/visibility    ✅ Change visibility + manage ACL
POST   /tasks/:taskId/enhance       🔲 AI prompt enhancement (placeholder)
```

### Prompts / AI
```
POST   /prompts/enhance                     ✅ Enhance prompt with AI
POST   /prompts/score                       ✅ Score prompt quality
POST   /prompts/enhance/:id/feedback        ✅ Record enhancement feedback
GET    /prompts/templates                   ✅ List prompt templates
POST   /prompts/templates                   ✅ Create prompt template
GET    /prompts/templates/:templateId       ✅ Get template with placeholders
POST   /prompts/templates/:templateId/render ✅ Render template with variables
PATCH  /prompts/templates/:templateId       ✅ Update template
DELETE /prompts/templates/:templateId       ✅ Delete template
GET    /prompts/usage                       ✅ Get usage statistics
```

### Audit
```
GET    /audit                       ✅ List audit logs with filtering
GET    /audit/:auditId              ✅ Get specific audit entry
GET    /audit/entity/:type/:id      ✅ Get entity history
POST   /audit/export                ✅ Export logs to R2 (CSV)
```

---

## 📂 Project Structure

```
vibe-kanban/
├── workers/                        # Cloudflare Workers API ✅ COMPLETE
│   ├── src/
│   │   ├── index.ts               # Hono app entry
│   │   ├── middleware/            # Auth, RBAC, errors
│   │   ├── routes/                # All API routes
│   │   ├── schemas/               # Zod validation
│   │   ├── utils/                 # Password, session
│   │   └── types/                 # TypeScript types
│   ├── migrations/                # D1 migrations (4 files)
│   └── wrangler.toml              # Multi-env config
├── frontend/                       # React + Vite
│   └── src/
│       ├── components/            # 284 components
│       ├── hooks/                 # 86 hooks
│       ├── pages/                 # App pages
│       └── contexts/              # React contexts
├── specs/                          # Architecture docs
├── docs/                           # User documentation
└── crates/                         # Rust backend (existing)
```

---

## 🛠️ Development Commands

```bash
# Install dependencies
pnpm i

# === Workers API (Cloud Backend) ===
cd workers

# Run Workers dev server locally
pnpm run dev

# Apply D1 migrations (local)
pnpm run d1:migrate

# Apply D1 migrations (staging)
pnpm run d1:migrate:staging

# Apply D1 migrations (production)  
pnpm run d1:migrate:prod

# Deploy to staging
pnpm run deploy

# Deploy to production
pnpm run deploy:prod

# === Frontend ===
cd frontend

# Run frontend dev server
pnpm run dev

# Build for production
pnpm run build

# Type check
pnpm run check

# === Full Stack (Rust backend) ===
# Run full stack locally (original Rust backend)
pnpm run dev

# Run QA mode
pnpm run dev:qa
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Create Cloudflare account (if not exists)
- [ ] Install Wrangler CLI: `pnpm add -g wrangler`
- [ ] Login to Cloudflare: `wrangler login`

### Workers API Deployment
```bash
cd workers

# 1. Create KV namespaces
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview

# 2. Update wrangler.toml with KV IDs

# 3. Create R2 bucket
wrangler r2 bucket create vibe-kanban-storage

# 4. Deploy to staging
wrangler deploy --env staging

# 5. Apply migrations to staging
wrangler d1 migrations apply vibe-kanban-db --env staging

# 6. Test staging environment

# 7. Deploy to production
wrangler deploy --env production

# 8. Apply migrations to production
wrangler d1 migrations apply vibe-kanban-db --env production
```

### Frontend Deployment (Pages)
```bash
cd frontend

# 1. Build frontend
pnpm run build

# 2. Deploy to Cloudflare Pages
# Option A: Via Cloudflare Dashboard
# Option B: Via Wrangler
wrangler pages deploy dist --project-name=vibe-kanban
```

### Domain Configuration
1. Add domain to Cloudflare
2. Configure DNS records:
   - `vibekanban.com` → Cloudflare Pages
   - `api.vibekanban.com` → Workers route
3. Enable SSL/TLS (Full strict)
4. Update CORS_ORIGIN in wrangler.toml

---

## 📈 Overall Progress

| Component | Status | Progress |
|-----------|--------|----------|
| Workers API (Backend) | ✅ Complete | █████████████████████ 100% |
| D1 Database | ✅ Complete | █████████████████████ 100% |
| Authentication | ✅ Complete | █████████████████████ 100% |
| RBAC System | ✅ Complete | █████████████████████ 100% |
| Prompt Enhancement | ✅ Complete | █████████████████████ 100% |
| Audit Logging | ✅ Complete | █████████████████████ 100% |
| Cloudflare Setup | 🔲 Pending | ████░░░░░░░░░░░░░░░░░ 20% |
| Frontend Integration | 🔲 Pending | ██░░░░░░░░░░░░░░░░░░░ 10% |
| Domain Setup | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░░ 0% |
| **Overall** | 🔄 In Progress | ████████████████░░░░░ ~75% |

---

## 🎯 Next Steps (Priority Order)

1. **Create KV namespaces** — Run wrangler commands, update wrangler.toml
2. **Deploy Workers API to staging** — Test full API
3. **Build frontend auth integration** — Create login/signup pages
4. **Connect frontend to Workers API** — Replace Rust backend calls
5. **Deploy frontend to Cloudflare Pages**
6. **Configure custom domain**
7. **Production deployment**

---

## ⚠️ Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 database limits | Medium | Monitor usage, optimize queries |
| KV session storage | Low | 7-day TTL, auto-cleanup |
| Workers AI rate limits | Medium | Implement rate limiting in API |
| CORS configuration | Low | Test thoroughly before production |

---

## 📚 References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Hono Framework](https://hono.dev/)
- [Vibe Kanban Docs](https://vibekanban.com/docs)
