# Architectural Decisions Log

> **Document Type:** Decision Record
> **Created:** 2026-01-13
> **Updated:** 2026-01-13

This document records the architectural decisions made during specification generation, including rationale and alternatives considered.

---

## Decision Index

| ID | Decision | Status |
|----|----------|--------|
| ADR-001 | Full Cloudflare Stack | Accepted |
| ADR-002 | Cloudflare D1 for Database | Accepted |
| ADR-003 | Cloudflare Access for Authentication | Accepted |
| ADR-004 | Cloudflare AI Gateway for LLM | Accepted |
| ADR-005 | Cloudflare R2 for Storage | Accepted |
| ADR-006 | Separate WorkspaceTeam from existing Workspace | Accepted |
| ADR-007 | RBAC with four fixed roles | Accepted |
| ADR-008 | Task visibility model | Accepted |
| ADR-009 | 30-day session duration | Accepted |
| ADR-010 | User-provided API keys | Accepted |
| ADR-011 | No offline support | Accepted |
| ADR-012 | Per-user rate limiting | Accepted |

---

## ADR-001: Full Cloudflare Stack

**Status:** Accepted

**Context:**
Need to choose infrastructure for hosting the application. Options include traditional cloud (AWS, GCP), Tauri v2 desktop, or edge computing platforms.

**Decision:**
Use Cloudflare's full platform stack:
- **Pages** for frontend hosting
- **Workers** for API/backend
- **D1** for database
- **R2** for file storage
- **Access** for authentication
- **AI Gateway** for LLM integration
- **KV** for caching and rate limiting

**Rationale:**
- **Global edge deployment** - Low latency worldwide (300+ locations)
- **Serverless** - No infrastructure to manage
- **Integrated ecosystem** - All services work together seamlessly
- **Cost effective** - Generous free tiers, pay-per-use pricing
- **Built-in security** - DDoS protection, WAF, Zero Trust auth
- **Developer experience** - Wrangler CLI, preview deployments

**Alternatives Considered:**
- Tauri v2 + Rust + SQLite: Good for desktop-only, but limits collaboration
- AWS/GCP: More complex, higher cost, more setup
- Vercel + Supabase: Good alternative, but less integrated

**Consequences:**
- Vendor lock-in to Cloudflare ecosystem
- Must work within Workers limitations (CPU time, memory)
- D1 has some SQLite limitations (no extensions)

---

## ADR-002: Cloudflare D1 for Database

**Status:** Accepted

**Context:**
Need a database for storing users, workspaces, tasks, and audit logs.

**Decision:**
Use Cloudflare D1 (SQLite at the edge).

**Rationale:**
- **Familiar SQLite** - Standard SQL, well understood
- **Edge replicated** - Read replicas near users globally
- **Zero configuration** - No connection strings, pooling, etc.
- **Cost effective** - Generous free tier (5GB, 5M reads/day)
- **Migrations** - Built-in migration support via Wrangler

**Limitations:**
- 10GB max database size
- No SQLite extensions
- Write latency to primary (acceptable for this use case)

**Alternatives Considered:**
- Supabase/PostgreSQL: More features but more complex
- PlanetScale: MySQL, good but not integrated with CF
- Turso: LibSQL, similar to D1 but separate service

---

## ADR-003: Cloudflare Access for Authentication

**Status:** Accepted

**Context:**
Need to authenticate users for RBAC. Options include local auth, OAuth, or Zero Trust.

**Decision:**
Use Cloudflare Access (Zero Trust) for authentication.

**Rationale:**
- **SSO built-in** - Google, GitHub, SAML, OIDC supported
- **30-day sessions** - Per user requirement
- **Zero Trust model** - Every request authenticated at edge
- **No password management** - No password storage, reset flows
- **Audit logging** - Built-in access logs

**Identity Providers:**
- Google (primary)
- GitHub (developers)
- Email OTP (fallback)

**Alternatives Considered:**
- Local auth: Must manage passwords, recovery, security
- Auth0/Clerk: Good but additional service/cost
- Firebase Auth: Not integrated with CF

**Consequences:**
- Users must have Google/GitHub account or use email OTP
- Requires Cloudflare account to configure Access
- Some setup complexity for Access policies

---

## ADR-004: Cloudflare AI Gateway for LLM

**Status:** Accepted

**Context:**
Need to integrate LLM providers for prompt enhancement feature.

**Decision:**
Use Cloudflare AI Gateway as proxy to OpenAI and Anthropic.

**Rationale:**
- **Built-in caching** - Cache identical prompts, reduce costs 30-50%
- **Rate limiting** - Configurable per user/workspace
- **Logging** - Full request/response logging for debugging
- **Analytics** - Token usage, latency dashboards
- **Fallback** - Automatic failover between providers
- **Cost tracking** - Per-request cost visibility

**Configuration:**
```toml
[[ai.gateway]]
id = "vibe-kanban-ai"
binding = "AI_GATEWAY"
```

**Alternatives Considered:**
- Direct API calls: No caching, no logging, harder to manage
- LangChain: Overkill for prompt enhancement
- Custom proxy: More work to build

**Consequences:**
- Requests routed through Cloudflare (additional hop)
- Must configure gateway in CF dashboard
- API key storage in Workers Secrets

