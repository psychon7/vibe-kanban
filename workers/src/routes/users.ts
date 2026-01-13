import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const usersRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All user routes require authentication
usersRoutes.use('*', requireAuth());

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

// GET /api/v1/users/me - Get current user (alias for /auth/me)
usersRoutes.get('/me', async (c) => {
  const user = c.get('user')!;

  const fullUser = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at, updated_at FROM users WHERE id = ?'
  ).bind(user.id).first();

  if (!fullUser) {
    throw new ApiError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404);
  }

  return c.json({ user: fullUser });
});

// PATCH /api/v1/users/me - Update current user's profile
usersRoutes.patch('/me', zValidator('json', updateProfileSchema), async (c) => {
  const user = c.get('user')!;
  const updates = c.req.valid('json');

  if (Object.keys(updates).length === 0) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No fields to update', 400);
  }

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.avatar_url !== undefined) {
    setClauses.push('avatar_url = ?');
    values.push(updates.avatar_url);
  }

  values.push(user.id);

  await c.env.DB.prepare(`
    UPDATE users SET ${setClauses.join(', ')} WHERE id = ?
  `).bind(...values).run();

  const updatedUser = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, updated_at FROM users WHERE id = ?'
  ).bind(user.id).first();

  return c.json({ user: updatedUser });
});

// GET /api/v1/users/search - Search users by email or name
usersRoutes.get('/search', async (c) => {
  const query = c.req.query('q');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  if (!query || query.length < 2) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Search query must be at least 2 characters',
      400
    );
  }

  const searchPattern = `%${query}%`;

  const users = await c.env.DB.prepare(`
    SELECT id, email, name, avatar_url
    FROM users
    WHERE email LIKE ? OR name LIKE ?
    ORDER BY 
      CASE WHEN email = ? THEN 0 ELSE 1 END,
      name ASC
    LIMIT ?
  `).bind(searchPattern, searchPattern, query.toLowerCase(), limit).all();

  return c.json({
    users: users.results,
    count: users.results?.length || 0,
  });
});

// GET /api/v1/users/:userId - Get user by ID
usersRoutes.get('/:userId', async (c) => {
  const userId = c.req.param('userId');

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    throw new ApiError(ErrorCodes.USER_NOT_FOUND, 'User not found', 404);
  }

  return c.json({ user });
});
