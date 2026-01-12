# Frontend Specifications

> **Document Type:** Frontend Architecture & Screen Specifications
> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Stack:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, TanStack Form
> **Deployment:** Cloudflare Pages (global CDN)
> **Reference:** specs/backend-specs.md, specs/brief-normalized.md

---

## 1. Frontend Architecture Overview

### 1.1 Tech Stack

| Category | Technology | Notes |
|----------|------------|-------|
| Framework | React 18 | Function components with hooks |
| Language | TypeScript | Strict mode enabled |
| Build Tool | Vite | Fast HMR, optimized builds |
| **Deployment** | **Cloudflare Pages** | **Global CDN, preview deployments** |
| Routing | React Router v6 | Nested routes, layouts |
| State Management | TanStack Query + React Context | Server state via Query, UI state via Context |
| Forms | TanStack Form | Validation, field-level state |
| Styling | Tailwind CSS | Custom design tokens, dual theme system |
| UI Components | Custom + Radix UI primitives | Dialog, Select, Dropdown, etc. |
| Modals | @ebay/nice-modal-react | Promise-based modal management |
| i18n | react-i18next | Translation support |
| Icons | Lucide React | Consistent icon set |

### 1.2 Cloudflare Pages Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE PAGES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   GitHub Push → Build (Vite) → Deploy to Edge (300+ locations) │
│                                                                 │
│   Features:                                                     │
│   • Automatic preview deployments per branch                    │
│   • Global CDN with <50ms TTFB                                  │
│   • Automatic HTTPS                                             │
│   • CF Access integration for auth                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Environment URLs:**
| Environment | URL |
|-------------|-----|
| Production | `https://vibe-kanban.pages.dev` |
| Preview | `https://{branch}.vibe-kanban.pages.dev` |
| Local | `http://localhost:5173` |

**API Configuration:**
```typescript
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.vibe-kanban.workers.dev';
```

### 1.2 App Structure

```
frontend/src/
├── components/
│   ├── dialogs/           # Modal dialogs (NiceModal pattern)
│   │   ├── auth/          # Authentication dialogs (NEW)
│   │   ├── global/        # App-wide dialogs
│   │   ├── org/           # Organization/Team dialogs
│   │   ├── projects/      # Project dialogs
│   │   ├── prompts/       # Prompt enhancement dialogs (NEW)
│   │   ├── settings/      # Settings dialogs
│   │   ├── shared/        # Reusable dialog components
│   │   └── tasks/         # Task dialogs
│   ├── layout/            # Layout components
│   ├── ui/                # Base UI components (legacy design)
│   ├── ui-new/            # New design system components
│   └── ...
├── contexts/              # React Context providers
├── hooks/                 # Custom hooks
│   ├── auth/              # Authentication hooks
│   └── ...
├── pages/                 # Route page components
│   ├── settings/          # Settings pages
│   ├── ui-new/            # New design pages
│   └── ...
├── lib/                   # Utility libraries
├── styles/                # CSS styles
└── utils/                 # Helper functions
```

### 1.3 Design System

The application uses a dual design system:
- **Legacy Design** (`.legacy-design` scope): Existing components
- **New Design** (`.new-design` scope): Modern components with custom tokens

#### Typography

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 8px | Badges, captions |
| `text-sm` | 10px | Secondary text |
| `text-base` | 12px | Body text (default) |
| `text-lg` | 14px | Subheadings |
| `text-xl` | 16px | Headings |

#### Colors

| Token | Usage |
|-------|-------|
| `text-high` | Primary text, highest contrast |
| `text-normal` | Standard text |
| `text-low` | Muted/secondary text |
| `bg-primary` | Main background |
| `bg-secondary` | Cards, inputs, sidebars |
| `bg-panel` | Elevated surfaces |
| `brand` | Orange accent (hsl(25 82% 54%)) |
| `error` | Error states |
| `success` | Success states |

#### Spacing

| Token | Size |
|-------|------|
| `p-half` / `m-half` | 6px |
| `p-base` / `m-base` | 12px |
| `p-double` / `m-double` | 24px |

---

## 2. Authentication Screens

### 2.1 Screen: Login

**Route:** `/auth/login`

**Goal:** Allow existing users to authenticate and access their workspaces

**User Roles:** Unauthenticated users only (redirect if authenticated)

**Primary Entities:** User

**Layout Sections:**
- Header: App logo and tagline
- Main content: Login form centered
- Footer: Link to signup, password reset

---

#### Component: `<LoginScreen>`

**File Path:** `frontend/src/pages/auth/LoginScreen.tsx`

**Purpose:** Full-page login screen for user authentication

**Props:**
```typescript
interface LoginScreenProps {
  // No props - uses route params and context
}
```

**Local State:**
- `email`: string - User email input
- `password`: string - User password input
- `showPassword`: boolean - Password visibility toggle
- `isSubmitting`: boolean - Form submission state

**API Calls Used:**
1. `POST /api/auth/login` -> `{ user: User, session_token: string }`
   - When: On form submit
   - Success: Store session, redirect to `/projects` or return URL
   - Error: Show validation error message

**Validation Rules:**
- `email`: Required, valid email format
- `password`: Required, min 1 character

**Loading States:**
- Submitting: Button shows "Signing in..." with spinner

