import type { D1Database, R2Bucket, KVNamespace, Ai } from '@cloudflare/workers-types';

/**
 * Environment bindings for Cloudflare Workers
 * See wrangler.toml for configuration
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Storage bucket (for avatars, exports, attachments)
  STORAGE: R2Bucket;

  // KV Namespace for caching and rate limiting
  CACHE: KVNamespace;

  // AI Gateway for LLM integration
  AI: Ai;

  // Durable Objects
  LOCAL_AGENT_RELAY: DurableObjectNamespace;

  // Environment variables
  ENVIRONMENT: 'development' | 'staging' | 'production';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  CORS_ORIGIN?: string;

  // Secrets (set via wrangler secret put)
  JWT_SECRET?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
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
