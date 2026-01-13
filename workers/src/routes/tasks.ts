import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, requireMembership, Permissions } from '../middleware/permissions';
import { createTaskSchema, updateTaskSchema, assignTaskSchema, taskFiltersSchema } from '../schemas';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const tasksRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All task routes require authentication
tasksRoutes.use('*', requireAuth());
tasksRoutes.use('*', workspaceContext());
tasksRoutes.use('*', requireMembership());

// GET /api/v1/tasks - List tasks (with filters and visibility)
tasksRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const user = c.get('user')!;
  
  const filters = taskFiltersSchema.parse({
    project_id: c.req.query('project_id'),
    status: c.req.query('status'),
    assigned_to: c.req.query('assigned_to'),
    priority: c.req.query('priority'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  });

  const offset = (filters.page - 1) * filters.limit;

  // Build query with visibility filtering
  let whereClause = `
    p.workspace_team_id = ? AND (
      t.visibility = 'workspace' OR
      t.created_by_user_id = ? OR
      EXISTS (SELECT 1 FROM task_acl acl WHERE acl.task_id = t.id AND acl.user_id = ?)
    )
  `;
  const params: unknown[] = [workspaceId, user.id, user.id];

  if (filters.project_id) {
    whereClause += ' AND t.project_id = ?';
    params.push(filters.project_id);
  }
  if (filters.status) {
    whereClause += ' AND t.status = ?';
    params.push(filters.status);
  }
  if (filters.assigned_to) {
    whereClause += ' AND t.assigned_to_user_id = ?';
    params.push(filters.assigned_to);
  }
  if (filters.priority) {
    whereClause += ' AND t.priority = ?';
    params.push(filters.priority);
  }

  params.push(filters.limit, offset);

  const tasks = await c.env.DB.prepare(`
    SELECT 
      t.id, t.title, t.description, t.status, t.priority, t.visibility,
      t.due_date, t.created_at, t.updated_at,
      t.project_id,
      p.name as project_name,
      t.assigned_to_user_id,
      ua.name as assigned_to_name,
      ua.email as assigned_to_email,
      t.created_by_user_id,
      uc.name as created_by_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users ua ON t.assigned_to_user_id = ua.id
    JOIN users uc ON t.created_by_user_id = uc.id
    WHERE ${whereClause}
    ORDER BY 
      CASE t.priority 
        WHEN 'urgent' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      t.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all();

  // Get total count
  const countParams = params.slice(0, -2); // Remove limit and offset
  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE ${whereClause.replace(' LIMIT ? OFFSET ?', '')}
  `).bind(...countParams).first<{ total: number }>();

  return c.json({
    tasks: tasks.results,
    count: tasks.results?.length || 0,
    total: countResult?.total || 0,
    page: filters.page,
    limit: filters.limit,
  });
});

// POST /api/v1/tasks - Create new task
tasksRoutes.post('/',
  requirePermission(Permissions.TASK_CREATE),
  zValidator('json', createTaskSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const input = c.req.valid('json');

    // Verify project belongs to workspace
    const project = await c.env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND workspace_team_id = ? AND status = ?'
    ).bind(input.project_id, workspaceId, 'active').first();

    if (!project) {
      throw new ApiError(ErrorCodes.PROJECT_NOT_FOUND, 'Project not found', 404);
    }

    // Verify assigned user is workspace member (if provided)
    if (input.assigned_to_user_id) {
      const member = await c.env.DB.prepare(
        'SELECT 1 FROM workspace_members WHERE workspace_team_id = ? AND user_id = ? AND status = ?'
      ).bind(workspaceId, input.assigned_to_user_id, 'active').first();

      if (!member) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          'Assigned user is not a member of this workspace',
          400
        );
      }
    }

    const taskId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO tasks (
        id, project_id, title, description, status, priority,
        assigned_to_user_id, created_by_user_id, visibility, due_date,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      taskId,
      input.project_id,
      input.title,
      input.description || null,
      input.priority,
      input.assigned_to_user_id || null,
      user.id,
      input.visibility,
      input.due_date || null
    ).run();

    return c.json({
      task: {
        id: taskId,
        title: input.title,
        description: input.description || null,
        status: 'todo',
        priority: input.priority,
        visibility: input.visibility,
        projectId: input.project_id,
        assignedToUserId: input.assigned_to_user_id || null,
        createdByUserId: user.id,
        dueDate: input.due_date || null,
      },
    }, 201);
  }
);

// GET /api/v1/tasks/:taskId - Get task by ID
tasksRoutes.get('/:taskId', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const user = c.get('user')!;
  const taskId = c.req.param('taskId');

  const task = await c.env.DB.prepare(`
    SELECT 
      t.id, t.title, t.description, t.status, t.priority, t.visibility,
      t.due_date, t.created_at, t.updated_at,
      t.project_id,
      p.name as project_name,
      t.assigned_to_user_id,
      ua.name as assigned_to_name,
      ua.email as assigned_to_email,
      t.created_by_user_id,
      uc.name as created_by_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users ua ON t.assigned_to_user_id = ua.id
    JOIN users uc ON t.created_by_user_id = uc.id
    WHERE t.id = ? AND p.workspace_team_id = ?
  `).bind(taskId, workspaceId).first();

  if (!task) {
    throw new ApiError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
  }

  // Check visibility
  const visibility = task.visibility as string;
  const isCreator = task.created_by_user_id === user.id;
  
  if (visibility === 'private' && !isCreator) {
    throw new ApiError(ErrorCodes.TASK_002, 'You do not have access to this task', 403);
  }

  if (visibility === 'restricted' && !isCreator) {
    const hasAccess = await c.env.DB.prepare(
      'SELECT 1 FROM task_acl WHERE task_id = ? AND user_id = ?'
    ).bind(taskId, user.id).first();

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.TASK_002, 'You do not have access to this task', 403);
    }
  }

  return c.json({ task });
});

