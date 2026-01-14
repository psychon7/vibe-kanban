/**
 * Workspace Templates Routes
 * API endpoints for workspace templates
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const templatesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
templatesRoutes.use('*', requireAuth());

interface TemplateConfig {
  default_agent?: string;
  repo_setup?: {
    template_repo?: string;
    setup_script?: string;
    env_vars?: Record<string, string>;
  };
  starter_tasks?: Array<{
    title: string;
    description: string;
    labels?: string[];
  }>;
  system_prompt?: string;
}

/**
 * GET /templates - List templates
 */
templatesRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const isPublic = c.req.query('public');
  const creatorId = c.req.query('creator_id');

  let query = `
    SELECT t.*, u.name as creator_name, u.email as creator_email
    FROM workspace_templates t
    LEFT JOIN users u ON t.creator_id = u.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (isPublic === 'true') {
    query += ` AND t.is_public = 1`;
  } else {
    // User can see their own templates and public ones
    query += ` AND (t.creator_id = ? OR t.is_public = 1)`;
    params.push(user.id);
  }

  if (creatorId) {
    query += ` AND t.creator_id = ?`;
    params.push(creatorId);
  }

  query += ` ORDER BY t.use_count DESC, t.created_at DESC`;

  const result = await c.env.DB.prepare(query).bind(...params).all();

  const templates = result.results.map(row => ({
    ...row,
    config: JSON.parse(row.config as string),
    is_public: Boolean(row.is_public),
  }));

  return c.json({ templates });
});

/**
 * POST /templates - Create template
 */
templatesRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    name: string;
    description?: string;
    workspace_id?: string;
    is_public?: boolean;
    config: TemplateConfig;
  };

  if (!body.name || !body.config) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'name and config are required', 400);
  }

  // If workspace_id provided, verify user has access
  if (body.workspace_id) {
    const workspace = await c.env.DB.prepare(
      'SELECT wt.id FROM workspaces wt JOIN workspace_members wm ON wt.id = wm.workspace_team_id WHERE wt.id = ? AND wm.user_id = ?'
    ).bind(body.workspace_id, user.id).first();

    if (!workspace) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Workspace not found or access denied', 403);
    }
  }

  const templateId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO workspace_templates (id, name, description, creator_id, workspace_id, is_public, config)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    templateId,
    body.name,
    body.description || null,
    user.id,
    body.workspace_id || null,
    body.is_public ? 1 : 0,
    JSON.stringify(body.config)
  ).run();

  return c.json({
    template: {
      id: templateId,
      name: body.name,
      description: body.description,
      creator_id: user.id,
      workspace_id: body.workspace_id,
      is_public: body.is_public || false,
      config: body.config,
      use_count: 0,
      created_at: new Date().toISOString(),
    },
  }, 201);
});

/**
 * GET /templates/:id - Get template
 */
templatesRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('id');

  const template = await c.env.DB.prepare(`
    SELECT t.*, u.name as creator_name, u.email as creator_email
    FROM workspace_templates t
    LEFT JOIN users u ON t.creator_id = u.id
    WHERE t.id = ? AND (t.is_public = 1 OR t.creator_id = ?)
  `).bind(templateId, user.id).first();

  if (!template) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
  }

  return c.json({
    template: {
      ...template,
      config: JSON.parse(template.config as string),
      is_public: Boolean(template.is_public),
    },
  });
});

/**
 * PUT /templates/:id - Update template
 */
templatesRoutes.put('/:id', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('id');
  const body = await c.req.json() as {
    name?: string;
    description?: string;
    is_public?: boolean;
    config?: TemplateConfig;
  };

  // Verify ownership
  const template = await c.env.DB.prepare(
    'SELECT id FROM workspace_templates WHERE id = ? AND creator_id = ?'
  ).bind(templateId, user.id).first();

  if (!template) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found or not owned by user', 404);
  }

  const updates: string[] = [];
  const params: (string | number)[] = [];

  if (body.name) {
    updates.push('name = ?');
    params.push(body.name);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    params.push(body.description);
  }
  if (body.is_public !== undefined) {
    updates.push('is_public = ?');
    params.push(body.is_public ? 1 : 0);
  }
  if (body.config) {
    updates.push('config = ?');
    params.push(JSON.stringify(body.config));
  }
  
  updates.push('updated_at = datetime(\'now\')');
  params.push(templateId);

  if (updates.length > 0) {
    await c.env.DB.prepare(`
      UPDATE workspace_templates 
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...params).run();
  }

  return c.json({ success: true });
});

/**
 * DELETE /templates/:id - Delete template
 */
templatesRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('id');

  // Verify ownership
  const template = await c.env.DB.prepare(
    'SELECT id FROM workspace_templates WHERE id = ? AND creator_id = ?'
  ).bind(templateId, user.id).first();

  if (!template) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found or not owned by user', 404);
  }

  await c.env.DB.prepare('DELETE FROM workspace_templates WHERE id = ?').bind(templateId).run();

  return c.json({ success: true });
});

