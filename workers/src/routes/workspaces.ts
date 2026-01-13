import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Env, Variables } from '../types/env';
import { requireAuth, workspaceContext } from '../middleware/auth';
import { requirePermission, requireOwner, requireMembership, Permissions } from '../middleware/permissions';
import { createWorkspaceSchema, updateWorkspaceSchema } from '../schemas';
import { ApiError, ErrorCodes } from '../middleware/error-handler';

export const workspacesRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All workspace routes require authentication
workspacesRoutes.use('*', requireAuth());

// GET /api/v1/workspaces - List user's workspaces
workspacesRoutes.get('/', async (c) => {
  const user = c.get('user')!;

  const workspaces = await c.env.DB.prepare(`
    SELECT 
      wt.id, wt.name, wt.slug, wt.created_at, wt.updated_at,
      r.name as user_role,
      u.name as created_by_name
    FROM workspace_members wm
    JOIN workspaces_team wt ON wm.workspace_team_id = wt.id
    JOIN roles r ON wm.role_id = r.id
    JOIN users u ON wt.created_by = u.id
    WHERE wm.user_id = ? AND wm.status = 'active'
    ORDER BY wt.name ASC
  `).bind(user.id).all();

  return c.json({
    workspaces: workspaces.results,
    count: workspaces.results?.length || 0,
  });
});

