import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requireMembership } from '../middleware/permissions';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const sessionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Validation schemas
const createSessionSchema = z.object({
  task_id: z.string().uuid(),
  executor: z.enum(['CLAUDE_API', 'OPENAI_API', 'GEMINI_API', 'LOCAL_RELAY', 'CODESPACES']),
  branch: z.string().optional(),
  execution_mode: z.enum(['api', 'relay', 'external']).optional().default('api'),
});

const updateSessionSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  error_message: z.string().optional(),
});

// Generate a branch name from task title
function generateBranchName(taskTitle: string, sessionId: string): string {
  const slug = taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
  const shortId = sessionId.substring(0, 8);
  return `vibe/${slug}-${shortId}`;
}

// All session routes require authentication
sessionsRoutes.use('*', requireAuth());

// POST /api/v1/sessions - Create a new workspace session
sessionsRoutes.post('/', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();
  
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', 400, { errors: parsed.error.errors });
  }

  const { task_id, executor, execution_mode } = parsed.data;

  // Get the task and verify access
  const task = await c.env.DB.prepare(
    'SELECT t.*, p.workspace_team_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?'
  ).bind(task_id).first<{ id: string; title: string; workspace_team_id: string; project_id: string }>();

  if (!task) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Task not found', 404);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(task.workspace_team_id, user.id).first<{ role: string }>();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not a member of this workspace', 403);
  }

  // Check if user has permission to execute (not viewer)
  if (member.role === 'viewer') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Viewers cannot create sessions', 403);
  }

  // Generate session ID and branch name
  const sessionId = crypto.randomUUID();
  const branch = parsed.data.branch || generateBranchName(task.title, sessionId);

  // Create the session
  await c.env.DB.prepare(`
    INSERT INTO workspace_sessions (id, task_id, workspace_id, executor, execution_mode, branch, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
  `).bind(sessionId, task_id, task.workspace_team_id, executor, execution_mode, branch).run();

  // Get the created session
  const session = await c.env.DB.prepare(
    'SELECT * FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first();

  // Store initial status in KV for fast access
  await c.env.CACHE.put(`session:${sessionId}:status`, JSON.stringify({
    status: 'pending',
    updated_at: new Date().toISOString(),
  }), { expirationTtl: 86400 }); // 24 hours

  // Log audit event
  await c.env.DB.prepare(`
    INSERT INTO audit_logs (id, workspace_id, user_id, action, resource_type, resource_id, details, created_at)
    VALUES (?, ?, ?, 'session.created', 'workspace_session', ?, ?, datetime('now'))
  `).bind(
    crypto.randomUUID(),
    task.workspace_team_id,
    user.id,
    sessionId,
    JSON.stringify({ executor, branch, task_id })
  ).run();

  return c.json({ session, branch, message: 'Session created successfully' }, 201);
});

// GET /api/v1/sessions/:id - Get session details
sessionsRoutes.get('/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');

  const session = await c.env.DB.prepare(`
    SELECT ws.*, t.title as task_title, t.description as task_description
    FROM workspace_sessions ws
    JOIN tasks t ON ws.task_id = t.id
    WHERE ws.id = ?
  `).bind(sessionId).first();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to view this session', 403);
  }

  // Get execution processes for this session
  const { results: processes } = await c.env.DB.prepare(
    'SELECT * FROM execution_processes WHERE session_id = ? ORDER BY created_at DESC'
  ).bind(sessionId).all();

  // Get real-time status from KV if available
  const cachedStatus = await c.env.CACHE.get(`session:${sessionId}:status`, 'json');

  return c.json({
    session: {
      ...session,
      real_time_status: cachedStatus,
    },
    processes,
  });
});

// GET /api/v1/sessions - List sessions (with filters)
sessionsRoutes.get('/', async (c) => {
  const user = c.get('user')!;
  const taskId = c.req.query('task_id');
  const workspaceId = c.req.query('workspace_id');
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  // Build query based on filters
  let query = `
    SELECT ws.*, t.title as task_title
    FROM workspace_sessions ws
    JOIN tasks t ON ws.task_id = t.id
    JOIN workspace_members wm ON ws.workspace_id = wm.workspace_team_id
    WHERE wm.user_id = ?
  `;
  const params: (string | number)[] = [user.id];

  if (taskId) {
    query += ' AND ws.task_id = ?';
    params.push(taskId);
  }

  if (workspaceId) {
    query += ' AND ws.workspace_id = ?';
    params.push(workspaceId);
  }

  if (status) {
    query += ' AND ws.status = ?';
    params.push(status);
  }

  query += ' ORDER BY ws.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = c.env.DB.prepare(query);
  const { results: sessions } = await stmt.bind(...params).all();

  // Get count
  let countQuery = `
    SELECT COUNT(*) as count
    FROM workspace_sessions ws
    JOIN workspace_members wm ON ws.workspace_id = wm.workspace_team_id
    WHERE wm.user_id = ?
  `;
  const countParams: string[] = [user.id];

  if (taskId) {
    countQuery += ' AND ws.task_id = ?';
    countParams.push(taskId);
  }
  if (workspaceId) {
    countQuery += ' AND ws.workspace_id = ?';
    countParams.push(workspaceId);
  }
  if (status) {
    countQuery += ' AND ws.status = ?';
    countParams.push(status);
  }

  const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ count: number }>();

  return c.json({
    sessions,
    pagination: {
      total: countResult?.count || 0,
      limit,
      offset,
    },
  });
});