**Error States:**
- Invalid credentials: Inline alert below form
- Network error: Toast notification with retry

**Accessibility:**
- Form uses proper `<label>` associations
- Error messages linked via `aria-describedby`
- Password toggle button has clear `aria-label`
- Focus moves to first error field on validation failure

**Mobile Responsiveness:**
- Full-width form on mobile
- Centered card layout on desktop (max-w-md)

---

#### Component: `<LoginForm>`

**File Path:** `frontend/src/components/auth/LoginForm.tsx`

**Purpose:** Reusable login form with validation

**Props:**
```typescript
interface LoginFormProps {
  onSuccess: (user: User) => void;
  onError?: (error: Error) => void;
  redirectUrl?: string;
}
```

**Local State:**
- Managed by TanStack Form

**Data Schema:**
```typescript
interface LoginFormValues {
  email: string;
  password: string;
}
```

**Validation Rules:**
- `email`: Required, must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `password`: Required

---

### 2.2 Screen: Signup

**Route:** `/auth/signup`

**Goal:** Allow new users to create an account

**User Roles:** Unauthenticated users only

**Primary Entities:** User, WorkspaceTeam

**Layout Sections:**
- Header: App logo
- Main content: Signup form centered
- Footer: Link to login

---

#### Component: `<SignupScreen>`

**File Path:** `frontend/src/pages/auth/SignupScreen.tsx`

**Purpose:** Full-page signup screen for new user registration

**Props:**
```typescript
interface SignupScreenProps {
  invitationToken?: string; // From query param for invited users
}
```

**Local State:**
- `name`: string - User display name
- `email`: string - User email (pre-filled if invitation)
- `password`: string - User password
- `confirmPassword`: string - Password confirmation
- `acceptedTerms`: boolean - Terms acceptance

**API Calls Used:**
1. `POST /api/auth/signup` -> `{ user: User, session_token: string }`
   - When: On form submit
   - Success: Create default workspace, redirect to onboarding or projects
   - Error: Show validation errors

2. `GET /api/auth/invitation/:token` -> `{ email: string, workspace_name: string }` (if token present)
   - When: On mount with invitation token
   - Success: Pre-fill email, show workspace invitation info
   - Error: Show invalid/expired invitation message

**Validation Rules:**
- `name`: Required, 2-100 characters
- `email`: Required, valid email format, unique (server validation)
- `password`: Required, min 8 characters
- `confirmPassword`: Must match password
- `acceptedTerms`: Must be true

**Loading States:**
- Initial: Skeleton if validating invitation
- Submitting: Button shows "Creating account..."

**Error States:**
- Email already exists: Inline error with login link
- Invalid invitation: Alert with explanation
- Weak password: Inline validation hint

**Accessibility:**
- Password strength indicator with ARIA live region
- Clear error announcements

**Mobile Responsiveness:**
- Single column layout
- Full-width inputs

---

### 2.3 Screen: Password Reset (Future)

**Route:** `/auth/reset-password`

**Goal:** Allow users to reset forgotten passwords

**Status:** Planned for future release - placeholder UI only

---

## 3. Workspace Management

### 3.1 Component: Workspace Switcher

**File Path:** `frontend/src/components/workspace/WorkspaceSwitcher.tsx`

**Purpose:** Dropdown in sidebar header for switching between team workspaces

**Props:**
```typescript
interface WorkspaceSwitcherProps {
  currentWorkspaceId: string | null;
  onWorkspaceChange: (workspaceId: string) => void;
}
```

**Local State:**
- `isOpen`: boolean - Dropdown open state
- `searchQuery`: string - Filter workspaces

**Derived State:**
- `filteredWorkspaces`: Computed from workspaces list and searchQuery

**API Calls Used:**
1. `GET /api/workspace-teams` -> `WorkspaceTeam[]`
   - When: On mount, cached with TanStack Query
   - Success: Populate dropdown
   - Error: Show retry button

**Data Schema:**
```typescript
interface WorkspaceTeam {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  user_role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
}
```

**User Interactions:**
1. Click switcher -> Open dropdown
2. Type in search -> Filter workspaces
3. Click workspace -> Switch context, close dropdown
4. Click "Create Workspace" -> Open CreateWorkspaceDialog

**Loading States:**
- Loading workspaces: Skeleton items in dropdown

**Empty States:**
- No workspaces: Show "Create your first workspace" CTA

**Accessibility:**
- Keyboard navigation (Arrow keys, Enter, Escape)
- Current workspace announced as "selected"
- Combobox pattern with `aria-expanded`

**Mobile Responsiveness:**
- Full-width dropdown on mobile
- Touch-friendly tap targets (min 44px)

---

### 3.2 Dialog: Create Workspace

**File Path:** `frontend/src/components/dialogs/workspace/CreateWorkspaceDialog.tsx`

**Purpose:** Modal dialog for creating a new team workspace

**Props:**
```typescript
interface CreateWorkspaceDialogProps {
  // No props - standalone modal
}

interface CreateWorkspaceResult {
  action: 'created' | 'canceled';
  workspace?: WorkspaceTeam;
}
```

**Local State:**
- `name`: string - Workspace name
- `error`: string | null - Validation/API error

**API Calls Used:**
1. `POST /api/workspace-teams` -> `WorkspaceTeam`
   - When: On form submit
   - Request: `{ name: string }`
   - Success: Close dialog, switch to new workspace
   - Error: Show error message

