/**
 * Cloudflare Workers Environment Bindings
 * See wrangler.toml for configuration
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // R2 Storage
  STORAGE: R2Bucket;

  // KV Namespace for caching and rate limiting
  CACHE: KVNamespace;

  // AI Gateway binding (if configured)
  AI_GATEWAY?: unknown;

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;

  // Secrets (set via wrangler secret put)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CF_ACCESS_CLIENT_ID?: string;
  CF_ACCESS_CLIENT_SECRET?: string;
}

/**
 * Vibe Kanban API Worker
 * Main entry point for Cloudflare Workers
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Database health check
    if (url.pathname === '/health/db') {
      try {
        const result = await env.DB.prepare('SELECT 1 as db_check').first<{ db_check: number }>();
        return new Response(JSON.stringify({ 
          status: 'ok', 
          database: 'connected',
          result: result?.db_check 
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ 
          status: 'error', 
          database: 'disconnected',
          error: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // API routes placeholder
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ 
        message: 'API endpoint not implemented',
        path: url.pathname 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default response
    return new Response(JSON.stringify({
      name: 'vibe-kanban-api',
      version: '0.0.1',
      endpoints: [
        'GET /health - Health check',
        'GET /health/db - Database health check',
        'GET /api/* - API endpoints'
      ]
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
