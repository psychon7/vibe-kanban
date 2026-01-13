import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { signupSchema, loginSchema } from '../schemas';
import { hashPassword, verifyPassword } from '../utils';
import { createSession, deleteSession, refreshSession } from '../utils';
import { requireAuth } from '../middleware';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/v1/auth/signup - Create new user account
authRoutes.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  // Check if email already exists
  const existingUser = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existingUser) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Email already registered',
      409,
      { field: 'email' }
    );
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate user ID
  const userId = crypto.randomUUID();

  // Insert user
  await c.env.DB.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(userId, email.toLowerCase(), name.trim(), passwordHash).run();

  // Create session
  const { token, expiresAt } = await createSession(c.env.CACHE, {
    id: userId,
    email: email.toLowerCase(),
    name: name.trim(),
  });

  return c.json({
    user: {
      id: userId,
      email: email.toLowerCase(),
      name: name.trim(),
    },
    token,
    expiresAt,
  }, 201);
});

// POST /api/v1/auth/login - Login with email/password
authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user by email
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
  }>();

  if (!user || !user.password_hash) {
    throw new ApiError(
      ErrorCodes.AUTH_001,
      'Invalid email or password',
      401
    );
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash);

  if (!isValid) {
    throw new ApiError(
      ErrorCodes.AUTH_001,
      'Invalid email or password',
      401
    );
  }

  // Create session
  const { token, expiresAt } = await createSession(c.env.CACHE, {
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
    expiresAt,
  });
});

// POST /api/v1/auth/logout - Logout and invalidate session
authRoutes.post('/logout', requireAuth(), async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    await deleteSession(c.env.CACHE, token);
  }

  return c.json({ message: 'Logged out successfully' });
});

// GET /api/v1/auth/me - Get current authenticated user
authRoutes.get('/me', requireAuth(), async (c) => {
  const user = c.get('user');

  // Get full user details from DB
  const fullUser = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(user!.id).first<{
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    created_at: string;
  }>();

  if (!fullUser) {
    throw new ApiError(
      ErrorCodes.NOT_FOUND,
      'User not found',
      404
    );
  }

  return c.json({
    user: {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      avatarUrl: fullUser.avatar_url,
      createdAt: fullUser.created_at,
    },
  });
});

// POST /api/v1/auth/refresh - Refresh session token
authRoutes.post('/refresh', requireAuth(), async (c) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(
      ErrorCodes.AUTH_003,
      'Missing authentication token',
      401
    );
  }

  const newSession = await refreshSession(c.env.CACHE, token);

  if (!newSession) {
    throw new ApiError(
      ErrorCodes.AUTH_002,
      'Session expired or invalid',
      401
    );
  }

  const user = c.get('user');

  return c.json({
    user: {
      id: user!.id,
      email: user!.email,
      name: user!.name,
    },
    token: newSession.token,
    expiresAt: newSession.expiresAt,
  });
});