**Validation Rules:**
- `name`: Required, 2-100 characters, alphanumeric with spaces/hyphens

**Loading States:**
- Submitting: Button shows "Creating..."

**Error States:**
- Name already exists: Inline error
- Creation failed: Alert with error message

**Accessibility:**
- Focus trap within dialog
- Initial focus on name input
- Escape key closes dialog

---

### 3.3 Screen: Workspace Settings

**Route:** `/settings/workspace/:workspaceId`

**Goal:** Configure workspace settings, manage team, view usage

**User Roles:** Owner, Admin (read-only for Member, Viewer)

**Primary Entities:** WorkspaceTeam, PromptEnhancementSettings

**Layout Sections:**
- Header: Workspace name with edit option
- Tabs: General | Members | Prompt Settings | Audit Log
- Main content: Active tab content

---

#### Component: `<WorkspaceSettingsPage>`

**File Path:** `frontend/src/pages/settings/WorkspaceSettingsPage.tsx`

**Purpose:** Container page for workspace settings with tab navigation

**Props:**
```typescript
interface WorkspaceSettingsPageProps {
  workspaceId: string; // From route params
}
```

**Local State:**
- `activeTab`: 'general' | 'members' | 'prompts' | 'audit'

**API Calls Used:**
1. `GET /api/workspace-teams/:id` -> `WorkspaceTeam`
   - When: On mount
   - Success: Display workspace details

2. `GET /api/workspace-teams/:id/permissions` -> `{ permissions: string[] }`
   - When: On mount
   - Success: Determine editable sections

**Loading States:**
- Initial: Full-page skeleton

**Error States:**
- Not found: 404 message with back link
- No permission: 403 message

**Accessibility:**
- Tab panel pattern with proper ARIA roles
- Keyboard navigation between tabs

---

#### Component: `<WorkspaceGeneralSettings>`

**File Path:** `frontend/src/components/settings/WorkspaceGeneralSettings.tsx`

**Purpose:** General workspace settings (name, danger zone)

**Props:**
```typescript
interface WorkspaceGeneralSettingsProps {
  workspace: WorkspaceTeam;
  canEdit: boolean;
}
```

**API Calls Used:**
1. `PATCH /api/workspace-teams/:id` -> `WorkspaceTeam`
   - When: On name save
   - Request: `{ name: string }`
   - Success: Update local state, show toast

2. `DELETE /api/workspace-teams/:id`
   - When: On delete confirmation
   - Success: Redirect to workspace list
   - Error: Show error toast

**User Interactions:**
1. Edit workspace name inline
2. Delete workspace (requires confirmation dialog)

**Validation Rules:**
- `name`: Same as create

---

## 4. Team Management

### 4.1 Component: Members List View

**File Path:** `frontend/src/components/team/MembersList.tsx`

**Purpose:** Display and manage workspace team members

**Props:**
```typescript
interface MembersListProps {
  workspaceId: string;
  currentUserRole: 'Owner' | 'Admin' | 'Member' | 'Viewer';
}
```

**Local State:**
- `searchQuery`: string - Filter members

**Derived State:**
- `filteredMembers`: Members matching search
- `canManageMembers`: boolean - Based on role

**API Calls Used:**
1. `GET /api/workspace-teams/:id/members` -> `WorkspaceMember[]`
   - When: On mount
   - Success: Display member list

2. `GET /api/workspace-teams/:id/invitations` -> `Invitation[]`
   - When: On mount
   - Success: Display pending invitations section

**Data Schema:**
```typescript
interface WorkspaceMember {
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar_url: string | null;
  role_id: string;
  role_name: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  status: 'active' | 'invited' | 'suspended';
  joined_at: string;
}
```

**User Interactions:**
1. Search members by name/email
2. Click member row -> Open member actions dropdown
3. Click "Invite Member" -> Open InviteMemberDialog
4. Click role dropdown -> Change member role
5. Click remove -> Open RemoveMemberConfirmDialog

**Loading States:**
- Initial: Table skeleton with 3 rows
- Background refresh: Subtle loading indicator

**Empty States:**
- No members (impossible - owner always exists)
- No search results: "No members match your search"

**Accessibility:**
- Table uses proper `<th>` headers
- Action buttons have descriptive labels
- Role changes announced via live region

**Mobile Responsiveness:**
- Card layout on mobile instead of table
- Swipe actions for member management

---

### 4.2 Dialog: Invite Member

**File Path:** `frontend/src/components/dialogs/team/InviteMemberDialog.tsx`

**Purpose:** Invite a new member to the workspace via email

**Props:**
```typescript
interface InviteMemberDialogProps {
  workspaceId: string;
}

interface InviteMemberResult {
  action: 'invited' | 'canceled';
  invitation?: Invitation;
}
```

**Local State:**
- `email`: string - Invitee email
- `role`: 'Admin' | 'Member' | 'Viewer' - Selected role
- `error`: string | null - Error message

**API Calls Used:**
1. `POST /api/workspace-teams/:id/invitations` -> `Invitation`
   - When: On form submit
   - Request: `{ email: string, role_id: string }`
   - Success: Close dialog, show success toast
   - Error: Show error (e.g., already member, already invited)

