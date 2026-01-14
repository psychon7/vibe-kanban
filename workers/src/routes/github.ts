/**
 * GitHub Integration Routes
 * Handles OAuth, repository connections, branches, and PRs
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth';

export const githubRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
githubRoutes.use('*', requireAuth());

/**
 * GET /github/status - Check if user has GitHub connected
 */
githubRoutes.get('/status', async (c) => {
  const user = c.get('user')!;

  const connection = await c.env.DB.prepare(
    'SELECT id, github_user_id, github_username, scopes, created_at, updated_at FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first();

  return c.json({
    connected: !!connection,
    connection: connection ? {
      id: connection.id,
      github_user_id: connection.github_user_id,
      github_username: connection.github_username,
      scopes: connection.scopes,
      connected_at: connection.created_at,
    } : null
  });
});

/**
 * GET /github/connect - Start OAuth flow
 * Returns the OAuth authorization URL
 */
githubRoutes.get('/connect', async (c) => {
  const user = c.get('user')!;
  
  // Generate state for CSRF protection
  const state = crypto.randomUUID();
  
  // Store state in KV with user ID (expires in 10 minutes)
  await c.env.CACHE.put(`github_oauth:${state}`, JSON.stringify({
    user_id: user.id,
    created_at: new Date().toISOString()
  }), { expirationTtl: 600 });

  // Build OAuth URL
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID || '',
    redirect_uri: `${c.env.API_BASE_URL || 'https://vibe-kanban-api-production.sheshnarayan-iyer.workers.dev'}/api/v1/github/callback`,
    scope: 'repo read:user user:email',
    state,
  });

  return c.json({
    authorization_url: `${GITHUB_OAUTH_URL}/authorize?${params.toString()}`,
    state,
  });
});

/**
 * GET /github/callback - OAuth callback handler
 * Exchanges code for access token and stores connection
 */
githubRoutes.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    throw new ApiError(ErrorCodes.FORBIDDEN, `GitHub OAuth error: ${error}`, 403);
  }

  if (!code || !state) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Missing code or state parameter', 400);
  }

  // Verify state
  const stateData = await c.env.CACHE.get(`github_oauth:${state}`);
  if (!stateData) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid or expired state', 400);
  }

  const { user_id } = JSON.parse(stateData);
  
  // Delete state to prevent reuse
  await c.env.CACHE.delete(`github_oauth:${state}`);

  // Exchange code for access token
  const tokenResponse = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
    scope?: string;
  };

  if (tokenData.error) {
    throw new ApiError(ErrorCodes.FORBIDDEN, `GitHub token error: ${tokenData.error_description || tokenData.error}`, 403);
  }

  if (!tokenData.access_token) {
    throw new ApiError(ErrorCodes.INTERNAL_ERROR, 'Failed to get access token', 500);
  }

  // Get user info from GitHub
  const userResponse = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Vibe-Kanban-App',
    },
  });

  const githubUser = await userResponse.json() as {
    id: number;
    login: string;
    avatar_url?: string;
  };

  // Store/update connection
  const connectionId = crypto.randomUUID();
  const expiresAt = tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  // Check if connection already exists for this user
  const existingConnection = await c.env.DB.prepare(
    'SELECT id FROM github_connections WHERE user_id = ?'
  ).bind(user_id).first();

  if (existingConnection) {
    // Update existing connection
    await c.env.DB.prepare(`
      UPDATE github_connections 
      SET access_token_encrypted = ?, refresh_token_encrypted = ?, 
          github_user_id = ?, github_username = ?, scopes = ?,
          expires_at = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).bind(
      tokenData.access_token, // TODO: Encrypt this
      tokenData.refresh_token || null,
      String(githubUser.id),
      githubUser.login,
      tokenData.scope || 'repo read:user user:email',
      expiresAt,
      user_id
    ).run();
  } else {
    // Create new connection
    await c.env.DB.prepare(`
      INSERT INTO github_connections (id, user_id, github_user_id, github_username, access_token_encrypted, refresh_token_encrypted, scopes, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      connectionId,
      user_id,
      String(githubUser.id),
      githubUser.login,
      tokenData.access_token, // TODO: Encrypt this
      tokenData.refresh_token || null,
      tokenData.scope || 'repo read:user user:email',
      expiresAt
    ).run();
  }

  // Redirect to frontend with success
  const frontendUrl = c.env.CORS_ORIGIN || 'https://vibe-kanban.pages.dev';
  return c.redirect(`${frontendUrl}/settings/integrations?github=connected`);
});

/**
 * DELETE /github/disconnect - Disconnect GitHub
 */