/**
 * POST /templates/:id/fork - Fork template (create copy)
 */
templatesRoutes.post('/:id/fork', async (c) => {
  const user = c.get('user')!;
  const templateId = c.req.param('id');

  // Get template
  const template = await c.env.DB.prepare(`
    SELECT * FROM workspace_templates 
    WHERE id = ? AND (is_public = 1 OR creator_id = ?)
  `).bind(templateId, user.id).first<{
    name: string;
    description: string;
    config: string;
  }>();

  if (!template) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Template not found', 404);
  }

  // Increment use count on original
  await c.env.DB.prepare(
    'UPDATE workspace_templates SET use_count = use_count + 1 WHERE id = ?'
  ).bind(templateId).run();

  // Create fork
  const forkId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO workspace_templates (id, name, description, creator_id, is_public, config, use_count)
    VALUES (?, ?, ?, ?, 0, ?, 0)
  `).bind(
    forkId,
    `${template.name} (Fork)`,
    template.description,
    user.id,
    template.config
  ).run();

  return c.json({
    template: {
      id: forkId,
      name: `${template.name} (Fork)`,
      description: template.description,
      creator_id: user.id,
      is_public: false,
      config: JSON.parse(template.config),
      use_count: 0,
      created_at: new Date().toISOString(),
    },
  }, 201);
});

/**
 * POST /templates/seed - Seed built-in templates (admin only)
 */
templatesRoutes.post('/seed', async (c) => {
  const user = c.get('user')!;
  
  // Simple admin check - in production, use proper role check
  if (user.email !== 'admin@vibe-kanban.dev' && !user.email?.includes('admin')) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Admin access required', 403);
  }

  const builtInTemplates = [
    {
      id: crypto.randomUUID(),
      name: 'React + TypeScript',
      description: 'Modern React app with TypeScript, Vite, ESLint, and Vitest',
      config: {
        default_agent: 'CLAUDE_API',
        repo_setup: {
          template_repo: 'vitejs/vite-react-ts-template',
          setup_script: 'npm install && npm run dev',
        },
        starter_tasks: [
          { title: 'Set up project structure', description: 'Initialize React TypeScript project with Vite' },
          { title: 'Configure ESLint and Prettier', description: 'Add linting and formatting rules' },
          { title: 'Create first component', description: 'Build a sample component with tests' },
        ],
        system_prompt: 'You are a React and TypeScript expert. Follow modern React best practices.',
      },
    },
    {
      id: crypto.randomUUID(),
      name: 'Node.js API',
      description: 'RESTful API with Express, TypeScript, and Jest testing',
      config: {
        default_agent: 'CLAUDE_API',
        repo_setup: {
          setup_script: 'npm install && npm run build',
          env_vars: { NODE_ENV: 'development', PORT: '3000' },
        },
        starter_tasks: [
          { title: 'Set up Express server', description: 'Create basic Express app with TypeScript' },
          { title: 'Add API routes', description: 'Implement CRUD endpoints' },
          { title: 'Add authentication', description: 'Implement JWT authentication' },
        ],
        system_prompt: 'You are a Node.js and Express expert. Write clean, tested API code.',
      },
    },
    {
      id: crypto.randomUUID(),
      name: 'Python ML Project',
      description: 'Machine learning project with FastAPI, pytest, and conda',
      config: {
        default_agent: 'CLAUDE_API',
        repo_setup: {
          setup_script: 'conda create -n myenv python=3.11 && conda activate myenv && pip install -r requirements.txt',
        },
        starter_tasks: [
          { title: 'Set up FastAPI server', description: 'Create ML API with FastAPI' },
          { title: 'Add ML model endpoint', description: 'Implement inference endpoint' },
          { title: 'Add tests', description: 'Write pytest tests for API' },
        ],
        system_prompt: 'You are a Python and ML expert. Write production-ready ML code.',
      },
    },
    {
      id: crypto.randomUUID(),
      name: 'Full-Stack Next.js',
      description: 'Full-stack app with Next.js, Prisma, tRPC, and Tailwind',
      config: {
        default_agent: 'CLAUDE_API',
        repo_setup: {
          template_repo: 'create-t3-app/create-t3-app',
          setup_script: 'npm install && npx prisma generate && npm run dev',
        },
        starter_tasks: [
          { title: 'Set up database schema', description: 'Define Prisma schema' },
          { title: 'Create tRPC routes', description: 'Implement API routes with tRPC' },
          { title: 'Build UI components', description: 'Create React components with Tailwind' },
        ],
        system_prompt: 'You are a full-stack expert in Next.js, Prisma, and tRPC.',
      },
    },
  ];

  for (const template of builtInTemplates) {
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO workspace_templates (id, name, description, creator_id, is_public, config, use_count)
      VALUES (?, ?, ?, ?, 1, ?, 0)
    `).bind(
      template.id,
      template.name,
      template.description,
      user.id,
      JSON.stringify(template.config)
    ).run();
  }

  return c.json({ success: true, count: builtInTemplates.length });
});