**Validation Rules:**
- `email`: Required, valid email format
- `role`: Required, one of allowed roles

**Loading States:**
- Submitting: Button shows "Sending invitation..."

**Error States:**
- Already a member: Show message with member info
- Already invited: Show message with resend option
- Invalid email: Inline validation error

**Accessibility:**
- Focus on email input on open
- Error messages linked to inputs

---

### 4.3 Component: Role Change Dropdown

**File Path:** `frontend/src/components/team/RoleChangeDropdown.tsx`

**Purpose:** Inline dropdown to change a member's role

**Props:**
```typescript
interface RoleChangeDropdownProps {
  member: WorkspaceMember;
  workspaceId: string;
  currentUserRole: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  onRoleChanged: (newRole: string) => void;
}
```

**Local State:**
- `isOpen`: boolean - Dropdown state
- `isUpdating`: boolean - API call in progress

**Derived State:**
- `availableRoles`: Roles the current user can assign
- `isDisabled`: Cannot change own role or owner's role

**API Calls Used:**
1. `PATCH /api/workspace-teams/:workspaceId/members/:userId` -> `WorkspaceMember`
   - When: On role selection
   - Request: `{ role_id: string }`
   - Success: Update UI, show toast
   - Error: Revert UI, show error toast

**Business Rules:**
- Owner role cannot be changed
- Only Owner can promote to Admin
- Admin can only assign Member/Viewer
- Cannot change own role

**Accessibility:**
- Dropdown uses `role="listbox"`
- Current role marked as selected
- Disabled options have `aria-disabled`

---

### 4.4 Dialog: Remove Member Confirmation

**File Path:** `frontend/src/components/dialogs/team/RemoveMemberConfirmDialog.tsx`

**Purpose:** Confirm removal of a team member

**Props:**
```typescript
interface RemoveMemberConfirmDialogProps {
  workspaceId: string;
  member: WorkspaceMember;
}

interface RemoveMemberResult {
  action: 'removed' | 'canceled';
}
```

**API Calls Used:**
1. `DELETE /api/workspace-teams/:workspaceId/members/:userId`
   - When: On confirm
   - Success: Close dialog, refresh member list
   - Error: Show error message

**Content:**
- Warning icon
- Member name and email
- Explanation of what happens (loses access, tasks reassigned)
- Cancel and Remove buttons

**Accessibility:**
- Destructive action uses `variant="destructive"`
- Focus on Cancel button by default

---

## 5. Task Assignment UI

### 5.1 Component: Assignee Selector

**File Path:** `frontend/src/components/tasks/AssigneeSelector.tsx`

**Purpose:** Dropdown to assign a task to a team member

**Props:**
```typescript
interface AssigneeSelectorProps {
  taskId: string;
  currentAssigneeId: string | null;
  workspaceTeamId: string;
  onAssigneeChange: (userId: string | null) => void;
  disabled?: boolean;
}
```

**Local State:**
- `isOpen`: boolean - Dropdown state
- `searchQuery`: string - Filter members

**Derived State:**
- `filteredMembers`: Members matching search
- `currentAssignee`: Current assignee details

**API Calls Used:**
1. `GET /api/workspace-teams/:id/members` -> `WorkspaceMember[]`
   - When: On dropdown open (cached)
   - Success: Populate dropdown options

2. `PATCH /api/tasks/:id` -> `Task`
   - When: On selection change
   - Request: `{ assigned_to_user_id: string | null }`
   - Success: Update UI, show toast
   - Error: Revert, show error

**User Interactions:**
1. Click selector -> Open dropdown
2. Search by name -> Filter members
3. Select member -> Assign task
4. Select "Unassigned" -> Remove assignment

**Display States:**
- Assigned: Avatar + name
- Unassigned: Ghost icon + "Unassigned"

**Loading States:**
- Updating: Spinner overlay

**Accessibility:**
- Combobox pattern
- Selected option announced

---

### 5.2 Component: Assigned To Me Filter

**File Path:** `frontend/src/components/tasks/TaskFilters.tsx` (extension)

**Purpose:** Filter task list to show only tasks assigned to current user

**Props:**
```typescript
interface TaskFiltersProps {
  filters: TaskFilterState;
  onFiltersChange: (filters: TaskFilterState) => void;
}

interface TaskFilterState {
  assignedToMe: boolean;
  status: TaskStatus[] | null;
  visibility: TaskVisibility[] | null;
  search: string;
}
```

**User Interactions:**
1. Toggle "Assigned to me" filter
2. URL param sync: `?assignedToMe=true`

**API Impact:**
- `GET /api/projects/:id/tasks?assigned_to_me=true`

---

### 5.3 Component: Task Visibility Toggle

**File Path:** `frontend/src/components/tasks/VisibilityToggle.tsx`

**Purpose:** Control task visibility (workspace/private/restricted)

**Props:**
```typescript
interface VisibilityToggleProps {
  taskId: string;
  visibility: 'workspace' | 'private' | 'restricted';
  onVisibilityChange: (visibility: TaskVisibility) => void;
  disabled?: boolean;
}
```

**API Calls Used:**
1. `PATCH /api/tasks/:id` -> `Task`
   - When: On visibility change
   - Request: `{ visibility: string }`
   - Success: Update UI
   - Error: Revert, show error

