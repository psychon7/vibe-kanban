/**
 * Determine API base URL based on environment
 * - Development: Use VITE_API_URL or localhost:8787
 * - Production (vibe-kanban.pages.dev): Use production Workers API
 * - Staging (staging.vibe-kanban.pages.dev): Use staging Workers API
 */
function getApiBaseUrl(): string {
  // Check for explicit env var first
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api/v1`;
  }

  // Auto-detect based on current hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production: vibe-kanban.pages.dev
    if (hostname === 'vibe-kanban.pages.dev') {
      return 'https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev/api/v1';
    }
    
    // Staging: staging.vibe-kanban.pages.dev or any preview deployment
    if (hostname.includes('vibe-kanban') && hostname.includes('pages.dev')) {
      return 'https://vibe-kanban-api-staging.sheshnarayan-iyer.workers.dev/api/v1';
    }
  }

  // Default: relative path (works with proxy in development)
  return '/api/v1';
}

const API_BASE = getApiBaseUrl();

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  owner_id?: string;
  member_count?: number;
  role?: string;
  user_role?: string;
  created_by_name?: string;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  role_id: string;
  role_name: string;
  user_email: string;
  user_name: string;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
  task_count?: number;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  visibility: 'workspace' | 'private' | 'restricted';
  assigned_to?: string;
  assignee_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
}

export interface PromptEnhancementSettings {
  id: string;
  workspace_id: string;
  auto_enhance_enabled: boolean;
  preferred_model: string;
  enhancement_style: 'minimal' | 'balanced' | 'comprehensive';
  include_codebase_context: boolean;
  include_git_history: boolean;
  custom_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  workspace_id: string;
  actor_id: string;
  actor_email?: string;
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  payload?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogFilters {
  entity_type?: string;
  action?: string;
  actor_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

class ApiClient {
  private token: string | null = null;
  private workspaceId: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  setWorkspaceId(workspaceId: string | null) {
    this.workspaceId = workspaceId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    if (this.workspaceId) {
      (headers as Record<string, string>)['X-Workspace-Id'] = this.workspaceId;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data as T;
  }

  // Auth endpoints
  async signup(email: string, password: string, name: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  async refreshToken(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/refresh', { method: 'POST' });
  }

  // Workspace endpoints
  async listWorkspaces(): Promise<{ workspaces: Workspace[] }> {
    return this.request<{ workspaces: Workspace[] }>('/workspaces');
  }

  async getWorkspace(id: string): Promise<{ workspace: Workspace }> {
    return this.request<{ workspace: Workspace }>(`/workspaces/${id}`);
  }

  async createWorkspace(data: { name: string; description?: string }): Promise<{ workspace: Workspace }> {
    return this.request<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkspace(id: string, data: { name?: string; description?: string }): Promise<{ workspace: Workspace }> {
    return this.request<{ workspace: Workspace }>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await this.request(`/workspaces/${id}`, { method: 'DELETE' });
  }

  // Workspace members
  async listWorkspaceMembers(workspaceId: string): Promise<{ members: WorkspaceMember[] }> {
    const response = await this.request<{
      members: Array<{
        id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
        status: string;
        joined_at: string;
      }>;
    }>(`/workspaces/${workspaceId}/members`);

    // Normalize backend shape into UI-friendly `WorkspaceMember`
    const members = (response.members || []).map((m) => {
      const roleName = (m.role || 'Member').toLowerCase();
      return {
        id: `${workspaceId}:${m.id}`,
        user_id: m.id,
        workspace_id: workspaceId,
        role_id: `role-${roleName}`,
        role_name: roleName,
        user_email: m.email,
        user_name: m.name,
        created_at: m.joined_at,
      } satisfies WorkspaceMember;
    });

    return { members };
  }

  async inviteWorkspaceMember(
    workspaceId: string,
    email: string,
    role: 'Admin' | 'Member' | 'Viewer'
  ): Promise<{ invitation?: unknown; member?: unknown; message?: string }> {
    return this.request<{ invitation?: unknown; member?: unknown; message?: string }>(`/workspaces/${workspaceId}/members/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    await this.request(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: 'Admin' | 'Member' | 'Viewer'
  ): Promise<{ message: string; role: string }> {
    return this.request<{ message: string; role: string }>(`/workspaces/${workspaceId}/members/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  // Workspace prompt settings
  async getPromptSettings(workspaceId: string): Promise<{ settings: PromptEnhancementSettings }> {
    return this.request<{ settings: PromptEnhancementSettings }>(`/workspaces/${workspaceId}/prompt-settings`);
  }

  async updatePromptSettings(
    workspaceId: string,
    settings: Partial<PromptEnhancementSettings>
  ): Promise<{ settings: PromptEnhancementSettings }> {
    return this.request<{ settings: PromptEnhancementSettings }>(`/workspaces/${workspaceId}/prompt-settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  // Audit log endpoints
  async listAuditLogs(filters?: AuditLogFilters): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
    has_more: boolean;
  }> {
    const params = new URLSearchParams();
    if (filters?.entity_type) params.append('entity_type', filters.entity_type);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.actor_id) params.append('actor_id', filters.actor_id);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/audit${query}`);
  }

  async exportAuditLogs(
    format: 'json' | 'csv' = 'csv',
    filters?: Omit<AuditLogFilters, 'page' | 'limit'>
  ): Promise<{ export_url: string; expires_at: string }> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters?.entity_type) params.append('entity_type', filters.entity_type);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    return this.request(`/audit/export?${params.toString()}`);
  }

  // Project endpoints
  async listProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('/projects');
  }

  async getProject(id: string): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/projects/${id}`);
  }

  async createProject(data: { name: string; description?: string }): Promise<{ project: Project }> {
    return this.request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: { name?: string; description?: string; status?: string }): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${id}`, { method: 'DELETE' });
  }

  // Task endpoints
  async listTasks(projectId?: string, filters?: { status?: string; priority?: string; assigned_to?: string }): Promise<{ tasks: Task[] }> {
    const params = new URLSearchParams();
    if (projectId) params.set('project_id', projectId);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.assigned_to) params.set('assigned_to', filters.assigned_to);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ tasks: Task[] }>(`/tasks${query}`);
  }

  async getTask(id: string): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${id}`);
  }

  async createTask(data: {
    project_id: string;
    title: string;
    description?: string;
    priority?: string;
    visibility?: string;
    due_date?: string;
  }): Promise<{ task: Task }> {
    return this.request<{ task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    visibility?: string;
    due_date?: string;
  }): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  async assignTask(id: string, userId: string | null): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/tasks/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // Prompt enhancement endpoints
  async enhancePrompt(
    prompt: string,
    style: 'minimal' | 'balanced' | 'comprehensive' = 'balanced',
    context?: string
  ): Promise<PromptEnhancementResult> {
    return this.request<PromptEnhancementResult>('/prompts/enhance', {
      method: 'POST',
      body: JSON.stringify({ prompt, style, context }),
    });
  }

  async scorePrompt(prompt: string): Promise<PromptScoreResult> {
    return this.request<PromptScoreResult>('/prompts/score', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async submitEnhancementFeedback(
    enhancementId: string,
    accepted: boolean,
    rating?: number
  ): Promise<void> {
    await this.request(`/prompts/enhance/${enhancementId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ accepted, rating }),
    });
  }

  // Prompt template endpoints
  async listPromptTemplates(category?: string): Promise<{ templates: PromptTemplate[] }> {
    const query = category ? `?category=${category}` : '';
    const response = await this.request<{ templates: any[] }>(`/prompts/templates${query}`);
    const templates = (response.templates || []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      template: t.template_text,
      category: t.category,
      is_global: Boolean(t.is_global),
      usage_count: Number(t.usage_count ?? 0),
      created_at: t.created_at,
      created_by: t.created_by,
      updated_at: t.updated_at,
    })) as PromptTemplate[];
    return { templates };
  }

  async getPromptTemplate(id: string): Promise<{ template: PromptTemplate; placeholders: string[] }> {
    const response = await this.request<{ template: any; placeholders?: string[] }>(`/prompts/templates/${id}`);
    const t = response.template;
    return {
      template: {
        id: t.id,
        name: t.name,
        description: t.description ?? undefined,
        template: t.template_text,
        category: t.category,
        is_global: Boolean(t.is_global),
        usage_count: Number(t.usage_count ?? 0),
        created_at: t.created_at,
        created_by: t.created_by,
        updated_at: t.updated_at,
      },
      placeholders: (t.placeholders || response.placeholders || []) as string[],
    };
  }

  async renderPromptTemplate(id: string, variables: Record<string, string>): Promise<{
    rendered: string;
    missingPlaceholders?: string[];
    complete?: boolean;
  }> {
    return this.request<{ rendered: string; missingPlaceholders?: string[]; complete?: boolean }>(`/prompts/templates/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ variables }),
    });
  }

  async createPromptTemplate(input: {
    name: string;
    description?: string;
    template_text: string;
    category?: string;
  }): Promise<{ template: any }> {
    return this.request<{ template: any }>('/prompts/templates', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updatePromptTemplate(
    id: string,
    input: Partial<{ name: string; description: string; template_text: string; category: string }>
  ): Promise<{ template: any }> {
    return this.request<{ template: any }>(`/prompts/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deletePromptTemplate(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/prompts/templates/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
// Backwards-compatible alias used throughout the app
export const api = apiClient;
export default apiClient;

export interface PromptEnhancementResult {
  enhancement: {
    id: string;
    original_prompt: string;
    enhanced_prompt: string;
    style: string;
    quality_score_before: number;
    quality_score_after: number;
    model: string;
  };
  feedback: string[];
}

export interface PromptScoreResult {
  score: number;
  feedback: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  template: string;
  category: string | null;
  is_global: boolean;
  usage_count: number;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}
