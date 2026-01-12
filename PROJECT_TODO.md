# Vibe Kanban Desktop - macOS Electron App with Team RBAC

> **Document Type:** Implementation Plan & Roadmap  
> **Created:** 2026-01-13  
> **Repository:** Forked from [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)

---

## 📋 Overview

This project transforms Vibe Kanban (an AI coding agent orchestration tool) into a macOS Electron desktop application with team-based role access control (RBAC) and task assignment capabilities.

### Target Users
- Developers using multiple coding agents in parallel
- Small teams (2–20) coordinating agent-driven tasks

### Core Goals
1. ✅ Electron-packaged macOS desktop app
2. ✅ Multi-user team workflow with workspace-based tenancy
3. ✅ Role-based access control (Owner/Admin/Member/Viewer)
4. ✅ Task assignment and permissioned visibility
5. ✅ Audit trail for all operations
6. ✅ **AI Prompt Enhancement** — Automatically improve task prompts using prompt engineering best practices

---

## 🏗️ Architecture

### Current Stack (Vibe Kanban)
- **Backend:** Rust (Axum framework)
- **Frontend:** React + TypeScript (Vite, Tailwind)
- **Database:** SQLite with SQLx migrations
- **Distribution:** npx CLI launcher

### Target Stack (Desktop + RBAC)
- **Shell:** Electron (manages backend lifecycle)
- **Backend:** Rust (extended with auth + RBAC)
- **Frontend:** React (extended with team UI)
- **Database:** SQLite (extended with user/workspace/role tables)
- **Auth:** Local auth with secure session storage

---

## 📊 Progress Tracker

### Phase 0: Baseline Fork Setup
| Task | Status | Notes |
|------|--------|-------|
| Clone repository | ✅ Complete | BloopAI/vibe-kanban |
| Understand project structure | ✅ Complete | Rust crates + React frontend |
| Install dependencies | 🔄 In Progress | |
| Verify dev server runs | ⏳ Pending | `pnpm run dev` |
| Understand DB schema | ⏳ Pending | Review migrations |
| Document current API routes | ⏳ Pending | |

### Phase 1: Electron Wrapper (No RBAC)
| Task | Status | Notes |
|------|--------|-------|
| Set up Electron project structure | ⏳ Pending | electron/ directory |
| Create main process (backend launcher) | ⏳ Pending | Child process management |
| Create renderer process (BrowserWindow) | ⏳ Pending | Load existing UI |
| Implement lifecycle management | ⏳ Pending | Start/stop backend |
| Configure Application Support paths | ⏳ Pending | macOS data directory |
| Add app menu with controls | ⏳ Pending | Start/Stop/Logs |
| Test clean shutdown | ⏳ Pending | |
| Build .app bundle | ⏳ Pending | |
| Create DMG installer | ⏳ Pending | |

### Phase 2: Auth + Workspace Primitives
| Task | Status | Notes |
|------|--------|-------|
| Design auth database schema | ⏳ Pending | users, workspaces, roles tables |
| Create SQLx migrations | ⏳ Pending | |
| Implement User model | ⏳ Pending | |
| Implement Workspace model | ⏳ Pending | |
| Implement WorkspaceMember model | ⏳ Pending | |
| Implement Role model | ⏳ Pending | |
| Implement Permission model | ⏳ Pending | |
| Create auth middleware | ⏳ Pending | requireAuth |
| Implement POST /api/auth/signup | ⏳ Pending | |
| Implement POST /api/auth/login | ⏳ Pending | |
| Implement POST /api/auth/logout | ⏳ Pending | |
| Implement GET /api/auth/me | ⏳ Pending | |
| Create login UI | ⏳ Pending | |
| Create workspace creation UI | ⏳ Pending | |
| Gate existing endpoints behind auth | ⏳ Pending | |
| Auto-migrate: first run creates Owner | ⏳ Pending | |

