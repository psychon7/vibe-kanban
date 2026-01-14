/**
 * MCP (Model Context Protocol) Server API Routes
 * Enables external AI assistants to interact with vibe-kanban
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../middleware/error-handler';
import { createHash } from 'node:crypto';

export const mcpRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Most routes require authentication, except execute (uses API key)
mcpRoutes.use('/keys/*', requireAuth());

/**
 * Middleware to validate MCP API key
 */
const requireApiKey = () => {
  return async (c: any, next: () => Promise<void>) => {
    const apiKey = c.req.header('X-MCP-API-Key') || c.req.query('api_key');
    
    if (!apiKey) {
      throw new ApiError(ErrorCodes.UNAUTHORIZED, 'MCP API key required', 401);
    }

    // Hash the key
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Find the key in database
    const keyRecord = await c.env.DB.prepare(`
      SELECT k.*, wm.user_id, wm.role
      FROM mcp_api_keys k
      JOIN workspace_members wm ON k.workspace_team_id = wm.workspace_team_id
      WHERE k.key_hash = ? AND (k.expires_at IS NULL OR k.expires_at > datetime('now'))
      LIMIT 1
    `).bind(keyHash).first() as {
      id: string;
      workspace_team_id: string;
      name: string;
      permissions: string;
      user_id: string;
      role: string;
    } | null;

    if (!keyRecord) {
      throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired API key', 401);
    }

    // Update last_used_at
    await c.env.DB.prepare(
      'UPDATE mcp_api_keys SET last_used_at = datetime(\'now\') WHERE id = ?'
    ).bind(keyRecord.id).run();

    // Store key info in context
    c.set('mcpKey', {
      id: keyRecord.id,
      workspace_id: keyRecord.workspace_team_id,
      permissions: JSON.parse(keyRecord.permissions),
      user_id: keyRecord.user_id,
      role: keyRecord.role,
    });

    await next();
  };
};

/**
 * POST /mcp/keys - Create new MCP API key
 */
mcpRoutes.post('/keys', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    workspace_id: string;
    name: string;
    permissions?: string[];
    expires_in_days?: number;
  };

  if (!body.workspace_id || !body.name) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'workspace_id and name are required', 400);
  }

  // Verify user has access to workspace
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(body.workspace_id, user.id).first<{ role: string }>();

  if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Admin access required', 403);
  }

  // Generate API key
  const apiKey = `vk_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const permissions = body.permissions || ['list_projects', 'list_tasks', 'get_task', 'get_project'];
  let expiresAt: string | null = null;
  if (body.expires_in_days) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + body.expires_in_days);
    expiresAt = expiryDate.toISOString();
  }

  const keyId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO mcp_api_keys (id, workspace_team_id, name, key_hash, permissions, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    keyId,
    body.workspace_id,
    body.name,
    keyHash,
    JSON.stringify(permissions),
    expiresAt
  ).run();

  return c.json({
    key: {
      id: keyId,
      name: body.name,
      api_key: apiKey, // Only returned once
      permissions,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
  }, 201);
});

/**
 * GET /mcp/keys - List API keys for workspace
 */
mcpRoutes.get('/keys', async (c) => {
  const user = c.get('user')!;
  const workspaceId = c.req.query('workspace_id');

  if (!workspaceId) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'workspace_id query parameter required', 400);
  }

  // Verify access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(workspaceId, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
  }

  const keys = await c.env.DB.prepare(`
    SELECT id, name, permissions, last_used_at, expires_at, created_at
    FROM mcp_api_keys
    WHERE workspace_team_id = ?
    ORDER BY created_at DESC
  `).bind(workspaceId).all();

  return c.json({
    keys: keys.results.map(k => ({
      ...k,
      permissions: JSON.parse(k.permissions as string),
      is_expired: k.expires_at && new Date(k.expires_at as string) < new Date(),
    })),
  });
});

/**
 * DELETE /mcp/keys/:id - Revoke API key
 */
mcpRoutes.delete('/keys/:id', async (c) => {
  const user = c.get('user')!;
  const keyId = c.req.param('id');

  // Verify user owns the key's workspace
  const key = await c.env.DB.prepare(`
    SELECT k.id, k.workspace_team_id, wm.role
    FROM mcp_api_keys k
    JOIN workspace_members wm ON k.workspace_team_id = wm.workspace_team_id
    WHERE k.id = ? AND wm.user_id = ?
  `).bind(keyId, user.id).first<{ role: string }>();

  if (!key || (key.role !== 'admin' && key.role !== 'owner')) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to revoke this key', 403);
  }

  await c.env.DB.prepare('DELETE FROM mcp_api_keys WHERE id = ?').bind(keyId).run();

  return c.json({ success: true });
});

/**
 * POST /mcp/execute - Execute MCP tool
 */
mcpRoutes.post('/execute', requireApiKey(), async (c) => {
  const mcpKey = c.get('mcpKey')!;
  
  const body = await c.req.json() as {
    tool: string;
    arguments: Record<string, unknown>;
  };

  if (!body.tool) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'tool is required', 400);
  }

  // Check permission
  if (!mcpKey.permissions.includes(body.tool)) {
    throw new ApiError(ErrorCodes.FORBIDDEN, `Tool ${body.tool} not permitted for this API key`, 403);
  }

  // Execute the tool
  let result;
  switch (body.tool) {
    case 'list_projects':
      result = await listProjects(c, mcpKey);
      break;
    case 'list_tasks':
      result = await listTasks(c, mcpKey, body.arguments);
      break;
    case 'get_task':
      result = await getTask(c, mcpKey, body.arguments);
      break;
    case 'create_task':
      result = await createTask(c, mcpKey, body.arguments);
      break;
    case 'update_task':
      result = await updateTask(c, mcpKey, body.arguments);
      break;
    case 'delete_task':
      result = await deleteTask(c, mcpKey, body.arguments);
      break;
    case 'get_project':
      result = await getProject(c, mcpKey, body.arguments);
      break;
    case 'start_workspace_session':
      result = await startWorkspaceSession(c, mcpKey, body.arguments);
      break;
    default:
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, `Unknown tool: ${body.tool}`, 400);
  }

  // Log the execution
  await c.env.DB.prepare(`
    INSERT INTO mcp_api_logs (id, key_id, tool_name, arguments, response_status, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    mcpKey.workspace_id,
    body.tool,
    JSON.stringify(body.arguments),
    'success'
  ).run();

  return c.json({ result });
});

