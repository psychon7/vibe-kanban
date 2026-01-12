# Open Questions

> **Document Type:** Uncertainties and Clarifications Needed
> **Created:** 2026-01-13
> **Updated:** 2026-01-13

This document tracks questions and uncertainties that need resolution before or during implementation.

---

## Questions Resolved

Based on user feedback, the following questions have been resolved:

| Question | Resolution | Date |
|----------|------------|------|
| Tech Stack | Full Cloudflare (Pages, Workers, D1, R2, Access, AI Gateway) | 2026-01-13 |
| First User Experience | Create account immediately, become Owner | 2026-01-13 |
| Data Migration | Ask for confirmation, detect existing DB | 2026-01-13 |
| Notification System | Both in-app + system, configurable per type | 2026-01-13 |
| Offline Behavior | No offline support | 2026-01-13 |
| Session Duration | 30 days, explicit logout required | 2026-01-13 |
| LLM API Keys | User brings their own keys | 2026-01-13 |
| Workspace Deletion | Soft delete with recovery option | 2026-01-13 |
| Notification Preferences | Assignees can configure their preferences | 2026-01-13 |
| Rate Limits | Per user (20/hour for enhancements) | 2026-01-13 |
| Audit Log Retention | Archive to R2 storage | 2026-01-13 |
| Template Sharing | Export/import mechanism | 2026-01-13 |
| Avatar Storage | External URL reference | 2026-01-13 |
| Keyboard Shortcuts | Not prioritized | 2026-01-13 |
| Dark Mode | Yes, follow system preference | 2026-01-13 |
| Localization | English only for v1 | 2026-01-13 |

---

## Remaining Open Questions

### Q1: Cloudflare Access Configuration
**Priority:** High
**Related Specs:** backend-specs.md

**Question:** What identity providers should be enabled for Cloudflare Access?
- Google OAuth?
- GitHub OAuth?
- Email OTP?
- Enterprise SAML/OIDC?

**Current Assumption:** Google + GitHub + Email OTP

---

### Q2: Domain Setup
**Priority:** High
**Related Specs:** All

**Question:** What custom domain will be used?
- `vibe-kanban.yourdomain.com`?
- Separate domains for Pages and Workers?
- SSL certificate configuration?

**Impact:** Affects CORS, Access configuration, deployment URLs.

---

### Q3: Existing Data Handling
**Priority:** High
**Related Specs:** backend-specs.md

**Question:** When migrating existing Vibe Kanban data:
- How to detect existing local SQLite database?
- Migration to D1 - manual or automated?
- What happens to git worktrees (Workspace entities)?

**Current Assumption:** Provide migration script, ask user confirmation.

---

### Q4: AI Gateway Providers
**Priority:** Medium
**Related Specs:** ai-services.md

**Question:** Which LLM providers to enable in AI Gateway?
- OpenAI (which models)?
- Anthropic (which models)?
- Workers AI (Llama as fallback)?

**Current Assumption:** OpenAI GPT-4-turbo primary, Anthropic Claude-3 backup.

---

### Q5: R2 Bucket Configuration
**Priority:** Medium
**Related Specs:** backend-specs.md

**Question:** R2 storage configuration:
- Public bucket for avatars?
- Private bucket for attachments?
- CORS configuration?
- Custom domain for R2?

**Current Assumption:** Single bucket, public access for avatars path only.

---

### Q6: Workers Limits
**Priority:** Medium
**Related Specs:** backend-specs.md

**Question:** How to handle Workers limits:
- 10ms CPU time (free) / 30ms (paid) per request
- 128MB memory
- 1MB request/response body

**Impact:** May need to optimize heavy operations.

**Current Assumption:** Paid plan for 30ms CPU, split large operations.

---

### Q7: Notification Implementation
**Priority:** Medium
**Related Specs:** frontend-specs.md

**Question:** Implementation details for notifications:
- In-app: Toast vs notification panel?
- System: Web Push API or Cloudflare Workers Push?
- Storage: KV for unread count?

**Current Assumption:** Toast + panel, Web Push API.

---

### Q8: Real-time Updates
**Priority:** Low
**Related Specs:** api-docs.md

**Question:** How to implement real-time updates?
- Durable Objects for WebSocket?
- Server-Sent Events (SSE)?
- Polling as fallback?

**Impact:** Task assignment notifications, audit log streaming.

**Current Assumption:** Polling initially, Durable Objects if needed.

---

## Implementation Uncertainties

### IU1: D1 Write Latency
**Related Specs:** backend-specs.md

**Uncertainty:** D1 has a single write location. How does this affect:
- User experience for write operations?
- Concurrent edits to same task?

**Risk Level:** Low - write operations are infrequent.

---

### IU2: AI Gateway Caching
**Related Specs:** ai-services.md

**Uncertainty:** How effective is AI Gateway caching for prompt enhancement?
- Same prompt may have different context
- Cache key strategy?

**Risk Level:** Low - can disable caching if needed.

---

### IU3: Access Policy Complexity
**Related Specs:** backend-specs.md

**Uncertainty:** Cloudflare Access policies for:
- Workspace-level access control?
- Or application-level only (all authenticated users)?

**Risk Level:** Medium - may need RBAC at app layer only.

**Current Assumption:** App-level Access (all authenticated), workspace RBAC in app.

---

## UX Decisions Pending

### UX1: First-Time User Flow
When user first authenticates via CF Access:
- Auto-create personal workspace?
- Prompt to create or join workspace?
- Onboarding wizard?

### UX2: Workspace Switcher Design
- Dropdown in header?
- Sidebar section?
- Full-page workspace selection?

### UX3: Prompt Enhancement Feedback
How to collect user feedback on enhancements:
- Accept/Reject buttons?
- Star rating?
- Edit tracking (implicit feedback)?

---

## How to Add Questions

When adding new questions:
1. Assign a priority level
2. Reference related specs
3. Document current assumption (if any)
4. Describe impact of the decision
5. List options considered

Move resolved questions to the "Questions Resolved" section with the resolution and date.
