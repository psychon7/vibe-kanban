# Vibe Kanban - Normalized Brief

> **Document Type:** Normalized Product Brief
> **Source:** PROJECT_TODO.md
> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Platform:** Cloudflare (Pages, Workers, D1, R2, Access, AI Gateway)

---

## 1. Project Overview

### 1.1 Project Name
**Vibe Kanban Desktop** - macOS Electron App with Team RBAC

### 1.2 Purpose
Transform Vibe Kanban (an AI coding agent orchestration tool) into a macOS Electron desktop application with team-based role access control (RBAC), task assignment capabilities, and AI-powered prompt enhancement.

### 1.3 Repository Origin
Forked from [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)

---

## 2. Goals and Non-Goals

### 2.1 Goals (In Scope)
1. **Electron Desktop App** — Package as a native macOS desktop application
2. **Multi-User Team Workflow** — Support workspace-based tenancy for teams
3. **Role-Based Access Control (RBAC)** — Implement Owner/Admin/Member/Viewer roles
4. **Task Assignment** — Enable task assignment with permissioned visibility
5. **Audit Trail** — Log all operations for compliance and debugging
6. **AI Prompt Enhancement** — Automatically improve task prompts using prompt engineering best practices

### 2.2 Non-Goals (Out of Scope for v1)
1. Cloud sync — v1 is shared-instance only
2. Cross-platform support — Focus on macOS first
3. Mobile applications
4. Real-time collaboration (like Google Docs-style co-editing)

---

## 3. Target Users

### 3.1 Primary Personas

#### Persona 1: Solo Developer
- Uses multiple AI coding agents in parallel
- Needs to organize and track agent-driven tasks
- Wants better prompts for more effective agent responses

#### Persona 2: Small Team Lead (2-20 developers)
- Coordinates agent-driven tasks across team members
- Needs visibility into team workload and task status
- Requires access control for sensitive projects

#### Persona 3: Team Member
- Works on assigned tasks using AI coding agents
- Needs clear, well-structured prompts for efficiency
- Requires filtered view of relevant tasks

---

## 4. User Roles and Permissions

### 4.1 Role Hierarchy
| Role | Description |
|------|-------------|
| **Owner** | Workspace creator, full control, cannot be demoted |
| **Admin** | Full permissions except workspace deletion |
| **Member** | Can create/edit own tasks, limited assignment |
| **Viewer** | Read-only access to workspace content |

### 4.2 Permission Matrix
| Permission | Owner | Admin | Member | Viewer |
|------------|-------|-------|--------|--------|
| workspace.delete | Yes | No | No | No |
| workspace.settings | Yes | Yes | No | No |
| member.invite | Yes | Yes | No | No |
| member.remove | Yes | Yes | No | No |
| member.role.change | Yes | Yes | No | No |
| project.create | Yes | Yes | Yes | No |
| project.delete | Yes | Yes | No | No |
| task.create | Yes | Yes | Yes | No |
| task.assign | Yes | Yes | Own* | No |
| task.edit | Yes | Yes | Own* | No |
| task.delete | Yes | Yes | No | No |
| attempt.run | Yes | Yes | Own* | No |
| attempt.approve | Yes | Yes | Own* | No |
| task.view.private | Yes | Yes | Own* | No |

*Own = Only for own tasks or assigned tasks

---

## 5. Key Workflows

### 5.1 User Onboarding Flow
1. User launches Electron app for the first time
2. App prompts for account creation (local auth)
3. First user becomes Owner of default workspace
4. User can invite team members via email

### 5.2 Task Creation with Prompt Enhancement
1. User creates a new task with title and description
2. User clicks "Enhance Prompt" button (optional)
3. System shows side-by-side comparison (original vs enhanced)
4. User can accept, edit, or keep original
5. Enhanced prompt includes: Goal, Context, Requirements, Success Criteria

### 5.3 Task Assignment Flow
1. Admin/Owner opens task
2. Selects assignee from team members dropdown
3. Assignee receives notification (future: in-app notifications)
4. Task appears in assignee's "Assigned to me" filter

### 5.4 Agent Execution Flow
1. User with permission clicks "Run" on a task
2. System executes the AI coding agent
3. Attempt is logged with full audit trail
4. Results display in task history

### 5.5 Workspace Management
1. Owner/Admin accesses workspace settings
2. Can invite new members via email
3. Can change member roles
4. Can remove members (except self if Owner)

---

## 6. Technical Constraints

