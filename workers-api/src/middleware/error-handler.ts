import type { ErrorHandler } from 'hono';
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
 * Common error codes
 */
export const ErrorCodes = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Resource errors (404)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Rate limiting (429)
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors (500)
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
    }, err.statusCode);
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