**Visibility Options:**
- `workspace`: Everyone in workspace can see (Globe icon)
- `private`: Only creator can see (Lock icon)
- `restricted`: Only specific users can see (Users icon)

**User Interactions:**
1. Click visibility icon -> Open dropdown
2. Select option -> Change visibility
3. If "restricted" selected -> Open AccessControlDialog

---

### 5.4 Component: Access Control Badges

**File Path:** `frontend/src/components/tasks/AccessBadges.tsx`

**Purpose:** Display visibility status badges on task cards

**Props:**
```typescript
interface AccessBadgesProps {
  visibility: 'workspace' | 'private' | 'restricted';
  assigneeId: string | null;
  currentUserId: string;
}
```

**Display:**
- Private task: Lock badge
- Restricted task: Shield badge with count
- Assigned to current user: "Assigned to you" badge

**Accessibility:**
- Badges use `aria-label` for screen readers
- Tooltips on hover for full details

---

## 6. Prompt Enhancement UI

### 6.1 Component: Enhance Prompt Button

**File Path:** `frontend/src/components/prompts/EnhancePromptButton.tsx`

**Purpose:** Trigger AI-powered prompt enhancement for task description

**Props:**
```typescript
interface EnhancePromptButtonProps {
  prompt: string;
  taskId?: string; // Optional, for enhancement history
  onEnhanced: (result: EnhancementResult) => void;
  disabled?: boolean;
}

interface EnhancementResult {
  original_prompt: string;
  enhanced_prompt: string;
  techniques_applied: string[];
  original_score: number;
  enhanced_score: number;
}
```

**Local State:**
- `isEnhancing`: boolean - API call in progress

**API Calls Used:**
1. `POST /api/prompts/enhance` -> `EnhancementResult`
   - When: On button click
   - Request: `{ prompt: string, task_id?: string }`
   - Success: Open PromptComparisonDialog
   - Error: Show error toast

**Loading States:**
- Enhancing: Button shows spinner + "Enhancing..."

**Error States:**
- Enhancement failed: Toast with retry option
- Rate limited: Toast with wait time

**Accessibility:**
- Button describes action clearly
- Loading state announced

---

### 6.2 Dialog: Prompt Comparison

**File Path:** `frontend/src/components/dialogs/prompts/PromptComparisonDialog.tsx`

**Purpose:** Side-by-side comparison of original vs enhanced prompt

**Props:**
```typescript
interface PromptComparisonDialogProps {
  original: string;
  enhanced: string;
  originalScore: number;
  enhancedScore: number;
  techniques: string[];
  taskId?: string;
  enhancementId: string;
}

interface PromptComparisonResult {
  action: 'accept' | 'edit' | 'keep_original';
  finalPrompt: string;
}
```

**Local State:**
- `editedPrompt`: string - User's edited version
- `isEditing`: boolean - Edit mode active
- `selectedVersion`: 'original' | 'enhanced' | 'edited'

**Layout Sections:**
- Header: "Enhanced Prompt" title with scores
- Main: Two-column layout (original left, enhanced right)
- Techniques: List of applied techniques
- Actions: Accept / Edit / Keep Original buttons

**API Calls Used:**
1. `POST /api/prompts/enhancements/:id/feedback` -> `void`
   - When: On action selection
   - Request: `{ accepted: boolean, edited: boolean, final_prompt: string }`
   - Success: Close dialog with result

**User Interactions:**
1. View side-by-side comparison
2. Click "Accept" -> Use enhanced prompt
3. Click "Edit" -> Enter edit mode, modify enhanced prompt
4. Click "Keep Original" -> Use original prompt
5. Review quality scores

**Accessibility:**
- Clear heading structure
- Diff highlighting uses color + underline/strikethrough
- Keyboard navigation between panels

**Mobile Responsiveness:**
- Stacked layout on mobile (tabs instead of columns)
- Swipe between original/enhanced

---

### 6.3 Component: Quality Score Indicators

**File Path:** `frontend/src/components/prompts/QualityScoreIndicator.tsx`

**Purpose:** Visual indicator of prompt quality score (0-100)

**Props:**
```typescript
interface QualityScoreIndicatorProps {
  score: number;
  label?: string;
  showDelta?: boolean;
  deltaFrom?: number;
}
```

**Display:**
- Score 0-30: Red (Poor)
- Score 31-60: Yellow (Fair)
- Score 61-80: Green (Good)
- Score 81-100: Blue (Excellent)

**Visual Elements:**
- Circular progress indicator
- Score number in center
- Label below
- Delta badge if comparison

**Accessibility:**
- `aria-label` describes quality level
- Color coding backed by text labels

---

### 6.4 Component: Enhancement History Panel

**File Path:** `frontend/src/components/prompts/EnhancementHistoryPanel.tsx`

**Purpose:** Show history of prompt enhancements for a task

