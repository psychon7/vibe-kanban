import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';

export const usersRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All user routes require authentication
usersRoutes.use('*', requireAuth());

// GET /api/v1/users/:id - Get user by ID
usersRoutes.get('/:id', async (c) => {
  // TODO: Implement in Task 2
  const userId = c.req.param('id');
  return c.json({ message: `Get user ${userId} - To be implemented` });
});

// PATCH /api/v1/users/:id - Update user profile
usersRoutes.patch('/:id', async (c) => {
  // TODO: Implement in Task 2
  const userId = c.req.param('id');
  return c.json({ message: `Update user ${userId} - To be implemented` });
});

// GET /api/v1/users/search - Search users by email or name
usersRoutes.get('/search', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Search users - To be implemented' });
});
