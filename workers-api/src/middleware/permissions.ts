import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types/env';
import { ApiError, ErrorCodes } from './error-handler';

/**
 * Permission keys matching the backend specs
 */
export const Permissions = {
  // Workspace permissions
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_SETTINGS: 'workspace.settings',
  
  // Member permissions
  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',
  MEMBER_ROLE_CHANGE: 'member.role.change',
  
  // Project permissions
  PROJECT_CREATE: 'project.create',
  PROJECT_DELETE: 'project.delete',
  
  // Task permissions
  TASK_CREATE: 'task.create',
  TASK_ASSIGN: 'task.assign',
  TASK_EDIT: 'task.edit',
  TASK_DELETE: 'task.delete',
  TASK_VIEW_PRIVATE: 'task.view.private',
  
  // Execution permissions
  ATTEMPT_RUN: 'attempt.run',
  ATTEMPT_APPROVE: 'attempt.approve',
  
  // Prompt permissions
  PROMPT_ENHANCE: 'prompt.enhance',
  PROMPT_TEMPLATE_CREATE: 'prompt.template.create',
  PROMPT_SETTINGS_EDIT: 'prompt.settings.edit',
} as const;

export type PermissionKey = typeof Permissions[keyof typeof Permissions];

/**
 * Role definitions with their permissions
 */
export const RolePermissions: Record<string, PermissionKey[]> = {
  Owner: Object.values(Permissions),
  Admin: Object.values(Permissions).filter(p => p !== Permissions.WORKSPACE_DELETE),
  Member: [
    Permissions.PROJECT_CREATE,
    Permissions.TASK_CREATE,
    Permissions.TASK_EDIT,
    Permissions.TASK_ASSIGN,
    Permissions.ATTEMPT_RUN,
    Permissions.ATTEMPT_APPROVE,
    Permissions.PROMPT_ENHANCE,
  ],
  Viewer: [],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: string, permission: PermissionKey): boolean {
  const permissions = RolePermissions[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Permission middleware factory
 * Creates middleware that checks for a specific permission
 */
export function requirePermission(permission: PermissionKey): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');
    const workspaceId = c.get('workspaceId');
    
    if (!user) {
      throw new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }
    
    if (!workspaceId) {
      throw new ApiError(
        ErrorCodes.INVALID_INPUT,
        'Workspace context required',
        400
      );
    }
    
    // Get user's role in the workspace
    const memberResult = await c.env.DB.prepare(`
      SELECT r.name as role_name
      FROM workspace_members wm
      JOIN roles r ON wm.role_id = r.id
      WHERE wm.workspace_team_id = ? AND wm.user_id = ? AND wm.status = 'active'
    `).bind(workspaceId, user.id).first<{ role_name: string }>();
    
    if (!memberResult) {
      throw new ApiError(
        ErrorCodes.FORBIDDEN,
        'You are not a member of this workspace',
        403
      );
    }
    
    // Check if role has permission
    if (!roleHasPermission(memberResult.role_name, permission)) {
      throw new ApiError(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        `You don't have permission to perform this action (requires: ${permission})`,
        403
      );
    }
    
    await next();
  };
}

/**
 * Check if user is workspace owner
 */
export function requireOwner(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');
    const workspaceId = c.get('workspaceId');
    
    if (!user) {
      throw new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }
    
    if (!workspaceId) {
      throw new ApiError(
        ErrorCodes.INVALID_INPUT,
        'Workspace context required',
        400
      );
    }
    
    // Check if user is owner
    const memberResult = await c.env.DB.prepare(`
      SELECT r.name as role_name
      FROM workspace_members wm
      JOIN roles r ON wm.role_id = r.id
      WHERE wm.workspace_team_id = ? AND wm.user_id = ? AND r.name = 'Owner'
    `).bind(workspaceId, user.id).first();
    
    if (!memberResult) {
      throw new ApiError(
        ErrorCodes.FORBIDDEN,
        'Only the workspace owner can perform this action',
        403
      );
    }
    
    await next();
  };
}