// PATCH /api/v1/tasks/:taskId - Update task
tasksRoutes.patch('/:taskId',
  zValidator('json', updateTaskSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const taskId = c.req.param('taskId');
    const updates = c.req.valid('json');

    // Get task and check access
    const task = await c.env.DB.prepare(`
      SELECT t.*, p.workspace_team_id
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.workspace_team_id = ?
    `).bind(taskId, workspaceId).first<{
      id: string;
      created_by_user_id: string;
      visibility: string;
    }>();

    if (!task) {
      throw new ApiError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
    }

    // Check edit permission (creator or has task.edit permission)
    const isCreator = task.created_by_user_id === user.id;
    if (!isCreator) {
      // Check if user has task.edit permission (handled by middleware if we add it)
      // For now, allow edit if user has workspace access
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No fields to update', 400);
    }

    // Build dynamic update
    const setClauses: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.visibility !== undefined) {
      setClauses.push('visibility = ?');
      values.push(updates.visibility);
    }
    if (updates.due_date !== undefined) {
      setClauses.push('due_date = ?');
      values.push(updates.due_date);
    }

    values.push(taskId);

    await c.env.DB.prepare(`
      UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated task
    const updatedTask = await c.env.DB.prepare(`
      SELECT 
        t.id, t.title, t.description, t.status, t.priority, t.visibility,
        t.due_date, t.created_at, t.updated_at,
        t.project_id, t.assigned_to_user_id, t.created_by_user_id
      FROM tasks t WHERE t.id = ?
    `).bind(taskId).first();

    return c.json({ task: updatedTask });
  }
);

// DELETE /api/v1/tasks/:taskId - Delete task
tasksRoutes.delete('/:taskId',
  requirePermission(Permissions.TASK_DELETE),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const taskId = c.req.param('taskId');

    const task = await c.env.DB.prepare(`
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.workspace_team_id = ?
    `).bind(taskId, workspaceId).first();

    if (!task) {
      throw new ApiError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
    }

    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();

    return c.json({ message: 'Task deleted successfully' });
  }
);

// === Task Assignment ===

// PATCH /api/v1/tasks/:taskId/assign - Assign task to user
tasksRoutes.patch('/:taskId/assign',
  requirePermission(Permissions.TASK_ASSIGN),
  zValidator('json', assignTaskSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const taskId = c.req.param('taskId');
    const { user_id } = c.req.valid('json');

    // Verify task exists
    const task = await c.env.DB.prepare(`
      SELECT t.id FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.workspace_team_id = ?
    `).bind(taskId, workspaceId).first();

    if (!task) {
      throw new ApiError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
    }

    // If assigning, verify user is workspace member
    if (user_id) {
      const member = await c.env.DB.prepare(
        'SELECT 1 FROM workspace_members WHERE workspace_team_id = ? AND user_id = ? AND status = ?'
      ).bind(workspaceId, user_id, 'active').first();

      if (!member) {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          'User is not a member of this workspace',
          400
        );
      }
    }

    await c.env.DB.prepare(`
      UPDATE tasks SET assigned_to_user_id = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(user_id, taskId).run();

    return c.json({ 
      message: user_id ? 'Task assigned successfully' : 'Task unassigned successfully',
      assignedTo: user_id,
    });
  }
);

// PATCH /api/v1/tasks/:taskId/visibility - Change task visibility
tasksRoutes.patch('/:taskId/visibility', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const user = c.get('user')!;
  const taskId = c.req.param('taskId');
  const body = await c.req.json<{ visibility: string; user_ids?: string[] }>();

  if (!body.visibility || !['workspace', 'private', 'restricted'].includes(body.visibility)) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid visibility. Must be workspace, private, or restricted',
      400
    );
  }

  // Verify task exists and user is creator
  const task = await c.env.DB.prepare(`
    SELECT t.id, t.created_by_user_id FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ? AND p.workspace_team_id = ?
  `).bind(taskId, workspaceId).first<{ id: string; created_by_user_id: string }>();

  if (!task) {
    throw new ApiError(ErrorCodes.TASK_NOT_FOUND, 'Task not found', 404);
  }

  // Only creator can change visibility
  if (task.created_by_user_id !== user.id) {
    throw new ApiError(
      ErrorCodes.AUTH_004,
      'Only the task creator can change visibility',
      403
    );
  }

  // Update visibility
  await c.env.DB.prepare(`
    UPDATE tasks SET visibility = ?, updated_at = datetime('now') WHERE id = ?
  `).bind(body.visibility, taskId).run();

  // Handle restricted visibility ACL
  if (body.visibility === 'restricted' && body.user_ids) {
    // Clear existing ACL
    await c.env.DB.prepare('DELETE FROM task_acl WHERE task_id = ?').bind(taskId).run();

    // Add new ACL entries
    for (const userId of body.user_ids) {
      await c.env.DB.prepare(`
        INSERT INTO task_acl (task_id, user_id, access_level, created_at)
        VALUES (?, ?, 'view', datetime('now'))
      `).bind(taskId, userId).run();
    }
  }

  return c.json({ 
    message: 'Visibility updated successfully',
    visibility: body.visibility,
  });
});

// === Task Prompt Enhancement ===

// POST /api/v1/tasks/:taskId/enhance - Enhance task prompt
tasksRoutes.post('/:taskId/enhance',
  requirePermission(Permissions.PROMPT_ENHANCE),
  async (c) => {
    const taskId = c.req.param('taskId');
    // TODO: Implement AI enhancement via AI Gateway
    return c.json({ 
      message: `Prompt enhancement for task ${taskId} - To be implemented with AI Gateway`,
    });
  }
);