// Tool implementations
async function listProjects(c: any, mcpKey: any) {
  const projects = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.description, p.created_at
    FROM projects p
    WHERE p.workspace_team_id = ?
    ORDER BY p.created_at DESC
  `).bind(mcpKey.workspace_id).all();

  return { projects: projects.results };
}

async function listTasks(c: any, mcpKey: any, args: Record<string, unknown>) {
  const projectId = args.project_id as string;
  const status = args.status as string | undefined;
  const limit = (args.limit as number) || 50;

  let query = `
    SELECT t.id, t.title, t.description, t.status, t.assigned_to, t.created_at, t.updated_at
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.workspace_team_id = ?
  `;
  const params: (string | number)[] = [mcpKey.workspace_id];

  if (projectId) {
    query += ` AND t.project_id = ?`;
    params.push(projectId);
  }
  if (status) {
    query += ` AND t.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY t.created_at DESC LIMIT ?`;
  params.push(limit);

  const tasks = await c.env.DB.prepare(query).bind(...params).all();
  return { tasks: tasks.results };
}

async function getTask(c: any, mcpKey: any, args: Record<string, unknown>) {
  const taskId = args.task_id as string;
  if (!taskId) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'task_id required', 400);
  }

  const task = await c.env.DB.prepare(`
    SELECT t.*
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ? AND p.workspace_team_id = ?
  `).bind(taskId, mcpKey.workspace_id).first();

  if (!task) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
  }

  return { task };
}

async function createTask(c: any, mcpKey: any, args: Record<string, unknown>) {
  const { project_id, title, description, status } = args as {
    project_id: string;
    title: string;
    description?: string;
    status?: string;
  };

  if (!project_id || !title) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'project_id and title required', 400);
  }

  // Verify project exists in workspace
  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND workspace_team_id = ?'
  ).bind(project_id, mcpKey.workspace_id).first();

  if (!project) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Project not found', 404);
  }

  const taskId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO tasks (id, project_id, title, description, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(taskId, project_id, title, description || '', status || 'todo', mcpKey.user_id).run();

  return { task: { id: taskId, title, description, status: status || 'todo' } };
}

async function updateTask(c: any, mcpKey: any, args: Record<string, unknown>) {
  const { task_id, title, description, status } = args as {
    task_id: string;
    title?: string;
    description?: string;
    status?: string;
  };

  if (!task_id) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'task_id required', 400);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (title) {
    updates.push('title = ?');
    params.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }
  if (status) {
    updates.push('status = ?');
    params.push(status);
  }
  
  updates.push('updated_at = datetime(\'now\')');
  params.push(task_id, mcpKey.workspace_id);

  await c.env.DB.prepare(`
    UPDATE tasks SET ${updates.join(', ')}
    WHERE id = ? AND project_id IN (
      SELECT id FROM projects WHERE workspace_team_id = ?
    )
  `).bind(...params).run();

  return { success: true };
}

async function deleteTask(c: any, mcpKey: any, args: Record<string, unknown>) {
  const taskId = args.task_id as string;
  if (!taskId) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'task_id required', 400);
  }

  await c.env.DB.prepare(`
    DELETE FROM tasks
    WHERE id = ? AND project_id IN (
      SELECT id FROM projects WHERE workspace_team_id = ?
    )
  `).bind(taskId, mcpKey.workspace_id).run();

  return { success: true };
}

async function getProject(c: any, mcpKey: any, args: Record<string, unknown>) {
  const projectId = args.project_id as string;
  if (!projectId) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'project_id required', 400);
  }

  const project = await c.env.DB.prepare(
    'SELECT * FROM projects WHERE id = ? AND workspace_team_id = ?'
  ).bind(projectId, mcpKey.workspace_id).first();

  if (!project) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Project not found', 404);
  }

  return { project };
}

async function startWorkspaceSession(c: any, mcpKey: any, args: Record<string, unknown>) {
  const { task_id, executor, execution_mode } = args as {
    task_id: string;
    executor?: string;
    execution_mode?: string;
  };

  if (!task_id) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'task_id required', 400);
  }

  // Verify task exists
  const task = await c.env.DB.prepare(`
    SELECT t.id, t.title, p.workspace_id
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ? AND p.workspace_team_id = ?
  `).bind(task_id, mcpKey.workspace_id).first() as { workspace_id: string; title: string } | null;

  if (!task) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const branch = `vibe/${task.title.toLowerCase().replace(/\s+/g, '-')}-${sessionId.slice(0, 8)}`;

  await c.env.DB.prepare(`
    INSERT INTO workspace_sessions (id, task_id, workspace_id, executor, execution_mode, branch, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(
    sessionId,
    task_id,
    task.workspace_id,
    executor || 'CLAUDE_API',
    execution_mode || 'api',
    branch
  ).run();

  return {
    session: {
      id: sessionId,
      task_id,
      branch,
      status: 'pending',
    },
  };
}
