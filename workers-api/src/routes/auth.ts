import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/v1/auth/me - Get current authenticated user
authRoutes.get('/me', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Auth routes - To be implemented' });
});

// POST /api/v1/auth/login - Login with email/password
authRoutes.post('/login', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Login - To be implemented' });
});

// POST /api/v1/auth/logout - Logout and invalidate session
authRoutes.post('/logout', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Logout - To be implemented' });
});

// POST /api/v1/auth/signup - Create new user account
authRoutes.post('/signup', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Signup - To be implemented' });
});

// POST /api/v1/auth/refresh - Refresh session token
authRoutes.post('/refresh', async (c) => {
  // TODO: Implement in Task 2
  return c.json({ message: 'Refresh - To be implemented' });
});
