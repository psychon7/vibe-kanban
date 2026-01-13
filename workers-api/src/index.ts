import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { timing } from 'hono/timing';

import type { Env, Variables } from './types/env';
import { errorHandler } from './middleware/error-handler';
import { requestId } from './middleware/request-id';

// Import routes
import { authRoutes } from './routes/auth';
import { usersRoutes } from './routes/users';
import { workspacesRoutes } from './routes/workspaces';
import { projectsRoutes } from './routes/projects';
import { tasksRoutes } from './routes/tasks';
import { promptsRoutes } from './routes/prompts';
import { auditRoutes } from './routes/audit';

// Create the main Hono app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
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
    return allowedOrigin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Workspace-Id', 'X-Request-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400,
}));

// Error handling
app.onError(errorHandler);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    app: c.env.APP_NAME,
  });
});

// API version prefix
const api = app.basePath('/api/v1');

// Mount routes
api.route('/auth', authRoutes);
api.route('/users', usersRoutes);
api.route('/workspaces', workspacesRoutes);
api.route('/projects', projectsRoutes);
api.route('/tasks', tasksRoutes);
api.route('/prompts', promptsRoutes);
api.route('/audit', auditRoutes);

// 404 handler
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