// POST /api/v1/workspaces - Create new workspace
workspacesRoutes.post('/', zValidator('json', createWorkspaceSchema), async (c) => {
  const user = c.get('user')!;
  const { name, slug } = c.req.valid('json');

  // Check if slug is unique
  const existingSlug = await c.env.DB.prepare(
    'SELECT id FROM workspaces_team WHERE slug = ?'
  ).bind(slug).first();

  if (existingSlug) {
    throw new ApiError(
      ErrorCodes.CONFLICT,
      'A workspace with this slug already exists',
      409,
      { field: 'slug' }
    );
  }

  const workspaceId = crypto.randomUUID();

  // Create workspace and add creator as Owner in a batch
  const batch = [
    c.env.DB.prepare(`
      INSERT INTO workspaces_team (id, name, slug, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(workspaceId, name, slug, user.id),
    c.env.DB.prepare(`
      INSERT INTO workspace_members (workspace_team_id, user_id, role_id, status, joined_at)
      VALUES (?, ?, 'role-owner', 'active', datetime('now'))
    `).bind(workspaceId, user.id),
  ];

  await c.env.DB.batch(batch);

  return c.json({
    workspace: {
      id: workspaceId,
      name,
      slug,
      createdBy: user.id,
      userRole: 'Owner',
    },
  }, 201);
});

// GET /api/v1/workspaces/:id - Get workspace by ID
workspacesRoutes.get('/:id', workspaceContext(), requireMembership(), async (c) => {
  const workspaceId = c.req.param('id');
  const user = c.get('user')!;

  const workspace = await c.env.DB.prepare(`
    SELECT 
      wt.id, wt.name, wt.slug, wt.created_at, wt.updated_at,
      wt.created_by,
      u.name as created_by_name,
      r.name as user_role
    FROM workspaces_team wt
    JOIN users u ON wt.created_by = u.id
    JOIN workspace_members wm ON wm.workspace_team_id = wt.id AND wm.user_id = ?
    JOIN roles r ON wm.role_id = r.id
    WHERE wt.id = ?
  `).bind(user.id, workspaceId).first();

  if (!workspace) {
    throw new ApiError(
      ErrorCodes.NOT_FOUND,
      'Workspace not found',
      404
    );
  }

  // Get member count
  const memberCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM workspace_members 
    WHERE workspace_team_id = ? AND status = 'active'
  `).bind(workspaceId).first<{ count: number }>();

  // Get project count
  const projectCount = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM projects 
    WHERE workspace_team_id = ? AND status = 'active'
  `).bind(workspaceId).first<{ count: number }>();

  return c.json({
    workspace: {
      ...workspace,
      memberCount: memberCount?.count || 0,
      projectCount: projectCount?.count || 0,
    },
  });
});

// PATCH /api/v1/workspaces/:id - Update workspace
workspacesRoutes.patch('/:id',
  workspaceContext(),
  requirePermission(Permissions.WORKSPACE_SETTINGS),
  zValidator('json', updateWorkspaceSchema),
  async (c) => {
    const workspaceId = c.req.param('id');
    const updates = c.req.valid('json');

    if (Object.keys(updates).length === 0) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'No fields to update',
        400
      );
    }

    // Check slug uniqueness if updating
    if (updates.slug) {
      const existingSlug = await c.env.DB.prepare(
        'SELECT id FROM workspaces_team WHERE slug = ? AND id != ?'
      ).bind(updates.slug, workspaceId).first();

      if (existingSlug) {
        throw new ApiError(
          ErrorCodes.CONFLICT,
          'A workspace with this slug already exists',
          409,
          { field: 'slug' }
        );
      }
    }

    // Build dynamic update
    const setClauses: string[] = ["updated_at = datetime('now')"];
    const values: unknown[] = [];

    if (updates.name) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.slug) {
      setClauses.push('slug = ?');
      values.push(updates.slug);
    }

    values.push(workspaceId);

    await c.env.DB.prepare(`
      UPDATE workspaces_team SET ${setClauses.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Fetch updated workspace
    const workspace = await c.env.DB.prepare(
      'SELECT id, name, slug, created_at, updated_at FROM workspaces_team WHERE id = ?'
    ).bind(workspaceId).first();

    return c.json({ workspace });
  }
);

// DELETE /api/v1/workspaces/:id - Delete workspace
workspacesRoutes.delete('/:id',
  workspaceContext(),
  requireOwner(),
  async (c) => {
    const workspaceId = c.req.param('id');

    // Delete workspace (cascades to members, projects, tasks via FK)
    await c.env.DB.prepare(
      'DELETE FROM workspaces_team WHERE id = ?'
    ).bind(workspaceId).run();

    return c.json({ message: 'Workspace deleted successfully' });
  }
);

// === Member Management ===

// GET /api/v1/workspaces/:id/members - List workspace members
workspacesRoutes.get('/:id/members', workspaceContext(), requireMembership(), async (c) => {
  const workspaceId = c.req.param('id');

  const members = await c.env.DB.prepare(`
    SELECT 
      u.id, u.email, u.name, u.avatar_url,
      r.name as role,
      wm.status,
      wm.joined_at
    FROM workspace_members wm
    JOIN users u ON wm.user_id = u.id
    JOIN roles r ON wm.role_id = r.id
    WHERE wm.workspace_team_id = ?
    ORDER BY 
      CASE r.name 
        WHEN 'Owner' THEN 1 
        WHEN 'Admin' THEN 2 
        WHEN 'Member' THEN 3 
        WHEN 'Viewer' THEN 4 
      END,
      u.name ASC
  `).bind(workspaceId).all();

  return c.json({
    members: members.results,
    count: members.results?.length || 0,
  });
});

// POST /api/v1/workspaces/:id/members/invite - Invite member
workspacesRoutes.post('/:id/members/invite',
  workspaceContext(),
  requirePermission(Permissions.MEMBER_INVITE),
  async (c) => {
    const workspaceId = c.req.param('id');
    const body = await c.req.json<{ email: string; role?: string }>();
    const user = c.get('user')!;

    if (!body.email) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Email is required', 400);
    }

    const email = body.email.toLowerCase();
    const roleName = body.role || 'Member';

    // Validate role
    if (!['Admin', 'Member', 'Viewer'].includes(roleName)) {
      throw new ApiError(
        ErrorCodes.RBAC_002,
        'Invalid role. Must be Admin, Member, or Viewer',
        400
      );
    }

    // Check if user exists
    const invitedUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first<{ id: string }>();

    if (invitedUser) {
      // Check if already a member
      const existingMember = await c.env.DB.prepare(
        'SELECT 1 FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
      ).bind(workspaceId, invitedUser.id).first();

      if (existingMember) {
        throw new ApiError(
          ErrorCodes.CONFLICT,
          'User is already a member of this workspace',
          409
        );
      }

      // Add directly as member
      const roleId = `role-${roleName.toLowerCase()}`;
      await c.env.DB.prepare(`
        INSERT INTO workspace_members (workspace_team_id, user_id, role_id, status, joined_at)
        VALUES (?, ?, ?, 'active', datetime('now'))
      `).bind(workspaceId, invitedUser.id, roleId).run();

      return c.json({
        message: 'Member added successfully',
        member: { userId: invitedUser.id, role: roleName },
      }, 201);
    }

    // Create invitation for non-existing user
    const invitationId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const roleId = `role-${roleName.toLowerCase()}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await c.env.DB.prepare(`
      INSERT INTO workspace_invitations (id, workspace_team_id, email, role_id, invited_by, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(invitationId, workspaceId, email, roleId, user.id, token, expiresAt).run();

    return c.json({
      message: 'Invitation sent',
      invitation: { id: invitationId, email, role: roleName, expiresAt },
    }, 201);
  }
);

// DELETE /api/v1/workspaces/:id/members/:userId - Remove member
workspacesRoutes.delete('/:id/members/:userId',
  workspaceContext(),
  requirePermission(Permissions.MEMBER_REMOVE),
  async (c) => {
    const workspaceId = c.req.param('id');
    const targetUserId = c.req.param('userId');

    // Check if target is Owner
    const targetMember = await c.env.DB.prepare(`
      SELECT r.name as role FROM workspace_members wm
      JOIN roles r ON wm.role_id = r.id
      WHERE wm.workspace_team_id = ? AND wm.user_id = ?
    `).bind(workspaceId, targetUserId).first<{ role: string }>();

    if (!targetMember) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Member not found', 404);
    }

    if (targetMember.role === 'Owner') {
      throw new ApiError(
        ErrorCodes.RBAC_003,
        'Cannot remove workspace owner',
        403
      );
    }

    await c.env.DB.prepare(
      'DELETE FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
    ).bind(workspaceId, targetUserId).run();

    return c.json({ message: 'Member removed successfully' });
  }
);

// PATCH /api/v1/workspaces/:id/members/:userId/role - Change member role
workspacesRoutes.patch('/:id/members/:userId/role',
  workspaceContext(),
  requirePermission(Permissions.MEMBER_ROLE_CHANGE),
  async (c) => {
    const workspaceId = c.req.param('id');
    const targetUserId = c.req.param('userId');
    const body = await c.req.json<{ role: string }>();

    if (!body.role || !['Admin', 'Member', 'Viewer'].includes(body.role)) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        'Invalid role. Must be Admin, Member, or Viewer',
        400
      );
    }

    // Check if target is Owner
    const targetMember = await c.env.DB.prepare(`
      SELECT r.name as role FROM workspace_members wm
      JOIN roles r ON wm.role_id = r.id
      WHERE wm.workspace_team_id = ? AND wm.user_id = ?
    `).bind(workspaceId, targetUserId).first<{ role: string }>();

    if (!targetMember) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Member not found', 404);
    }

    if (targetMember.role === 'Owner') {
      throw new ApiError(
        ErrorCodes.RBAC_003,
        'Cannot change owner role',
        403
      );
    }

    const roleId = `role-${body.role.toLowerCase()}`;
    await c.env.DB.prepare(
      'UPDATE workspace_members SET role_id = ? WHERE workspace_team_id = ? AND user_id = ?'
    ).bind(roleId, workspaceId, targetUserId).run();

    return c.json({ message: 'Role updated successfully', role: body.role });
  }
);

