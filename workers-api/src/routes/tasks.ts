import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, Permissions } from '../middleware/permissions';

export const tasksRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All task routes require authentication
tasksRoutes.use('*', requireAuth());
tasksRoutes.use('*', workspaceContext());

// GET /api/v1/tasks - List tasks (with filters)
tasksRoutes.get('/', async (c) => {
  // TODO: Implement task listing with visibility filtering
  return c.json({ message: 'List tasks - To be implemented' });
});

// POST /api/v1/tasks - Create new task
tasksRoutes.post('/',
  requirePermission(Permissions.TASK_CREATE),
  async (c) => {
    // TODO: Implement task creation with creator tracking
    return c.json({ message: 'Create task - To be implemented' });
  }
);

// GET /api/v1/tasks/:id - Get task by ID
tasksRoutes.get('/:id', async (c) => {
  const taskId = c.req.param('id');
  // TODO: Implement with visibility checks
  return c.json({ message: `Get task ${taskId} - To be implemented` });
});

// PATCH /api/v1/tasks/:id - Update task
tasksRoutes.patch('/:id', async (c) => {
  const taskId = c.req.param('id');
  // TODO: Implement with permission checks
  return c.json({ message: `Update task ${taskId} - To be implemented` });
});

// DELETE /api/v1/tasks/:id - Delete task
tasksRoutes.delete('/:id',
  requirePermission(Permissions.TASK_DELETE),
  async (c) => {
    const taskId = c.req.param('id');
    return c.json({ message: `Delete task ${taskId} - To be implemented` });
  }
);

// === Task Assignment ===

// PATCH /api/v1/tasks/:id/assign - Assign task to user
tasksRoutes.patch('/:id/assign',
  requirePermission(Permissions.TASK_ASSIGN),
  async (c) => {
    // TODO: Implement in Task 6
    const taskId = c.req.param('id');
    return c.json({ message: `Assign task ${taskId} - To be implemented` });
  }
);

// PATCH /api/v1/tasks/:id/visibility - Change task visibility
tasksRoutes.patch('/:id/visibility', async (c) => {
  // TODO: Implement in Task 6
  const taskId = c.req.param('id');
  return c.json({ message: `Change visibility of task ${taskId} - To be implemented` });
});

// === Task Prompt Enhancement ===

// POST /api/v1/tasks/:id/enhance - Enhance task prompt
tasksRoutes.post('/:id/enhance',
  requirePermission(Permissions.PROMPT_ENHANCE),
  async (c) => {
    // TODO: Implement in Task 8 & 11
    const taskId = c.req.param('id');
    return c.json({ message: `Enhance prompt for task ${taskId} - To be implemented` });
  }
);