### 6.1 Current Stack (Inherited)
- **Backend:** Rust (Axum framework)
- **Frontend:** React + TypeScript (Vite, Tailwind)
- **Database:** SQLite with SQLx migrations
- **Distribution:** Currently npx CLI launcher

### 6.2 Target Stack (Cloudflare)
- **Frontend:** Cloudflare Pages (React + Vite + Tailwind)
- **Backend:** Cloudflare Workers (TypeScript + Hono)
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Storage:** Cloudflare R2 (avatars, attachments, exports)
- **Auth:** Cloudflare Access (Zero Trust, SSO)
- **AI:** Cloudflare AI Gateway (OpenAI, Anthropic proxy)
- **Cache:** Cloudflare Workers KV (sessions, rate limits)

### 6.3 Platform Requirements
- **Primary:** Web browser (any modern browser)
- **Hosting:** Cloudflare edge (300+ global locations)
- **Offline:** Not supported (requires internet)

### 6.4 Performance Requirements
- Global edge deployment for low latency
- D1 read replicas near users
- AI Gateway caching for repeated prompts
- Workers KV for session and rate limit caching

---

## 7. Required Integrations

### 7.1 AI/LLM Providers (for Prompt Enhancement)
- **OpenAI** (GPT-4-turbo)
- **Anthropic** (Claude 3)
- **Local LLM** (Llama 3 via Ollama)
- Configurable provider selection per workspace

### 7.2 System Integrations
- **macOS Keychain** — Secure credential storage via Electron safe storage
- **Finder** — "Open project folder" integration
- **System Notifications** — Native macOS notifications

### 7.3 Development Integrations
- **Git** — Project context awareness for prompt enhancement
- **File System** — Code pattern extraction for context injection

---

## 8. Success Metrics

### 8.1 Adoption Metrics
- Number of workspaces created
- Team size per workspace
- Daily active users

### 8.2 Engagement Metrics
- Tasks created per day
- Prompt enhancement usage rate
- Enhanced prompt acceptance rate
- User edits to enhanced prompts (feedback loop)

### 8.3 Quality Metrics
- Average prompt quality score improvement
- Task completion rate
- Agent execution success rate

### 8.4 Technical Metrics
- App startup time < 3 seconds
- Backend ready time < 2 seconds
- Prompt enhancement latency < 5 seconds

---

## 9. Naming Clarifications

### 9.1 Workspace Disambiguation
- **`workspaces` table (existing):** Git worktrees for task execution
- **`workspaces_team` table (new):** Team containers for RBAC

### 9.2 Key Entity Names
| Entity | Description |
|--------|-------------|
| User | A person with login credentials |
| WorkspaceTeam | A team container with members and roles |
| Role | Permission set (Owner/Admin/Member/Viewer) |
| Project | A collection of tasks within a workspace |
| Task | A unit of work to be done by an AI agent |
| Attempt | A single execution of a task by an agent |
| PromptEnhancement | An improved version of a task prompt |

---

## 10. Implementation Phases

### Phase 0: Baseline Setup
Understand and run the existing codebase

### Phase 1: Electron Wrapper
Package as macOS desktop app (no RBAC yet)

### Phase 2: Auth + Workspace Primitives
User accounts, workspaces, roles, permissions

### Phase 3: Workspace & Member Management
Invite, remove, change roles, workspace switcher UI

### Phase 4: Task Assignment + Permissions
Assignee field, visibility controls, access middleware

### Phase 5: Audit Trail + Polish
Operation logging, audit viewer, Electron enhancements

### Phase 6: AI Prompt Enhancement
LLM integration, prompt templates, quality scoring

---

## 11. Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| SQLite concurrency/locking | High | Enable WAL mode, keep transactions short |
| Scope creep to cloud sync | High | Keep v1 as shared-instance only |
| Agent safety vs RBAC | High | Guard `attempt.run` and agent config access |
| Electron binary size | Medium | Use electron-builder optimization |
| Cross-platform later | Low | Focus on macOS first, abstract paths |

---

## 12. Open Questions (Initial)

1. **Notification System:** How should users be notified of assignments and updates? (In-app only vs system notifications vs both)

2. **Offline Support:** Should the app work fully offline, or require network for LLM features?

3. **Data Migration:** How to handle existing Vibe Kanban users' data when upgrading?

4. **Backup Strategy:** Should the app auto-backup the SQLite database? Where?

5. **Update Mechanism:** How will the Electron app receive updates? (Auto-update vs manual download)