// PATCH /api/v1/sessions/:id - Update session status
sessionsRoutes.patch('/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', 400, { errors: parsed.error.errors });
  }

  // Get session and verify access
  const session = await c.env.DB.prepare(
    'SELECT * FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; status: string }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  // Verify workspace access with write permission
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first<{ role: string }>();

  if (!member || member.role === 'viewer') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to update this session', 403);
  }

  // Build update query
  const updates: string[] = ['updated_at = datetime(\'now\')'];
  const values: (string | null)[] = [];

  if (parsed.data.status) {
    updates.push('status = ?');
    values.push(parsed.data.status);

    // Set timestamps based on status
    if (parsed.data.status === 'running' && session.status === 'pending') {
      updates.push('started_at = datetime(\'now\')');
    } else if (['completed', 'failed', 'cancelled'].includes(parsed.data.status)) {
      updates.push('completed_at = datetime(\'now\')');
    }
  }

  if (parsed.data.error_message !== undefined) {
    updates.push('error_message = ?');
    values.push(parsed.data.error_message);
  }

  values.push(sessionId);

  await c.env.DB.prepare(`
    UPDATE workspace_sessions SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();

  // Update KV cache
  await c.env.CACHE.put(`session:${sessionId}:status`, JSON.stringify({
    status: parsed.data.status || session.status,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: 86400 });

  // Get updated session
  const updatedSession = await c.env.DB.prepare(
    'SELECT * FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first();

  return c.json({ session: updatedSession });
});

// DELETE /api/v1/sessions/:id - Delete/cancel a session
sessionsRoutes.delete('/:id', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');

  // Get session and verify access
  const session = await c.env.DB.prepare(
    'SELECT * FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; status: string }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  // Verify workspace access with admin permission
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first<{ role: string }>();

  if (!member || !['owner', 'admin'].includes(member.role)) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Only admins can delete sessions', 403);
  }

  // If session is running, cancel it first
  if (session.status === 'running') {
    await c.env.DB.prepare(`
      UPDATE workspace_sessions 
      SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(sessionId).run();
  } else {
    // Delete the session
    await c.env.DB.prepare('DELETE FROM workspace_sessions WHERE id = ?').bind(sessionId).run();
  }

  // Clear KV cache
  await c.env.CACHE.delete(`session:${sessionId}:status`);

  // Log audit event
  await c.env.DB.prepare(`
    INSERT INTO audit_logs (id, workspace_id, user_id, action, resource_type, resource_id, created_at)
    VALUES (?, ?, ?, 'session.deleted', 'workspace_session', ?, datetime('now'))
  `).bind(crypto.randomUUID(), session.workspace_id, user.id, sessionId).run();

  return c.json({ deleted: true });
});

// POST /api/v1/sessions/:id/start - Start execution
sessionsRoutes.post('/:id/start', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');

  // Get session
  const session = await c.env.DB.prepare(`
    SELECT ws.*, t.title, t.description
    FROM workspace_sessions ws
    JOIN tasks t ON ws.task_id = t.id
    WHERE ws.id = ?
  `).bind(sessionId).first<{
    id: string;
    workspace_id: string;
    status: string;
    executor: string;
    title: string;
    description: string;
  }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  if (session.status !== 'pending') {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Session is not in pending state', 400);
  }

  // Verify access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first<{ role: string }>();

  if (!member || member.role === 'viewer') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to start this session', 403);
  }

  // Create execution process record
  const processId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO execution_processes (id, session_id, run_reason, status, started_at, created_at, updated_at)
    VALUES (?, ?, 'codingagent', 'running', datetime('now'), datetime('now'), datetime('now'))
  `).bind(processId, sessionId).run();

  // Update session status
  await c.env.DB.prepare(`
    UPDATE workspace_sessions 
    SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(sessionId).run();

  // Update KV
  await c.env.CACHE.put(`session:${sessionId}:status`, JSON.stringify({
    status: 'running',
    process_id: processId,
    updated_at: new Date().toISOString(),
  }), { expirationTtl: 86400 });

  return c.json({
    session_id: sessionId,
    process_id: processId,
    status: 'running',
    stream_url: `/api/v1/sessions/${sessionId}/stream`,
  });
});

// POST /api/v1/sessions/:id/stop - Stop execution
sessionsRoutes.post('/:id/stop', async (c) => {
  const user = c.get('user')!;
  const sessionId = c.req.param('id');

  // Get session
  const session = await c.env.DB.prepare(
    'SELECT * FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first<{ workspace_id: string; status: string }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  if (session.status !== 'running') {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Session is not running', 400);
  }

  // Verify access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_id, user.id).first<{ role: string }>();

  if (!member || member.role === 'viewer') {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized to stop this session', 403);
  }

  // Update running processes
  await c.env.DB.prepare(`
    UPDATE execution_processes 
    SET status = 'killed', completed_at = datetime('now'), updated_at = datetime('now')
    WHERE session_id = ? AND status = 'running'
  `).bind(sessionId).run();

  // Update session
  await c.env.DB.prepare(`
    UPDATE workspace_sessions 
    SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(sessionId).run();

  // Update KV
  await c.env.CACHE.put(`session:${sessionId}:status`, JSON.stringify({
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  }), { expirationTtl: 86400 });

  return c.json({ stopped: true, status: 'cancelled' });
});

// GET /api/v1/sessions/:id/status - Get real-time status
sessionsRoutes.get('/:id/status', async (c) => {
  const sessionId = c.req.param('id');

  // Try KV first for fastest response
  const cachedStatus = await c.env.CACHE.get(`session:${sessionId}:status`, 'json');
  
  if (cachedStatus) {
    return c.json(cachedStatus);
  }

  // Fallback to database
  const session = await c.env.DB.prepare(
    'SELECT status, started_at, completed_at, error_message FROM workspace_sessions WHERE id = ?'
  ).bind(sessionId).first();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  return c.json(session);
});

export default sessionsRoutes;
