const API_BASE = '/api/v1';

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
  description?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  member_count?: number;
  role?: string;
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
    return this.request<{ members: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`);
  }

  async inviteWorkspaceMember(workspaceId: string, email: string, roleId: string): Promise<{ invitation: unknown }> {
    return this.request<{ invitation: unknown }>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role_id: roleId }),
    });
  }

  async removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    await this.request(`/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
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
    return this.request<{ templates: PromptTemplate[] }>(`/prompts/templates${query}`);
  }

  async getPromptTemplate(id: string): Promise<{ template: PromptTemplate; placeholders: string[] }> {
    return this.request<{ template: PromptTemplate; placeholders: string[] }>(`/prompts/templates/${id}`);
  }

  async renderPromptTemplate(id: string, variables: Record<string, string>): Promise<{ rendered: string }> {
    return this.request<{ rendered: string }>(`/prompts/templates/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ variables }),
    });
  }
}

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
  category: string;
  is_global: boolean;
  usage_count: number;
  created_at: string;
}

export const api = new ApiClient();
