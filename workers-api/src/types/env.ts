import type { D1Database, R2Bucket, KVNamespace, Ai } from '@cloudflare/workers-types';

/**
 * Environment bindings for Cloudflare Workers
 */
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // R2 Storage bucket
  STORAGE: R2Bucket;
  
  // KV Namespace for sessions
  SESSIONS: KVNamespace;
  
  // AI Gateway for LLM integration
  AI: Ai;
  
  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  APP_NAME: string;
  CORS_ORIGIN: string;
  
  // Secrets (set via wrangler secret put)
  JWT_SECRET?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

/**
 * Variables passed through Hono context
 */
export interface Variables {
  // Current authenticated user (set by auth middleware)
  user?: {
    id: string;
    email: string;
    name: string;
  };
  
  // Current workspace context
  workspaceId?: string;
  
  // Request ID for tracing
  requestId: string;
}
