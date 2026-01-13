import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env, Variables } from '../types/env';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';

/**
 * API Error class for consistent error responses
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Common error codes matching backend-specs.md
 */
export const ErrorCodes = {
  // Authentication errors (401)
  AUTH_001: 'AUTH_001', // Invalid credentials
  AUTH_002: 'AUTH_002', // Session expired
  AUTH_003: 'AUTH_003', // Missing authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Authorization errors (403)
  AUTH_004: 'AUTH_004', // Insufficient permissions
  AUTH_005: 'AUTH_005', // Account suspended
  RBAC_001: 'RBAC_001', // Not a workspace member
  RBAC_002: 'RBAC_002', // Role not assignable
  RBAC_003: 'RBAC_003', // Cannot modify owner role
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Validation errors (400)
  VAL_001: 'VAL_001', // Validation error
  VAL_002: 'VAL_002', // Invalid UUID format
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors (404)
  TASK_001: 'TASK_001', // Task not found
  TASK_002: 'TASK_002', // Task not visible
  TASK_003: 'TASK_003', // Invalid task status transition
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Rate limiting (429)
  PROMPT_003: 'PROMPT_003', // Enhancement rate limited
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (500)
  PROMPT_001: 'PROMPT_001', // Enhancement failed
  PROMPT_002: 'PROMPT_002', // Invalid template
  SYS_001: 'SYS_001', // Internal server error
  SYS_002: 'SYS_002', // Service unavailable
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
} as const;

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorHandler<{ Bindings: Env; Variables: Variables }> = (err, c) => {
  const requestId = c.get('requestId') || 'unknown';

  // Log error for debugging
  console.error(`[${requestId}] Error:`, err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return c.json({
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: {
          issues: err.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      requestId,
    }, 400);
  }

  // Handle API errors
  if (err instanceof ApiError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    }, err.statusCode as ContentfulStatusCode);
  }

  // Handle Hono HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      error: {
        code: err.status === 401 ? ErrorCodes.UNAUTHORIZED :
              err.status === 403 ? ErrorCodes.FORBIDDEN :
              err.status === 404 ? ErrorCodes.NOT_FOUND :
              ErrorCodes.INTERNAL_ERROR,
        message: err.message,
      },
      requestId,
    }, err.status);
  }

  // Handle unknown errors
  const isProduction = c.env.ENVIRONMENT === 'production';

  return c.json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
    requestId,
  }, 500);
};