githubRoutes.delete('/disconnect', async (c) => {
  const user = c.get('user')!;

  // Delete all connected repos first (foreign key constraint)
  await c.env.DB.prepare(`
    DELETE FROM connected_repositories 
    WHERE github_connection_id IN (SELECT id FROM github_connections WHERE user_id = ?)
  `).bind(user.id).run();

  // Delete connection
  const result = await c.env.DB.prepare(
    'DELETE FROM github_connections WHERE user_id = ?'
  ).bind(user.id).run();

  return c.json({
    success: true,
    disconnected: result.meta.changes > 0
  });
});

/**
 * GET /github/repos - List user's repositories from GitHub
 */
githubRoutes.get('/repos', async (c) => {
  const user = c.get('user')!;
  const page = parseInt(c.req.query('page') || '1');
  const perPage = Math.min(parseInt(c.req.query('per_page') || '30'), 100);

  // Get user's GitHub connection
  const connection = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  // Fetch repos from GitHub
  const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=${perPage}&page=${page}`, {
    headers: {
      'Authorization': `Bearer ${connection.access_token_encrypted}`, // TODO: Decrypt
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Vibe-Kanban-App',
    },
  });

  if (!response.ok) {
    throw new ApiError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch repositories', 500);
  }

  const repos = await response.json() as Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description: string | null;
    default_branch: string;
    html_url: string;
    updated_at: string;
    owner: { login: string; avatar_url: string };
  }>;

  return c.json({
    repositories: repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      description: r.description,
      default_branch: r.default_branch,
      html_url: r.html_url,
      updated_at: r.updated_at,
      owner: r.owner.login,
    })),
    page,
    per_page: perPage,
  });
});

/**
 * POST /github/repos/connect - Connect a repository to a workspace
 */
githubRoutes.post('/repos/connect', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    workspace_id: string;
    repo_owner: string;
    repo_name: string;
    default_branch?: string;
  };

  if (!body.workspace_id || !body.repo_owner || !body.repo_name) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Missing required fields', 400);
  }

  // Verify workspace membership
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(body.workspace_id, user.id).first<{ role: string }>();

  if (!member || member.role === 'viewer') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to connect repositories', 403);
  }

  // Get GitHub connection
  const connection = await c.env.DB.prepare(
    'SELECT id, access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ id: string; access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  // Verify repo access
  const repoResponse = await fetch(`${GITHUB_API_BASE}/repos/${body.repo_owner}/${body.repo_name}`, {
    headers: {
      'Authorization': `Bearer ${connection.access_token_encrypted}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Vibe-Kanban-App',
    },
  });

  if (!repoResponse.ok) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Repository not found or not accessible', 404);
  }

  const repoData = await repoResponse.json() as { default_branch: string };

  // Check if already connected
  const existing = await c.env.DB.prepare(
    'SELECT id FROM connected_repositories WHERE workspace_id = ? AND repo_owner = ? AND repo_name = ?'
  ).bind(body.workspace_id, body.repo_owner, body.repo_name).first();

  if (existing) {
    throw new ApiError(ErrorCodes.CONFLICT, 'Repository already connected to this workspace', 409);
  }

  // Create connection
  const repoId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO connected_repositories (id, workspace_id, github_connection_id, repo_owner, repo_name, default_branch, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).bind(
    repoId,
    body.workspace_id,
    connection.id,
    body.repo_owner,
    body.repo_name,
    body.default_branch || repoData.default_branch
  ).run();

  return c.json({
    id: repoId,
    workspace_id: body.workspace_id,
    repo_owner: body.repo_owner,
    repo_name: body.repo_name,
    default_branch: body.default_branch || repoData.default_branch,
  }, 201);
});

/**
 * GET /github/repos/connected - List connected repositories for a workspace
 */
githubRoutes.get('/repos/connected', async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.query('workspace_id');

  if (!workspaceId) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'workspace_id is required', 400);
  }

  // Verify workspace membership
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(workspaceId, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not a member of this workspace', 403);
  }

  const repos = await c.env.DB.prepare(`
    SELECT cr.*, gc.github_username 
    FROM connected_repositories cr
    LEFT JOIN github_connections gc ON cr.github_connection_id = gc.id
    WHERE cr.workspace_id = ?
    ORDER BY cr.created_at DESC
  `).bind(workspaceId).all();

  return c.json({
    repositories: repos.results,
    count: repos.results.length,
  });
});

/**
 * DELETE /github/repos/:id - Disconnect a repository
 */
