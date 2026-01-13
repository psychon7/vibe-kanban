import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, requireMembership, Permissions } from '../middleware/permissions';
import { createProjectSchema, updateProjectSchema } from '../schemas';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const projectsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All project routes require authentication and workspace context
projectsRoutes.use('*', requireAuth());
projectsRoutes.use('*', workspaceContext());
projectsRoutes.use('*', requireMembership());

// GET /api/v1/projects - List projects in workspace
projectsRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const status = c.req.query('status') || 'active';

  const projects = await c.env.DB.prepare(`
    SELECT 
      p.id, p.name, p.description, p.status, p.created_at, p.updated_at,
      p.created_by,
      u.name as created_by_name,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'cancelled') as task_count
    FROM projects p
    JOIN users u ON p.created_by = u.id
    WHERE p.workspace_team_id = ? AND p.status = ?
    ORDER BY p.name ASC
  `).bind(workspaceId, status).all();

  return c.json({
    projects: projects.results,
    count: projects.results?.length || 0,
  });
});

// POST /api/v1/projects - Create new project
projectsRoutes.post('/',
  requirePermission(Permissions.PROJECT_CREATE),
  zValidator('json', createProjectSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const user = c.get('user')!;
    const { name, description } = c.req.valid('json');

    const projectId = crypto.randomUUID();

    await c.env.DB.prepare(`
      INSERT INTO projects (id, workspace_team_id, name, description, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
    `).bind(projectId, workspaceId, name, description || null, user.id).run();

    return c.json({
      project: {
        id: projectId,
        name,
        description: description || null,
        status: 'active',
        createdBy: user.id,
      },
    }, 201);
  }
);

// GET /api/v1/projects/:projectId - Get project by ID
projectsRoutes.get('/:projectId', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const projectId = c.req.param('projectId');

  const project = await c.env.DB.prepare(`
    SELECT 
      p.id, p.name, p.description, p.status, p.created_at, p.updated_at,
      p.created_by,
      u.name as created_by_name
    FROM projects p
    JOIN users u ON p.created_by = u.id
    WHERE p.id = ? AND p.workspace_team_id = ?
  `).bind(projectId, workspaceId).first();

  if (!project) {
    throw new ApiError(ErrorCodes.PROJECT_NOT_FOUND, 'Project not found', 404);
  }

  // Get task stats
  const taskStats = await c.env.DB.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM tasks
    WHERE project_id = ?
    GROUP BY status
  `).bind(projectId).all<{ status: string; count: number }>();

  const stats = {
    todo: 0,
    inprogress: 0,
    inreview: 0,
    done: 0,
    cancelled: 0,
  };
  
  taskStats.results?.forEach(row => {
    stats[row.status as keyof typeof stats] = row.count;
  });

  return c.json({
    project: {
      ...project,
      taskStats: stats,
    },
  });
});

// PATCH /api/v1/projects/:projectId - Update project
projectsRoutes.patch('/:projectId',
  requirePermission(Permissions.PROJECT_EDIT),
  zValidator('json', updateProjectSchema),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const projectId = c.req.param('projectId');
    const updates = c.req.valid('json');

    // Check project exists
    const existing = await c.env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND workspace_team_id = ?'
    ).bind(projectId, workspaceId).first();

    if (!existing) {
      throw new ApiError(ErrorCodes.PROJECT_NOT_FOUND, 'Project not found', 404);
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No fields to update', 400);
    }

    // Build dynamic update
    const setClauses: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      values.push(updates.description);
    }
    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }

    values.push(projectId);

    await c.env.DB.prepare(`
      UPDATE projects SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();

    const project = await c.env.DB.prepare(
      'SELECT id, name, description, status, created_at, updated_at FROM projects WHERE id = ?'
    ).bind(projectId).first();

    return c.json({ project });
  }
);

// DELETE /api/v1/projects/:projectId - Delete project (soft delete)
projectsRoutes.delete('/:projectId',
  requirePermission(Permissions.PROJECT_DELETE),
  async (c) => {
    const workspaceId = c.get('workspaceId')!;
    const projectId = c.req.param('projectId');

    const existing = await c.env.DB.prepare(
      'SELECT id FROM projects WHERE id = ? AND workspace_team_id = ?'
    ).bind(projectId, workspaceId).first();

    if (!existing) {
      throw new ApiError(ErrorCodes.PROJECT_NOT_FOUND, 'Project not found', 404);
    }

    // Soft delete
    await c.env.DB.prepare(`
      UPDATE projects SET status = 'deleted', updated_at = datetime('now') WHERE id = ?
    `).bind(projectId).run();

    return c.json({ message: 'Project deleted successfully' });
  }
);