### Phase 3: Workspace & Member Management
| Task | Status | Notes |
|------|--------|-------|
| Implement POST /api/workspaces | ⏳ Pending | Create workspace |
| Implement GET /api/workspaces | ⏳ Pending | List workspaces |
| Implement GET /api/workspaces/:id | ⏳ Pending | Get workspace |
| Implement POST /api/workspaces/:id/invite | ⏳ Pending | Invite member |
| Implement PATCH /api/workspaces/:id/members/:userId | ⏳ Pending | Change role |
| Implement DELETE /api/workspaces/:id/members/:userId | ⏳ Pending | Remove member |
| Create workspace switcher UI | ⏳ Pending | Top-left dropdown |
| Create members management UI | ⏳ Pending | |
| Create invite flow UI | ⏳ Pending | |

### Phase 4: Task Assignment + Permissions
| Task | Status | Notes |
|------|--------|-------|
| Add assigned_to_user_id to tasks | ⏳ Pending | Database migration |
| Add created_by_user_id to tasks | ⏳ Pending | Database migration |
| Add visibility field to tasks | ⏳ Pending | workspace/private/restricted |
| Create task_acl table | ⏳ Pending | Per-task overrides |
| Implement requireWorkspaceRole middleware | ⏳ Pending | |
| Implement requirePermission middleware | ⏳ Pending | |
| Implement requireTaskAccess middleware | ⏳ Pending | |
| Implement PATCH /api/tasks/:taskId/assign | ⏳ Pending | |
| Update task card UI (assignee avatar) | ⏳ Pending | |
| Add "Assigned to me" filter | ⏳ Pending | |
| Add "Unassigned" filter | ⏳ Pending | |
| Add assignee dropdown | ⏳ Pending | |
| Enforce access checks on attempts | ⏳ Pending | |
| Enforce access checks on task edits | ⏳ Pending | |

### Phase 5: Audit Trail + Polish
| Task | Status | Notes |
|------|--------|-------|
| Create audit_log table | ⏳ Pending | |
| Log task status changes | ⏳ Pending | |
| Log assignment changes | ⏳ Pending | |
| Log attempt executions | ⏳ Pending | |
| Log workspace member changes | ⏳ Pending | |
| Implement GET /api/tasks/:taskId/audit | ⏳ Pending | |
| Create audit log viewer UI | ⏳ Pending | |
| Add export logs feature | ⏳ Pending | |
| Electron: "Open project folder" | ⏳ Pending | Finder integration |
| Electron: Global hotkey for task | ⏳ Pending | |
| Electron: Menu bar controls | ⏳ Pending | |
| Electron: Export support bundle | ⏳ Pending | |

### Phase 6: AI Prompt Enhancement Engine
| Task | Status | Notes |
|------|--------|-------|
| Design prompt enhancement architecture | ⏳ Pending | LLM-powered enhancement |
| Create prompt_enhancements table | ⏳ Pending | Store original + enhanced |
| Implement PromptEnhancer service | ⏳ Pending | Rust service layer |
| Integrate with OpenAI/Claude/Local LLM | ⏳ Pending | Configurable provider |
| Add prompt templates library | ⏳ Pending | Best practices templates |
| Implement POST /api/prompts/enhance | ⏳ Pending | Enhancement endpoint |
| Implement GET /api/prompts/:id/versions | ⏳ Pending | View enhancement history |
| Create "Enhance Prompt" button in task UI | ⏳ Pending | One-click enhancement |
| Add side-by-side comparison view | ⏳ Pending | Original vs Enhanced |
| Add prompt diff highlighting | ⏳ Pending | Show what changed |
| Create enhancement settings panel | ⏳ Pending | Configure enhancement style |
| Add "Auto-enhance on create" toggle | ⏳ Pending | Optional auto-enhancement |
| Implement enhancement feedback loop | ⏳ Pending | Learn from user edits |
| Add prompt quality score | ⏳ Pending | Rate prompt effectiveness |

---

## 🤖 AI Prompt Enhancement Engine

### Overview
The AI Prompt Enhancement feature automatically improves task prompts using prompt engineering best practices before they're sent to coding agents. This ensures higher quality outputs from AI agents by applying proven techniques.

