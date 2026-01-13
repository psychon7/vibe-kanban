import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, Permissions } from '../middleware/permissions';

export const projectsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All project routes require authentication
projectsRoutes.use('*', requireAuth());
projectsRoutes.use('*', workspaceContext());

// GET /api/v1/projects - List projects in workspace
projectsRoutes.get('/', async (c) => {
  // TODO: Implement project listing
  return c.json({ message: 'List projects - To be implemented' });
});

// POST /api/v1/projects - Create new project
projectsRoutes.post('/',
  requirePermission(Permissions.PROJECT_CREATE),
  async (c) => {
    // TODO: Implement project creation
    return c.json({ message: 'Create project - To be implemented' });
  }
);

// GET /api/v1/projects/:id - Get project by ID
projectsRoutes.get('/:id', async (c) => {
  const projectId = c.req.param('id');
  return c.json({ message: `Get project ${projectId} - To be implemented` });
});

// PATCH /api/v1/projects/:id - Update project
projectsRoutes.patch('/:id', async (c) => {
  const projectId = c.req.param('id');
  return c.json({ message: `Update project ${projectId} - To be implemented` });
});

// DELETE /api/v1/projects/:id - Delete project
projectsRoutes.delete('/:id',
  requirePermission(Permissions.PROJECT_DELETE),
  async (c) => {
    const projectId = c.req.param('id');
    return c.json({ message: `Delete project ${projectId} - To be implemented` });
  }
);