githubRoutes.delete('/repos/:id', async (c) => {
  const user = c.get('user')!;
  const repoId = c.req.param('id');

  // Get repo and verify access
  const repo = await c.env.DB.prepare(
    'SELECT * FROM connected_repositories WHERE id = ?'
  ).bind(repoId).first<{ workspace_id: string }>();

  if (!repo) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Connected repository not found', 404);
  }

  // Verify admin access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(repo.workspace_id, user.id).first<{ role: string }>();

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Only admins can disconnect repositories', 403);
  }

  await c.env.DB.prepare('DELETE FROM connected_repositories WHERE id = ?').bind(repoId).run();

  return c.json({ success: true });
});

// === Branch Operations ===

/**
 * POST /github/branches - Create a branch for a session
 */
githubRoutes.post('/branches', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    session_id: string;
    repo_owner: string;
    repo_name: string;
    branch_name: string;
    base_branch?: string;
  };

  // Get session and verify access
  const session = await c.env.DB.prepare(`
    SELECT ws.*, t.workspace_team_id 
    FROM workspace_sessions ws
    JOIN tasks t ON ws.task_id = t.id
    JOIN projects p ON t.project_id = p.id
    WHERE ws.id = ?
  `).bind(body.session_id).first<{ workspace_id: string }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  // Verify membership
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized', 403);
  }

  // Get GitHub token
  const connection = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  // Get base branch SHA
  const baseBranch = body.base_branch || 'main';
  const refResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${body.repo_owner}/${body.repo_name}/git/refs/heads/${baseBranch}`,
    {
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Vibe-Kanban-App',
      },
    }
  );

  if (!refResponse.ok) {
    throw new ApiError(ErrorCodes.NOT_FOUND, `Base branch '${baseBranch}' not found`, 404);
  }

  const refData = await refResponse.json() as { object: { sha: string } };

  // Create new branch
  const createResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${body.repo_owner}/${body.repo_name}/git/refs`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vibe-Kanban-App',
      },
      body: JSON.stringify({
        ref: `refs/heads/${body.branch_name}`,
        sha: refData.object.sha,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.json() as { message: string };
    throw new ApiError(ErrorCodes.CONFLICT, `Failed to create branch: ${error.message}`, 409);
  }

  const branchData = await createResponse.json() as { ref: string; object: { sha: string } };

  return c.json({
    branch: body.branch_name,
    sha: branchData.object.sha,
    base_branch: baseBranch,
  }, 201);
});

/**
 * GET /github/branches/:owner/:repo/:branch - Get branch info
 */
githubRoutes.get('/branches/:owner/:repo/:branch', async (c) => {
  const user = c.get('user')!;
  const { owner, repo, branch } = c.req.param();

  const connection = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches/${branch}`,
    {
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Vibe-Kanban-App',
      },
    }
  );

  if (!response.ok) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Branch not found', 404);
  }

  const data = await response.json();
  return c.json(data);
});

// === Pull Request Operations ===

/**
 * POST /github/pull-requests - Create a pull request
 */
githubRoutes.post('/pull-requests', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    session_id: string;
    repo_owner: string;
    repo_name: string;
    title: string;
    body?: string;
    head: string; // Branch to merge from
    base?: string; // Branch to merge into (default: main)
    draft?: boolean;
  };

  // Get GitHub token
  const connection = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${body.repo_owner}/${body.repo_name}/pulls`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vibe-Kanban-App',
      },
      body: JSON.stringify({
        title: body.title,
        body: body.body || '',
        head: body.head,
        base: body.base || 'main',
        draft: body.draft || false,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json() as { message: string };
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, `Failed to create PR: ${error.message}`, 400);
  }

  const pr = await response.json() as {
    number: number;
    html_url: string;
    state: string;
    title: string;
  };

  // Link PR to session
  if (body.session_id) {
    await c.env.DB.prepare(`
      UPDATE workspace_sessions SET pr_number = ?, pr_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(pr.number, pr.html_url, body.session_id).run();
  }

  return c.json(pr, 201);
});

/**
 * GET /github/pull-requests/:owner/:repo/:number - Get PR details
 */
githubRoutes.get('/pull-requests/:owner/:repo/:number', async (c) => {
  const user = c.get('user')!;
  const { owner, repo, number } = c.req.param();

  const connection = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!connection) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected', 403);
  }

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${number}`,
    {
      headers: {
        'Authorization': `Bearer ${connection.access_token_encrypted}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Vibe-Kanban-App',
      },
    }
  );

  if (!response.ok) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Pull request not found', 404);
  }

  const data = await response.json();
  return c.json(data);
});

// Already exported at definition