**Props:**
```typescript
interface EnhancementHistoryPanelProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Local State:**
- `selectedEnhancementId`: string | null - Expanded item

**API Calls Used:**
1. `GET /api/tasks/:id/prompt-enhancements` -> `PromptEnhancement[]`
   - When: Panel opens
   - Success: Display timeline

**Data Schema:**
```typescript
interface PromptEnhancement {
  id: string;
  original_prompt: string;
  enhanced_prompt: string;
  enhancement_model: string;
  techniques_applied: string[];
  original_score: number | null;
  enhanced_score: number | null;
  user_accepted: boolean | null;
  user_edited: boolean | null;
  final_prompt: string | null;
  created_at: string;
}
```

**User Interactions:**
1. Click enhancement entry -> Expand to show details
2. Click "Use this prompt" -> Apply to task

**Empty States:**
- No enhancements: "No enhancement history for this task"

**Accessibility:**
- Expandable items use `aria-expanded`
- Timeline is a list with proper semantics

---

## 7. Prompt Templates

### 7.1 Component: Template Picker

**File Path:** `frontend/src/components/prompts/TemplatePicker.tsx`

**Purpose:** Select a prompt template when creating/editing tasks

**Props:**
```typescript
interface TemplatePickerProps {
  workspaceTeamId: string;
  onTemplateSelect: (template: PromptTemplate) => void;
  category?: string;
}
```

**Local State:**
- `isOpen`: boolean - Picker open state
- `searchQuery`: string - Filter templates
- `selectedCategory`: string | null - Category filter

**API Calls Used:**
1. `GET /api/prompt-templates?workspace_team_id=:id` -> `PromptTemplate[]`
   - When: On picker open (cached)
   - Success: Display templates

**Data Schema:**
```typescript
interface PromptTemplate {
  id: string;
  name: string;
  description: string | null;
  template_text: string;
  category: 'bug-fix' | 'feature' | 'refactor' | 'docs' | 'test' | 'other';
  is_global: boolean;
  usage_count: number;
  created_at: string;
}
```

**User Interactions:**
1. Click template button -> Open picker
2. Filter by category tabs
3. Search by name
4. Click template -> Apply to description field
5. Template text with `{{placeholders}}` prompts user input

**Loading States:**
- Loading templates: Grid skeleton

**Empty States:**
- No templates: "No templates available. Create one in settings."
- No matches: "No templates match your search"

**Accessibility:**
- Grid navigation with arrow keys
- Templates announced with name and category

---

### 7.2 Screen: Template Management

**Route:** `/settings/workspace/:id/templates`

**Goal:** Create, edit, and delete prompt templates

**User Roles:** Owner, Admin (with `prompt.template.create` permission)

**Primary Entities:** PromptTemplate

---

#### Component: `<TemplateManagementPage>`

**File Path:** `frontend/src/pages/settings/TemplateManagementPage.tsx`

**Purpose:** Full template CRUD interface

**Props:**
```typescript
interface TemplateManagementPageProps {
  workspaceId: string; // From route params
}
```

**Local State:**
- `selectedTemplateId`: string | null - Template being edited
- `isCreating`: boolean - Create mode active

**API Calls Used:**
1. `GET /api/prompt-templates?workspace_team_id=:id` -> `PromptTemplate[]`
2. `POST /api/prompt-templates` -> `PromptTemplate`
3. `PATCH /api/prompt-templates/:id` -> `PromptTemplate`
4. `DELETE /api/prompt-templates/:id` -> `void`

**Layout:**
- Left: Template list with categories
- Right: Template editor

**User Interactions:**
1. Click "New Template" -> Open editor in create mode
2. Click template -> Load in editor
3. Edit and save
4. Delete with confirmation

---

### 7.3 Component: Template Editor

**File Path:** `frontend/src/components/prompts/TemplateEditor.tsx`

**Purpose:** Edit prompt template with placeholder syntax highlighting

**Props:**
```typescript
interface TemplateEditorProps {
  template?: PromptTemplate;
  onSave: (template: CreatePromptTemplate | UpdatePromptTemplate) => void;
  onCancel: () => void;
}
```

**Local State:**
- `name`: string
- `description`: string
- `templateText`: string
- `category`: string

**Validation Rules:**
- `name`: Required, 2-100 characters
- `templateText`: Required, must contain at least one `{{placeholder}}`
- `category`: Required

**Placeholder Syntax:**
```
{{variable_name}} - Required variable
{{?optional_name}} - Optional variable
{{variable_name:default_value}} - Variable with default
```

**Features:**
- Syntax highlighting for placeholders
- Preview mode with sample data
- Placeholder list extraction

**Accessibility:**
- Code editor uses proper ARIA roles
- Placeholders highlighted with distinct color + background

---

## 8. Prompt Enhancement Settings

### 8.1 Component: Prompt Settings Panel

**File Path:** `frontend/src/components/settings/PromptSettingsPanel.tsx`

**Purpose:** Configure prompt enhancement preferences for workspace

**Props:**
```typescript
interface PromptSettingsPanelProps {
  workspaceId: string;
  canEdit: boolean;
}
```

**Local State:**
- Managed by TanStack Form

**API Calls Used:**
1. `GET /api/workspace-teams/:id/prompt-settings` -> `PromptEnhancementSettings`
   - When: On mount
   - Success: Populate form

2. `PATCH /api/workspace-teams/:id/prompt-settings` -> `PromptEnhancementSettings`
   - When: On form submit
   - Success: Show success toast
   - Error: Show error, revert form

**Data Schema:**
```typescript
interface PromptEnhancementSettings {
  auto_enhance_enabled: boolean;
  preferred_model: 'gpt-4' | 'claude-3' | 'local';
  enhancement_style: 'minimal' | 'balanced' | 'comprehensive';
  include_codebase_context: boolean;
  include_git_history: boolean;
  custom_instructions: string | null;
}
```

---

### 8.2 Component: Model Selection Dropdown

**File Path:** `frontend/src/components/settings/ModelSelector.tsx`

**Purpose:** Select LLM provider for prompt enhancement

**Props:**
```typescript
interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}
```

**Options:**
- `gpt-4`: OpenAI GPT-4 Turbo
- `claude-3`: Anthropic Claude 3
- `local`: Local LLM (Ollama)

**API Calls Used:**
1. `GET /api/llm-providers/status` -> `{ provider: string, available: boolean }[]`
   - When: On mount
   - Success: Show availability badges

**Display:**
- Provider name
- Availability indicator (green/red dot)
- "Recommended" badge for GPT-4

---

### 8.3 Component: Enhancement Style Radio

**File Path:** `frontend/src/components/settings/EnhancementStyleRadio.tsx`

**Purpose:** Choose enhancement aggressiveness level

**Props:**
```typescript
interface EnhancementStyleRadioProps {
  value: 'minimal' | 'balanced' | 'comprehensive';
  onChange: (style: string) => void;
  disabled?: boolean;
}
```

**Options:**
- `minimal`: Light touch - fix grammar, clarify intent
- `balanced`: Moderate - add structure, requirements, context
- `comprehensive`: Heavy - full rewrite with best practices

**Display:**
- Radio button group
- Description for each option
- Example preview

---

### 8.4 Component: Context Inclusion Toggles

**File Path:** `frontend/src/components/settings/ContextToggles.tsx`

**Purpose:** Configure what context to include in enhancement

**Props:**
```typescript
interface ContextTogglesProps {
  includeCodebase: boolean;
  includeGitHistory: boolean;
  onChange: (values: { includeCodebase: boolean; includeGitHistory: boolean }) => void;
  disabled?: boolean;
}
```

**Options:**
- Include codebase context: Add relevant code patterns
- Include git history: Add recent commit context

**Display:**
- Toggle switches with descriptions
- Warning for git history (may slow enhancement)

---

## 9. Audit Log Viewer

### 9.1 Screen: Audit Log

**Route:** `/settings/workspace/:id/audit`

**Goal:** View timeline of all workspace activity

**User Roles:** Owner, Admin

**Primary Entities:** AuditLog

---

#### Component: `<AuditLogPage>`

**File Path:** `frontend/src/pages/settings/AuditLogPage.tsx`

**Purpose:** Full audit log interface with filtering

**Props:**
```typescript
interface AuditLogPageProps {
  workspaceId: string; // From route params
}
```

**Local State:**
- `filters`: AuditLogFilters - Active filters
- `expandedEntryId`: string | null - Expanded entry

**API Calls Used:**
1. `GET /api/workspace-teams/:id/audit-log` -> `{ entries: AuditLog[], total: number, has_more: boolean }`
   - When: On mount, on filter change, on pagination
   - Query params: `entity_type`, `action`, `actor_user_id`, `date_start`, `date_end`, `limit`, `offset`
   - Success: Display entries

**Data Schema:**
```typescript
interface AuditLog {
  id: string;
  workspace_team_id: string | null;
  actor_user_id: string;
  actor_user_name: string;
  actor_user_avatar: string | null;
  entity_type: 'task' | 'workspace' | 'project' | 'attempt' | 'member' | 'prompt';
  entity_id: string;
  entity_name: string | null;
  action: string;
  payload_json: object | null;
  created_at: string;
}
```

---

### 9.2 Component: Audit Timeline View

**File Path:** `frontend/src/components/audit/AuditTimeline.tsx`

**Purpose:** Display audit entries in chronological timeline

**Props:**
```typescript
interface AuditTimelineProps {
  entries: AuditLog[];
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}
```

**Display:**
- Vertical timeline with date separators
- Entry cards showing: actor avatar, action description, timestamp
- Expandable details panel

**User Interactions:**
1. Scroll to load more (infinite scroll)
2. Click entry -> Expand details
3. Click entity link -> Navigate to entity

**Loading States:**
- Initial: Timeline skeleton
- Loading more: Spinner at bottom

**Empty States:**
- No entries: "No activity recorded yet"
- No matching filters: "No entries match your filters"

**Accessibility:**
- Timeline uses `<ol>` with date landmarks
- Entries are `<li>` elements
- Expandable content uses `aria-expanded`

---

### 9.3 Component: Audit Log Filters

**File Path:** `frontend/src/components/audit/AuditLogFilters.tsx`

**Purpose:** Filter audit log entries

**Props:**
```typescript
interface AuditLogFiltersProps {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  members: WorkspaceMember[];
}