### Enhancement Techniques Applied

| Technique | Description | Example |
|-----------|-------------|---------|
| **Clarity & Specificity** | Remove ambiguity, add concrete details | "Fix the bug" → "Fix the null pointer exception in UserService.getUser() when userId is empty" |
| **Context Injection** | Add relevant project/file context | Auto-includes affected file paths, related functions |
| **Structured Format** | Use clear sections (Goal, Context, Constraints) | Reformats free-form text into structured prompt |
| **Success Criteria** | Define what "done" looks like | Adds acceptance criteria and expected behavior |
| **Constraints & Boundaries** | Specify what NOT to do | "Do not modify the database schema" |
| **Step Decomposition** | Break complex tasks into steps | Large task → numbered sub-tasks |
| **Examples & Patterns** | Add relevant code patterns | Includes similar implementations from codebase |
| **Edge Cases** | Prompt to consider edge cases | "Handle: empty input, null values, rate limits" |

### User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Task Creation                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Title: [Fix user authentication bug                    ]           │
│                                                                     │
│  Description:                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Users can't login after password reset. Check the auth     │   │
│  │ service and fix it.                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [✨ Enhance Prompt]  [Auto-enhance: ○ Off]                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Click "Enhance Prompt"
┌─────────────────────────────────────────────────────────────────────┐
│                    Prompt Enhancement View                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────┐              │
│  │   ORIGINAL (45 pts)  │    │  ENHANCED (92 pts)   │              │
│  ├──────────────────────┤    ├──────────────────────┤              │
│  │ Users can't login    │    │ ## Goal              │              │
│  │ after password reset.│    │ Fix authentication   │              │
│  │ Check the auth       │    │ failure after pwd    │              │
│  │ service and fix it.  │    │ reset in AuthService │              │
│  │                      │    │                      │              │
│  │                      │    │ ## Context           │              │
│  │                      │    │ - File: src/auth/... │              │
│  │                      │    │ - Related: UserRepo  │              │
│  │                      │    │                      │              │
│  │                      │    │ ## Requirements      │              │
│  │                      │    │ 1. Verify token...   │              │
│  │                      │    │ 2. Check password... │              │
│  │                      │    │                      │              │
│  │                      │    │ ## Success Criteria  │              │
│  │                      │    │ - User can login...  │              │
│  │                      │    │ - Tests pass...      │              │
│  └──────────────────────┘    └──────────────────────┘              │
│                                                                     │
│  [← Keep Original]  [Edit Enhanced]  [✓ Use Enhanced →]            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Prompt enhancement history
CREATE TABLE prompt_enhancements (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    original_prompt TEXT NOT NULL,
    enhanced_prompt TEXT NOT NULL,
    enhancement_model TEXT NOT NULL,        -- e.g., 'gpt-4', 'claude-3', 'local-llama'
    techniques_applied TEXT NOT NULL,       -- JSON array of techniques used
    original_score INTEGER,                 -- Quality score 0-100
    enhanced_score INTEGER,                 -- Quality score 0-100
    user_accepted BOOLEAN,                  -- Did user use the enhancement?
    user_edited BOOLEAN,                    -- Did user modify after enhancement?
    final_prompt TEXT,                      -- What was actually used
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Enhancement templates (reusable patterns)
CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    workspace_id TEXT REFERENCES workspaces_team(id),
    name TEXT NOT NULL,
    description TEXT,
    template_text TEXT NOT NULL,            -- Template with {{placeholders}}
    category TEXT,                          -- bug-fix, feature, refactor, docs
    is_global BOOLEAN DEFAULT FALSE,        -- Available to all workspaces
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Enhancement settings per workspace
CREATE TABLE prompt_enhancement_settings (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces_team(id),
    auto_enhance_enabled BOOLEAN DEFAULT FALSE,
    preferred_model TEXT DEFAULT 'gpt-4',
    enhancement_style TEXT DEFAULT 'balanced', -- minimal, balanced, comprehensive
    include_codebase_context BOOLEAN DEFAULT TRUE,
    include_git_history BOOLEAN DEFAULT FALSE,
    custom_instructions TEXT,               -- Additional enhancement rules
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### API Endpoints

```
POST /api/prompts/enhance
    Body: { taskId?, prompt, options? }
    Response: { original, enhanced, techniques, scores, diff }

GET /api/prompts/:taskId/history
    Response: [{ original, enhanced, model, accepted, createdAt }]

POST /api/prompts/templates
    Body: { name, template, category }
    Response: { id, name, template }

GET /api/prompts/templates
    Query: ?category=bug-fix
    Response: [{ id, name, template, usageCount }]

PATCH /api/workspaces/:id/prompt-settings
    Body: { autoEnhance, preferredModel, style }
    Response: { settings }

POST /api/prompts/feedback
    Body: { enhancementId, helpful: boolean, finalPrompt? }
    Response: { success }
```

### Enhancement Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PromptEnhancerService                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │   Analyze   │───▶│   Enhance    │───▶│    Score &      │   │
│  │   Prompt    │    │   with LLM   │    │    Compare      │   │
│  └─────────────┘    └──────────────┘    └─────────────────┘   │
│         │                  │                     │             │
│         ▼                  ▼                     ▼             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │  Context    │    │   Template   │    │   Diff          │   │
│  │  Gatherer   │    │   Library    │    │   Generator     │   │
│  └─────────────┘    └──────────────┘    └─────────────────┘   │
│         │                                                      │
│         ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Context Sources                             │  │
│  │  • Project files  • Git history  • Related tasks         │  │
│  │  • Code patterns  • Error logs   • Team conventions      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Prompt Quality Scoring

The system scores prompts on these dimensions (0-100 total):

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| Clarity | 20% | No ambiguous terms, clear objective |
| Specificity | 20% | Concrete details, file paths, function names |
| Context | 15% | Relevant background information |
| Structure | 15% | Organized sections, numbered steps |
| Constraints | 10% | Boundaries defined, what to avoid |
| Testability | 10% | Clear success criteria |
| Completeness | 10% | All necessary info included |

### LLM Provider Configuration

```yaml
# config/prompt-enhancement.yaml
providers:
  openai:
    model: gpt-4-turbo
    api_key: ${OPENAI_API_KEY}
    max_tokens: 2000
    
  anthropic:
    model: claude-3-opus
    api_key: ${ANTHROPIC_API_KEY}
    max_tokens: 2000
    
  local:
    model: llama-3-70b
    endpoint: http://localhost:11434
    
default_provider: openai

enhancement_prompt: |
  You are a prompt engineering expert. Enhance the following task prompt
  for an AI coding agent. Apply these techniques:
  
  1. Add clear structure (Goal, Context, Requirements, Success Criteria)
  2. Include specific file paths and function names when relevant
  3. Define what success looks like
  4. Add constraints (what NOT to do)
  5. Break complex tasks into steps
  
  Original prompt:
  {{original_prompt}}
  
  Project context:
  {{project_context}}
  
  Respond with the enhanced prompt only.
```

---

### New Tables (Phase 2-5)

```sql
-- Users table
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Workspaces table (team containers)
CREATE TABLE workspaces_team (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Roles table
CREATE TABLE roles (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    workspace_id TEXT REFERENCES workspaces_team(id),
    name TEXT NOT NULL, -- Owner, Admin, Member, Viewer
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Permissions table
CREATE TABLE permissions (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    key TEXT NOT NULL UNIQUE, -- e.g., task.create, task.assign, attempt.run
    description TEXT
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Workspace members
CREATE TABLE workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces_team(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id),
    status TEXT DEFAULT 'active', -- active, invited, suspended
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

-- Audit log
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
    workspace_id TEXT REFERENCES workspaces_team(id),
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL, -- task, workspace, project, attempt
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- created, updated, assigned, executed, etc.
    payload_json TEXT, -- JSON details of the change
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Task ACL (per-task access overrides)
CREATE TABLE task_acl (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_level TEXT NOT NULL, -- view, comment, run, admin
    PRIMARY KEY (task_id, user_id)
);
```

### Modified Tables

```sql
-- Tasks table additions
ALTER TABLE tasks ADD COLUMN assigned_to_user_id TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN created_by_user_id TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN visibility TEXT DEFAULT 'workspace'; -- workspace, private, restricted
ALTER TABLE tasks ADD COLUMN team_workspace_id TEXT REFERENCES workspaces_team(id);

-- Projects table additions
ALTER TABLE projects ADD COLUMN team_workspace_id TEXT REFERENCES workspaces_team(id);
```

---

## 🔐 Permission Matrix

| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| workspace.delete | ✅ | ❌ | ❌ | ❌ |
| workspace.settings | ✅ | ✅ | ❌ | ❌ |
| member.invite | ✅ | ✅ | ❌ | ❌ |
| member.remove | ✅ | ✅ | ❌ | ❌ |
| member.role.change | ✅ | ✅ | ❌ | ❌ |
| project.create | ✅ | ✅ | ✅ | ❌ |
| project.delete | ✅ | ✅ | ❌ | ❌ |
| task.create | ✅ | ✅ | ✅ | ❌ |
| task.assign | ✅ | ✅ | ⚠️* | ❌ |
| task.edit | ✅ | ✅ | ⚠️* | ❌ |
| task.delete | ✅ | ✅ | ❌ | ❌ |
| attempt.run | ✅ | ✅ | ⚠️* | ❌ |
| attempt.approve | ✅ | ✅ | ⚠️* | ❌ |
| task.view.private | ✅ | ✅ | ⚠️* | ❌ |

*⚠️ = Only for own tasks or assigned tasks

---

## 🔌 API Endpoints (New)

### Authentication
```
POST /api/auth/signup       - Create new user account
POST /api/auth/login        - Login and get session
POST /api/auth/logout       - Logout and clear session
GET  /api/auth/me           - Get current user info
```

### Workspaces
```
POST   /api/workspaces                          - Create workspace
GET    /api/workspaces                          - List user's workspaces
GET    /api/workspaces/:id                      - Get workspace details
PATCH  /api/workspaces/:id                      - Update workspace
DELETE /api/workspaces/:id                      - Delete workspace
POST   /api/workspaces/:id/invite               - Invite member
GET    /api/workspaces/:id/members              - List members
PATCH  /api/workspaces/:id/members/:userId      - Update member role
DELETE /api/workspaces/:id/members/:userId      - Remove member
```

### Projects (Updated)
```
POST /api/workspaces/:id/projects               - Create project in workspace
GET  /api/workspaces/:id/projects               - List projects in workspace
```

### Tasks (Updated)
```
PATCH /api/tasks/:taskId/assign                 - Assign task to user
GET   /api/tasks/:taskId/audit                  - Get task audit log
```

---

## 📂 Project Structure (New Directories)

```
Vibekanban-app/
├── electron/                    # NEW: Electron app
│   ├── main/
│   │   ├── index.ts            # Main process entry
│   │   ├── backend.ts          # Backend process manager
│   │   ├── menu.ts             # App menu
│   │   └── paths.ts            # macOS paths helper
│   ├── preload/
│   │   └── index.ts            # Preload scripts
│   ├── package.json
│   └── electron-builder.yml    # Build configuration
├── crates/
│   ├── db/
│   │   ├── migrations/
│   │   │   ├── 20260113_add_users.sql           # NEW
│   │   │   ├── 20260113_add_workspaces_team.sql # NEW
│   │   │   ├── 20260113_add_roles.sql           # NEW
│   │   │   ├── 20260113_add_audit.sql           # NEW
│   │   │   ├── 20260113_add_prompt_enhancements.sql  # NEW: AI feature
│   │   │   └── 20260113_add_prompt_templates.sql     # NEW: AI feature
│   │   └── src/models/
│   │       ├── user.rs         # NEW
│   │       ├── workspace_team.rs # NEW
│   │       ├── role.rs         # NEW
│   │       ├── audit.rs        # NEW
│   │       ├── prompt_enhancement.rs  # NEW: AI feature
│   │       └── prompt_template.rs     # NEW: AI feature
│   └── server/src/
│       ├── middleware/
│       │   ├── auth.rs         # NEW: Auth middleware
│       │   └── rbac.rs         # NEW: RBAC middleware
│       ├── services/
│       │   └── prompt_enhancer.rs  # NEW: AI enhancement service
│       └── routes/
│           ├── auth.rs         # NEW
│           ├── workspaces_team.rs # NEW
│           └── prompts.rs      # NEW: AI enhancement routes
├── config/
│   └── prompt-enhancement.yaml # NEW: AI provider config
└── frontend/src/
    ├── components/
    │   ├── auth/               # NEW
    │   │   ├── LoginForm.tsx
    │   │   └── SignupForm.tsx
    │   ├── workspace/          # NEW
    │   │   ├── WorkspaceSwitcher.tsx
    │   │   ├── MembersPanel.tsx
    │   │   └── InviteModal.tsx
    │   ├── prompt/             # NEW: AI feature
    │   │   ├── EnhanceButton.tsx
    │   │   ├── PromptComparisonView.tsx
    │   │   ├── PromptDiffView.tsx
    │   │   ├── PromptScoreIndicator.tsx
    │   │   ├── TemplateSelector.tsx
    │   │   └── EnhancementSettings.tsx
    │   └── task/
    │       ├── AssigneeSelector.tsx  # NEW
    │       └── TaskCard.tsx          # MODIFIED
    ├── contexts/
    │   ├── AuthContext.tsx     # NEW
    │   └── PromptEnhancerContext.tsx  # NEW: AI feature
    ├── hooks/
    │   └── usePromptEnhancer.ts  # NEW: AI feature
    └── pages/
        ├── Login.tsx           # NEW
        ├── WorkspaceSettings.tsx # NEW
        └── PromptSettings.tsx  # NEW: AI feature
```

---

## 🎯 Current Sprint

### Sprint 0 (Current): Foundation
**Goal:** Get the development environment working and understand the codebase

- [ ] Install all dependencies (`pnpm i`)
- [ ] Run development server (`pnpm run dev`)
- [ ] Explore existing database schema
- [ ] Document all existing API endpoints
- [ ] Test basic functionality

### Next Steps
1. Complete Phase 0 setup
2. Begin Electron wrapper (Phase 1)

---

## 🛠️ Development Commands

```bash
# Install dependencies
pnpm i

# Run development server (frontend + backend)
pnpm run dev

# Run QA testing mode
pnpm run dev:qa

# Run backend only (watch mode)
pnpm run backend:dev:watch

# Run frontend only
pnpm run frontend:dev

# Generate TypeScript types from Rust
pnpm run generate-types

# Run Rust tests
cargo test --workspace

# Build frontend
cd frontend && pnpm build

# Local build (macOS)
./local-build.sh
```

---

## ⚠️ Known Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite concurrency/locking | High | Enable WAL mode, keep transactions short |
| Scope creep to cloud sync | High | Keep v1 as shared-instance only |
| Agent safety vs RBAC | High | Guard `attempt.run` and agent config access |
| Electron binary size | Medium | Use electron-builder optimization |
| Cross-platform later | Low | Focus on macOS first, abstract paths |

---

## 📝 Notes

- The existing `workspaces` table in Vibe Kanban is for task worktrees (git workspaces), not team workspaces. We're creating `workspaces_team` to avoid confusion.
- Backend binds to 127.0.0.1 only for security
- Auth sessions will use secure cookies or Electron's secure storage
- Secrets stored in macOS Keychain via Electron safe storage module

---

## 📚 References

- [Vibe Kanban Docs](https://vibekanban.com/docs)
- [Electron Documentation](https://www.electronjs.org/docs)
- [SQLx Migrations](https://github.com/launchbadge/sqlx)
- [Axum Framework](https://github.com/tokio-rs/axum)
