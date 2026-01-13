import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';

import type { Env, Variables } from './types/env';
import { errorHandler, requestId } from './middleware';

// Import routes
import {
  authRoutes,
  usersRoutes,
  workspacesRoutes,
  projectsRoutes,
  tasksRoutes,
  promptsRoutes,
  auditRoutes,
} from './routes';

// Create the main Hono app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─────────────────────────────────────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use('*', requestId());
app.use('*', timing());
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigin = c.env.CORS_ORIGIN;
    // Allow configured origin and localhost for development
    if (origin === allowedOrigin || origin?.startsWith('http://localhost')) {
      return origin;
    }
    return allowedOrigin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400,
}));

// Error handling
app.onError(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Endpoints
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

app.get('/health/db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as db_check').first<{ db_check: number }>();
    return c.json({
      status: 'ok',
      database: 'connected',
      result: result?.db_check,
    });
  } catch (error) {
    return c.json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes (v1)
// ─────────────────────────────────────────────────────────────────────────────

const api = app.basePath('/api/v1');

api.route('/auth', authRoutes);
api.route('/users', usersRoutes);
api.route('/workspaces', workspacesRoutes);
api.route('/projects', projectsRoutes);
api.route('/tasks', tasksRoutes);
api.route('/prompts', promptsRoutes);
api.route('/audit', auditRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Root Info & 404 Handler
// ─────────────────────────────────────────────────────────────────────────────

app.get('/', (c) => {
  return c.json({
    name: 'vibe-kanban-api',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
    docs: '/api/v1',
    endpoints: {
      health: '/health',
      healthDb: '/health/db',
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      workspaces: '/api/v1/workspaces',
      projects: '/api/v1/projects',
      tasks: '/api/v1/tasks',
      prompts: '/api/v1/prompts',
      audit: '/api/v1/audit',
    },
  });
});

app.notFound((c) => {
  return c.json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
  }, 404);
});

// Export for Cloudflare Workers
export default app;
