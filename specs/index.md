# Architecture Documentation

> **Project:** Vibe Kanban
> **Version:** 1.0 (Draft)
> **Last Updated:** 2026-01-13
> **Platform:** Cloudflare (Pages, Workers, D1, R2, Access, AI Gateway)

---

## Overview

Vibe Kanban is a **web application** for AI coding agent orchestration, featuring team-based role access control (RBAC), task assignment capabilities, and AI-powered prompt enhancement. Built entirely on **Cloudflare's edge platform** for global low-latency access.

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Cloudflare Pages (React + Vite) |
| API | Cloudflare Workers (Hono) |
| Database | Cloudflare D1 (SQLite) |
| Storage | Cloudflare R2 |
| Auth | Cloudflare Access (Zero Trust) |
| AI | Cloudflare AI Gateway |
| Cache | Cloudflare Workers KV |

---

## Documents

### [Brief (Normalized)](./brief-normalized.md)
Structured version of the original product brief with goals, users, workflows, and constraints. Start here to understand the project scope and requirements.

**Key contents:**
- Project goals and non-goals
- User personas (Solo Developer, Team Lead, Team Member)
- Role hierarchy (Owner/Admin/Member/Viewer)
- Permission matrix
- Key workflows (onboarding, task assignment, prompt enhancement)
- Technical constraints and platform requirements

---

### [Backend Specifications](./backend-specs.md)
**Start here for implementation.** Contains the canonical domain model (source of truth), database schema, services, auth, background jobs, and observability.

**Key contents:**
- **Canonical Domain Model** - All entity definitions with fields, types, and relationships
- New entities: User, WorkspaceTeam, Role, Permission, WorkspaceMember, AuditLog, TaskAcl
- Modified entities: Task (assignment, visibility), Project (team ownership)
- AI entities: PromptEnhancement, PromptTemplate, PromptEnhancementSettings
- Complete SQL migration scripts
- Authentication strategy (local auth, macOS Keychain)
- Authorization middleware design
- Service layer architecture
- Error code taxonomy

---

### [API Documentation](./api-docs.md)
Complete endpoint catalog with request/response schemas, authentication, and error handling.

**Key contents:**
- Authentication endpoints (signup, login, logout, refresh)
- User management endpoints
- Team workspace CRUD
- Member management (invite, remove, role change)
- Task endpoints with assignment and visibility
- Prompt enhancement API
- Prompt templates CRUD
- Audit log queries
- WebSocket event specifications
- Pagination and filtering conventions

---

### [Frontend Specifications](./frontend-specs.md)
Screen-by-screen breakdown with component-level detail, API dependencies, and data schemas.

**Key contents:**
- Authentication screens (login, signup)
- Workspace switcher and settings
- Team management UI (members list, invite, role change)
- Task assignment UI (assignee selector, visibility toggle)
- Prompt enhancement UI (enhance button, comparison dialog, quality scores)
- Prompt templates (picker, management page, editor)
- Prompt settings panel
- Audit log viewer
- Component specifications with props, state, and API dependencies
- Design system tokens (colors, typography, spacing)

---

### [AI Services](./ai-services.md)
LLM features, model gateway, prompts, RAG, guardrails, and cost controls.

**Key contents:**
- AI feature inventory (enhancement, scoring, context extraction)
- Model gateway architecture (OpenAI, Anthropic, Ollama)
- Prompt enhancement pipeline
- Built-in prompt templates (bug-fix, feature, refactor, docs, test)
- Enhancement techniques catalog
- Quality scoring rubric (0-100 scale)
- Safety guardrails (PII detection, content filtering)
- Evaluation framework (A/B testing, feedback collection)
- Cost controls and budgets
- Local LLM support via Ollama

---

### [Decisions Log](./decisions.md)
Architectural decisions made and assumptions used during spec generation.

**Key contents:**
- Authentication approach choice
- Database and tenancy decisions
- RBAC model decisions
- Prompt enhancement architecture choices
- Technology stack selections

---

### [Open Questions](./open-questions.md)
Uncertainties and items requiring clarification before implementation.

**Key contents:**
- Questions by priority (blocking, high, medium, low)
- Implementation uncertainties
- UX decisions pending user research
- Future scope considerations

---

## Navigation Tips

1. **Start with Backend Specs** for the canonical domain model - all other specs reference these entity definitions
2. **API Documentation** defines all available endpoints and their contracts
3. **Frontend Specs** shows which endpoints each screen uses and component architecture
4. **AI Services** contains the prompt enhancement feature details
5. All specs maintain **naming consistency** for entities, routes, and permissions

---

## Implementation Phases

| Phase | Focus | Primary Docs |
|-------|-------|--------------|
| 0 | Baseline Setup | brief-normalized.md |
| 1 | Tauri v2 Wrapper | backend-specs.md (deployment) |
| 2 | Auth + Workspace Primitives | backend-specs.md, api-docs.md |
| 3 | Workspace & Member Management | frontend-specs.md, api-docs.md |
| 4 | Task Assignment + Permissions | all specs |
| 5 | Audit Trail + Polish | backend-specs.md, frontend-specs.md |
| 6 | AI Prompt Enhancement | ai-services.md, frontend-specs.md |

---

## Quick Reference

### Entity Names (Canonical)
| Entity | Table Name | Description |
|--------|------------|-------------|
| User | users | Person with login credentials |
| WorkspaceTeam | workspaces_team | Team container for RBAC |
| Role | roles | Permission set |
| Permission | permissions | Individual permission |
| WorkspaceMember | workspace_members | User-workspace relationship |
| AuditLog | audit_log | Operation history |
| Task | tasks | Unit of work |
| Workspace | workspaces | Git worktree (existing) |
| PromptEnhancement | prompt_enhancements | Enhanced prompt record |
| PromptTemplate | prompt_templates | Reusable prompt template |

### API Base Paths
| Domain | Base Path |
|--------|-----------|
| Authentication | /api/auth |
| Users | /api/users |
| Team Workspaces | /api/workspaces-team |
| Projects | /api/projects |
| Tasks | /api/tasks |
| Prompts | /api/prompts |
| Templates | /api/prompt-templates |

### Permission Keys
| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| workspace.delete | Yes | - | - | - |
| workspace.settings | Yes | Yes | - | - |
| member.invite | Yes | Yes | - | - |
| task.create | Yes | Yes | Yes | - |
| task.assign | Yes | Yes | Own | - |
| attempt.run | Yes | Yes | Own | - |
| prompt.enhance | Yes | Yes | Yes | - |
