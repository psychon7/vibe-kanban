import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types/env';
import { ApiError, ErrorCodes } from './error-handler';

/**
 * Authentication middleware
 * Validates JWT token and populates user context
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'Authentication required',
        401
      );
    }
    
    const token = authHeader.substring(7);
    
    try {
      // For now, we'll implement a simple session lookup
      // In production, this would validate a JWT or lookup in KV
      const sessionData = await c.env.SESSIONS.get(`session:${token}`, 'json');
      
      if (!sessionData) {
        throw new ApiError(
          ErrorCodes.INVALID_TOKEN,
          'Invalid or expired session',
          401
        );
      }
      
      const session = sessionData as { userId: string; email: string; name: string; expiresAt: number };
      
      // Check expiration
      if (Date.now() > session.expiresAt) {
        await c.env.SESSIONS.delete(`session:${token}`);
        throw new ApiError(
          ErrorCodes.TOKEN_EXPIRED,
          'Session has expired',
          401
        );
      }
      
      // Set user in context
      c.set('user', {
        id: session.userId,
        email: session.email,
        name: session.name,
      });
      
      await next();
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(
        ErrorCodes.UNAUTHORIZED,
        'Authentication failed',
        401
      );
    }
  };
}

/**
 * Optional authentication middleware
 * Populates user context if token is present, but doesn't require it
 */
export function optionalAuth(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const sessionData = await c.env.SESSIONS.get(`session:${token}`, 'json');
        
        if (sessionData) {
          const session = sessionData as { userId: string; email: string; name: string; expiresAt: number };
          
          if (Date.now() <= session.expiresAt) {
            c.set('user', {
              id: session.userId,
              email: session.email,
              name: session.name,
            });
          }
        }
      } catch {
        // Ignore authentication errors for optional auth
      }
    }
    
    await next();
  };
}

/**
 * Workspace context middleware
 * Extracts workspace ID from header or route params
 */
export function workspaceContext(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    // Try header first, then route param
    const workspaceId = c.req.header('X-Workspace-Id') || c.req.param('workspaceId');
    
    if (workspaceId) {
      c.set('workspaceId', workspaceId);
    }
    
    await next();
  };
}