interface AuditLogFilters {
  entityType: string | null;
  action: string | null;
  actorUserId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
}
```

**Filter Options:**
- Entity Type: task, project, workspace, attempt, member, prompt
- Action: created, updated, deleted, assigned, etc.
- User: Dropdown of workspace members
- Date Range: Start and end date pickers

**User Interactions:**
1. Select filter value -> Update entries
2. Click "Clear Filters" -> Reset all

**Accessibility:**
- Filter group uses fieldset/legend
- Active filters shown as removable chips

---

### 9.4 Component: Audit Entry Detail Panel

**File Path:** `frontend/src/components/audit/AuditEntryDetail.tsx`

**Purpose:** Expandable panel showing full audit entry details

**Props:**
```typescript
interface AuditEntryDetailProps {
  entry: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
}
```

**Display:**
- Summary line (always visible): "[User] [action] [entity] at [time]"
- Expanded content:
  - Full payload JSON (formatted)
  - Before/after comparison for updates
  - Links to related entities

**Accessibility:**
- Uses `<details>` and `<summary>` pattern
- JSON displayed in `<pre>` with syntax highlighting

---

## 10. Cross-Cutting Concerns

### 10.1 Authentication & Authorization

**Session Storage:**
- Session token stored in HTTP-only cookie
- User context loaded on app mount via `useAuth()` hook

**Route Protection:**
```typescript
// Protected route wrapper
<ProtectedRoute requiredPermission="task.create">
  <TaskFormDialog />
