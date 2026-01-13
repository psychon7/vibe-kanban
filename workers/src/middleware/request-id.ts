import type { MiddlewareHandler } from 'hono';
import type { Env, Variables } from '../types/env';

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${randomPart}`;
}

/**
 * Request ID middleware
 * Generates a unique ID for each request for tracing and debugging
 */
export function requestId(): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    // Use provided request ID or generate a new one
    const id = c.req.header('X-Request-Id') || generateRequestId();

    // Set in context for use in handlers
    c.set('requestId', id);

    // Add to response headers
    c.header('X-Request-Id', id);

    await next();
  };
}