// === Prompt Settings ===

// GET /api/v1/workspaces/:id/prompt-settings - Get prompt enhancement settings
workspacesRoutes.get('/:id/prompt-settings', workspaceContext(), requireMembership(), async (c) => {
  const workspaceId = c.req.param('id');

  const settings = await c.env.DB.prepare(
    'SELECT * FROM prompt_enhancement_settings WHERE workspace_team_id = ?'
  ).bind(workspaceId).first();

  // Return defaults if not set
  return c.json({
    settings: settings || {
      workspace_team_id: workspaceId,
      auto_enhance_enabled: false,
      preferred_model: 'gpt-4-turbo',
      enhancement_style: 'balanced',
      include_codebase_context: true,
      include_git_history: false,
      custom_instructions: null,
    },
  });
});

// PATCH /api/v1/workspaces/:id/prompt-settings - Update prompt settings
workspacesRoutes.patch('/:id/prompt-settings',
  workspaceContext(),
  requirePermission(Permissions.PROMPT_SETTINGS_EDIT),
  async (c) => {
    const workspaceId = c.req.param('id');
    const body = await c.req.json();

    // Upsert settings
    await c.env.DB.prepare(`
      INSERT INTO prompt_enhancement_settings (
        workspace_team_id, auto_enhance_enabled, preferred_model, 
        enhancement_style, include_codebase_context, include_git_history,
        custom_instructions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(workspace_team_id) DO UPDATE SET
        auto_enhance_enabled = COALESCE(?, auto_enhance_enabled),
        preferred_model = COALESCE(?, preferred_model),
        enhancement_style = COALESCE(?, enhancement_style),
        include_codebase_context = COALESCE(?, include_codebase_context),
        include_git_history = COALESCE(?, include_git_history),
        custom_instructions = COALESCE(?, custom_instructions),
        updated_at = datetime('now')
    `).bind(
      workspaceId,
      body.auto_enhance_enabled ?? false,
      body.preferred_model ?? 'gpt-4-turbo',
      body.enhancement_style ?? 'balanced',
      body.include_codebase_context ?? true,
      body.include_git_history ?? false,
      body.custom_instructions ?? null,
      body.auto_enhance_enabled,
      body.preferred_model,
      body.enhancement_style,
      body.include_codebase_context,
      body.include_git_history,
      body.custom_instructions
    ).run();

    const settings = await c.env.DB.prepare(
      'SELECT * FROM prompt_enhancement_settings WHERE workspace_team_id = ?'
    ).bind(workspaceId).first();

    return c.json({ settings });
  }
);
