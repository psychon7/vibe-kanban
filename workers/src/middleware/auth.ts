import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types/env';
import { ApiError, ErrorCodes } from './error-handler';

/**
 * Authentication middleware
 * Validates session token and populates user context
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(
        ErrorCodes.AUTH_003,
        'Authentication required',
        401
      );
    }

    const token = authHeader.substring(7);

    try {
      // Session lookup in KV cache
      const sessionData = await c.env.CACHE.get(`session:${token}`, 'json');

      if (!sessionData) {
        throw new ApiError(
          ErrorCodes.INVALID_TOKEN,
          'Invalid or expired session',
          401
        );
      }

      const session = sessionData as {
        userId: string;
        email: string;
        name: string;
        expiresAt: number;
      };

      // Check expiration
      if (Date.now() > session.expiresAt) {
        await c.env.CACHE.delete(`session:${token}`);
        throw new ApiError(
          ErrorCodes.AUTH_002,
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
        ErrorCodes.AUTH_003,
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
        const sessionData = await c.env.CACHE.get(`session:${token}`, 'json');

        if (sessionData) {
          const session = sessionData as {
            userId: string;
            email: string;
            name: string;
            expiresAt: number;
          };

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
    const workspaceId = c.req.header('X-Workspace-Id') || c.req.param('workspaceId') || c.req.param('id');

    if (workspaceId) {
      c.set('workspaceId', workspaceId);
    }

    await next();
  };
}