---

## ADR-005: Cloudflare R2 for Storage

**Status:** Accepted

**Context:**
Need object storage for avatars, attachments, and exports.

**Decision:**
Use Cloudflare R2 for file storage.

**Rationale:**
- **S3-compatible** - Familiar API
- **No egress fees** - Major cost savings vs AWS S3
- **Integrated** - Direct access from Workers
- **Global CDN** - Fast delivery worldwide

**Use Cases:**
| Content | Path | Access |
|---------|------|--------|
| Avatars | `avatars/{userId}.*` | Public |
| Attachments | `attachments/{taskId}/*` | Authenticated |
| Exports | `exports/{workspaceId}/*` | Authenticated |

**Alternatives Considered:**
- AWS S3: Egress fees, separate service
- Cloudinary: Good for images but overkill
- Base64 in DB: Poor performance for large files

---

## ADR-006: Separate WorkspaceTeam Entity

**Status:** Accepted

**Context:**
The existing codebase has a `workspaces` table representing git worktrees. We need a new concept for team containers with RBAC.

**Decision:**
Create a new `workspaces_team` table for team containers, keeping the existing `workspaces` table for git worktrees.

**Rationale:**
- Avoids breaking existing functionality
- Clear semantic separation (team vs code workspace)
- Allows gradual migration
- Existing `Workspace` entity is deeply integrated with task execution

**Alternatives Considered:**
- Rename existing workspaces: High risk of breaking changes
- Add team_id to existing workspaces: Conflates two different concepts

---

## ADR-007: Four Fixed Roles

**Status:** Accepted

**Context:**
Need to define role hierarchy for RBAC.

**Decision:**
Implement four fixed roles: Owner, Admin, Member, Viewer.

**Permission Matrix:**
| Permission | Owner | Admin | Member | Viewer |
|------------|:-----:|:-----:|:------:|:------:|
| workspace.delete | Yes | No | No | No |
| workspace.settings | Yes | Yes | No | No |
| member.invite | Yes | Yes | No | No |
| project.create | Yes | Yes | Yes | No |
| task.create | Yes | Yes | Yes | No |
| task.assign | Yes | Yes | Own | No |
| attempt.run | Yes | Yes | Own | No |
| prompt.enhance | Yes | Yes | Yes | No |

---

## ADR-008: Task Visibility Model

**Status:** Accepted

**Context:**
Tasks need access control beyond simple RBAC.

**Decision:**
Implement three visibility levels: `workspace`, `private`, `restricted`.

**Definitions:**
- `workspace`: Visible to all workspace members based on role
- `private`: Visible only to creator and admins
- `restricted`: Visible only to users in `task_acl` table

---

## ADR-009: 30-Day Session Duration

**Status:** Accepted

**Context:**
How long should authentication sessions last?

**Decision:**
30-day sessions with explicit logout required (per user requirement).

**Configuration:**
```yaml
application:
  session_duration: "30d"
```

**Rationale:**
- User explicitly requested 30 days
- Desktop-like experience for web app
- Cloudflare Access supports long sessions

---

## ADR-010: User-Provided API Keys

**Status:** Accepted

**Context:**
Who provides LLM API keys for prompt enhancement?

**Decision:**
Users bring their own API keys (stored in Workers Secrets via workspace settings).

**Rationale:**
- User explicitly requested this approach
- No bundled API access to manage
- Users control their own costs
- Keys stored encrypted in Cloudflare

**Future Option:**
Could add bundled access with usage limits later.

---

## ADR-011: No Offline Support

**Status:** Accepted

**Context:**
Should the app work offline?

**Decision:**
No offline support (per user requirement). App requires internet connection.

**Rationale:**
- User explicitly stated "no offline options"
- Simplifies architecture (no sync, conflict resolution)
- Cloudflare edge means low latency anyway
- Prompt enhancement always needs internet

---

## ADR-012: Per-User Rate Limiting

**Status:** Accepted

**Context:**
How to rate limit prompt enhancements?

**Decision:**
Per-user rate limits using Workers KV.

**Limits:**
| Action | Limit | Window |
|--------|-------|--------|
| prompt.enhance | 20 | 1 hour |

**Rationale:**
- User confirmed per-user limits
- Simple to implement with KV
- Fair usage per individual

---

## Assumptions Made

### Platform Assumptions
1. **Web-only** - No desktop/mobile apps (Cloudflare Pages)
2. **Always online** - Internet required for all features
3. **Global users** - Edge deployment for worldwide access

### User Assumptions
1. **SSO preferred** - Users have Google/GitHub accounts
2. **Technical users** - Developers familiar with AI coding agents
3. **Small teams** - Teams of 2-20 developers

### Security Assumptions
1. **Zero Trust** - All requests authenticated at edge
2. **Encrypted storage** - D1 and R2 encrypted at rest
3. **HTTPS only** - All traffic encrypted

---

## Future Considerations

These items were explicitly deferred:

1. **Offline mode** - Explicitly not in scope per user
2. **Desktop app** - Web-first approach chosen
3. **Bundled API access** - User keys for now
4. **Custom roles** - Four fixed roles sufficient
5. **Real-time collaboration** - Durable Objects if needed later