</ProtectedRoute>
```

**Permission Checking:**
```typescript
// Hook for permission checks
const { hasPermission, isLoading } = usePermission('task.assign');
```

**Auth Failure Handling:**
- 401 response -> Redirect to `/auth/login`
- 403 response -> Show "Access Denied" message
- Session expiry -> Show re-login modal

### 10.2 Error Handling

**Global Error Boundary:**
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

**API Error Handling:**
- All API errors follow `{ code: string, message: string, details?: object }` format
- Errors displayed via toast notifications
- Retry logic for transient failures (5xx errors)

**Error Display:**
- Validation errors: Inline field errors
- API errors: Toast notifications
- Critical errors: Full-page error state

### 10.3 Performance

**Code Splitting:**
- Route-based splitting via React.lazy
- Dialog components loaded on demand
- Heavy components (WYSIWYG, Diff viewer) lazy loaded

**Data Fetching:**
- TanStack Query for caching and deduplication
- Stale-while-revalidate strategy
- Prefetching on hover for common navigation

**Optimistic Updates:**
- Task status changes
- Role assignments
- Visibility toggles

### 10.4 Offline Behavior

**Current Scope (v1):**
- No offline support
- Network errors show retry options
- LLM features require network connection

**Future Consideration:**
- Cache recent data in IndexedDB
- Queue mutations for later sync

### 10.5 Testing Strategy

**Unit Tests:**
- Utility functions
- Custom hooks
- Form validation logic

**Integration Tests:**
- Component interactions
- API mocking with MSW
- User flow testing

**E2E Tests (Playwright):**
- Critical user flows: Login, Create task, Assign task
- Prompt enhancement workflow
- Team management flows

---

## 11. Implementation Priority

### Phase 1: Authentication
1. LoginScreen
2. SignupScreen
3. Auth context and hooks
4. Protected routes

### Phase 2: Workspace Management
1. WorkspaceSwitcher
2. CreateWorkspaceDialog
3. WorkspaceSettingsPage

### Phase 3: Team Management
1. MembersList
2. InviteMemberDialog
3. RoleChangeDropdown
4. RemoveMemberConfirmDialog

### Phase 4: Task Assignment
1. AssigneeSelector
2. Task filter extensions
3. VisibilityToggle
4. AccessBadges

### Phase 5: Prompt Enhancement
1. EnhancePromptButton
2. PromptComparisonDialog
3. QualityScoreIndicator
4. EnhancementHistoryPanel

### Phase 6: Templates & Settings
1. TemplatePicker
2. TemplateManagementPage
3. TemplateEditor
4. PromptSettingsPanel

### Phase 7: Audit Log
1. AuditLogPage
2. AuditTimeline
3. AuditLogFilters
4. AuditEntryDetail

---

## 12. API Dependencies

All components reference endpoints that must exist in the backend API. See `specs/api-docs.md` for full endpoint specifications.

### Authentication Endpoints
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`

### Workspace Team Endpoints
- `GET /api/workspace-teams`
- `POST /api/workspace-teams`
- `GET /api/workspace-teams/:id`
- `PATCH /api/workspace-teams/:id`
- `DELETE /api/workspace-teams/:id`
- `GET /api/workspace-teams/:id/members`
- `POST /api/workspace-teams/:id/invitations`
- `GET /api/workspace-teams/:id/prompt-settings`
- `PATCH /api/workspace-teams/:id/prompt-settings`
- `GET /api/workspace-teams/:id/audit-log`

### Task Endpoints (Extended)
- `PATCH /api/tasks/:id` (now includes `assigned_to_user_id`, `visibility`)
- `GET /api/tasks/:id/prompt-enhancements`

### Prompt Endpoints (New)
- `POST /api/prompts/enhance`
- `POST /api/prompts/enhancements/:id/feedback`
- `GET /api/prompt-templates`
- `POST /api/prompt-templates`
- `PATCH /api/prompt-templates/:id`
- `DELETE /api/prompt-templates/:id`

---

## 13. Acceptance Checklist

- [ ] All screens from brief are documented
- [ ] Every screen lists all API calls it makes
- [ ] All entities match specs/backend-specs.md
- [ ] Loading/error/empty states specified for each component
- [ ] Validation rules defined for all forms
- [ ] Accessibility notes included for interactive elements
- [ ] Edge cases and non-happy paths documented
- [ ] Cross-cutting concerns addressed
- [ ] Mobile responsiveness notes included
- [ ] Implementation phases prioritized
