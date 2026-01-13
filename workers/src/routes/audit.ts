import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requireMembership } from '../middleware/permissions';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const auditRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All audit routes require authentication and workspace membership
auditRoutes.use('*', requireAuth());
auditRoutes.use('*', workspaceContext());
auditRoutes.use('*', requireMembership());

const auditFiltersSchema = z.object({
  entity_type: z.string().optional(),
  action: z.string().optional(),
  actor_id: z.string().uuid().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/v1/audit - List audit logs with filtering
auditRoutes.get('/', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  
  const filters = auditFiltersSchema.parse({
    entity_type: c.req.query('entity_type'),
    action: c.req.query('action'),
    actor_id: c.req.query('actor_id'),
    from_date: c.req.query('from_date'),
    to_date: c.req.query('to_date'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  });

  const offset = (filters.page - 1) * filters.limit;

  let whereClause = 'al.workspace_team_id = ?';
  const params: unknown[] = [workspaceId];

  if (filters.entity_type) {
    whereClause += ' AND al.entity_type = ?';
    params.push(filters.entity_type);
  }
  if (filters.action) {
    whereClause += ' AND al.action = ?';
    params.push(filters.action);
  }
  if (filters.actor_id) {
    whereClause += ' AND al.actor_user_id = ?';
    params.push(filters.actor_id);
  }
  if (filters.from_date) {
    whereClause += ' AND al.created_at >= ?';
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    whereClause += ' AND al.created_at <= ?';
    params.push(filters.to_date);
  }

  params.push(filters.limit, offset);

  const logs = await c.env.DB.prepare(`
    SELECT 
      al.id, al.entity_type, al.entity_id, al.action, al.created_at,
      al.actor_user_id,
      u.name as actor_name,
      u.email as actor_email
    FROM audit_log al
    JOIN users u ON al.actor_user_id = u.id
    WHERE ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params).all();

  // Get total count
  const countParams = params.slice(0, -2);
  const countResult = await c.env.DB.prepare(`
    SELECT COUNT(*) as total FROM audit_log al WHERE ${whereClause}
  `).bind(...countParams).first<{ total: number }>();

  return c.json({
    logs: logs.results,
    count: logs.results?.length || 0,
    total: countResult?.total || 0,
    page: filters.page,
    limit: filters.limit,
  });
});

// GET /api/v1/audit/:auditId - Get specific audit log entry
auditRoutes.get('/:auditId', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const auditId = c.req.param('auditId');

  const log = await c.env.DB.prepare(`
    SELECT 
      al.id, al.entity_type, al.entity_id, al.action, al.payload_json, al.created_at,
      al.actor_user_id,
      u.name as actor_name,
      u.email as actor_email
    FROM audit_log al
    JOIN users u ON al.actor_user_id = u.id
    WHERE al.id = ? AND al.workspace_team_id = ?
  `).bind(auditId, workspaceId).first();

  if (!log) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Audit log entry not found', 404);
  }

  // Parse payload JSON
  const payload = log.payload_json ? JSON.parse(log.payload_json as string) : null;

  return c.json({
    log: {
      ...log,
      payload,
      payload_json: undefined,
    },
  });
});

// GET /api/v1/audit/entity/:type/:entityId - Get audit logs for specific entity
auditRoutes.get('/entity/:type/:entityId', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const entityType = c.req.param('type');
  const entityId = c.req.param('entityId');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const logs = await c.env.DB.prepare(`
    SELECT 
      al.id, al.entity_type, al.entity_id, al.action, al.payload_json, al.created_at,
      al.actor_user_id,
      u.name as actor_name
    FROM audit_log al
    JOIN users u ON al.actor_user_id = u.id
    WHERE al.workspace_team_id = ? AND al.entity_type = ? AND al.entity_id = ?
    ORDER BY al.created_at DESC
    LIMIT ?
  `).bind(workspaceId, entityType, entityId, limit).all();

  return c.json({
    logs: logs.results?.map(log => ({
      ...log,
      payload: log.payload_json ? JSON.parse(log.payload_json as string) : null,
      payload_json: undefined,
    })),
    count: logs.results?.length || 0,
  });
});

// POST /api/v1/audit/export - Export audit logs to R2
auditRoutes.post('/export', async (c) => {
  const workspaceId = c.get('workspaceId')!;
  const user = c.get('user')!;
  const body = await c.req.json<{ from_date?: string; to_date?: string }>();

  // Get all logs for export
  let whereClause = 'al.workspace_team_id = ?';
  const params: unknown[] = [workspaceId];

  if (body.from_date) {
    whereClause += ' AND al.created_at >= ?';
    params.push(body.from_date);
  }
  if (body.to_date) {
    whereClause += ' AND al.created_at <= ?';
    params.push(body.to_date);
  }

  const logs = await c.env.DB.prepare(`
    SELECT 
      al.id, al.entity_type, al.entity_id, al.action, al.payload_json, al.created_at,
      al.actor_user_id,
      u.name as actor_name,
      u.email as actor_email
    FROM audit_log al
    JOIN users u ON al.actor_user_id = u.id
    WHERE ${whereClause}
    ORDER BY al.created_at DESC
  `).bind(...params).all();

  // Generate CSV content
  const csvLines = ['id,entity_type,entity_id,action,actor_name,actor_email,created_at'];
  logs.results?.forEach(log => {
    csvLines.push([
      log.id,
      log.entity_type,
      log.entity_id,
      log.action,
      `"${log.actor_name}"`,
      log.actor_email,
      log.created_at,
    ].join(','));
  });

  const csvContent = csvLines.join('\n');
  const fileName = `audit-export-${workspaceId}-${Date.now()}.csv`;

  // Upload to R2
  await c.env.STORAGE.put(`exports/${fileName}`, csvContent, {
    httpMetadata: {
      contentType: 'text/csv',
    },
    customMetadata: {
      workspaceId,
      exportedBy: user.id,
      recordCount: String(logs.results?.length || 0),
    },
  });

  return c.json({
    message: 'Export created successfully',
    fileName,
    recordCount: logs.results?.length || 0,
  });
});

// Helper function to create audit log entries (export for use in other routes)
export async function createAuditLog(
  db: D1Database,
  workspaceId: string,
  actorUserId: string,
  entityType: string,
  entityId: string,
  action: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO audit_log (id, workspace_team_id, actor_user_id, entity_type, entity_id, action, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id,
    workspaceId,
    actorUserId,
    entityType,
    entityId,
    action,
    payload ? JSON.stringify(payload) : null
  ).run();
}

// D1Database type for the helper
type D1Database = Env['DB'];
