/**
 * Agent Execution Routes
 * API endpoints for running AI agents on tasks
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { ApiError, ErrorCodes } from '../middleware/error-handler';
import { ClaudeAdapter, ToolExecutor } from '../services/claude-adapter';
import { AGENT_TOOLS, type CloudAgentType } from '../services/agent-types';
import { ExecutionStream, createSSEStream } from '../services/execution-stream';

export const agentsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
agentsRoutes.use('*', requireAuth());

/**
 * POST /agents/execute - Start agent execution for a session
 */
agentsRoutes.post('/execute', async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json() as {
    session_id: string;
    agent_type: CloudAgentType;
    task_description?: string;
    context_files?: string[];
    api_key?: string; // User can provide their own API key
  };

  if (!body.session_id) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'session_id is required', 400);
  }

  // Get session and verify access
  const session = await c.env.DB.prepare(`
    SELECT ws.*, t.title, t.description as task_desc, p.workspace_team_id
    FROM workspace_sessions ws
    JOIN tasks t ON ws.task_id = t.id
    JOIN projects p ON t.project_id = p.id
    WHERE ws.id = ?
  `).bind(body.session_id).first<{ 
    id: string;
    task_id: string;
    workspace_id: string;
    executor: string;
    branch: string;
    status: string;
    title: string;
    task_desc: string;
    workspace_team_id: string;
  }>();

  if (!session) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Session not found', 404);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(session.workspace_team_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized', 403);
  }

  // Get GitHub connection for tool execution
  const githubConn = await c.env.DB.prepare(
    'SELECT access_token_encrypted FROM github_connections WHERE user_id = ?'
  ).bind(user.id).first<{ access_token_encrypted: string }>();

  if (!githubConn) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'GitHub not connected. Please connect GitHub first.', 403);
  }

  // Get connected repository for the workspace
  const repo = await c.env.DB.prepare(
    'SELECT repo_owner, repo_name, default_branch FROM connected_repositories WHERE workspace_id = ? LIMIT 1'
  ).bind(session.workspace_id).first<{ 
    repo_owner: string;
    repo_name: string;
    default_branch: string;
  }>();

  if (!repo) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'No repository connected to this workspace', 403);
  }

  // Create execution record
  const executionId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO execution_processes (id, session_id, run_reason, status, started_at)
    VALUES (?, ?, 'codingagent', 'running', datetime('now'))
  `).bind(executionId, body.session_id).run();

  // Update session status
  await c.env.DB.prepare(`
    UPDATE workspace_sessions SET status = 'running', started_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(body.session_id).run();

  // Initialize tool executor and agent adapter
  const toolExecutor = new ToolExecutor(c.env, githubConn.access_token_encrypted, AGENT_TOOLS);
  const agentType = body.agent_type || session.executor as CloudAgentType;

  // Select agent adapter based on type
  let result;
  if (agentType === 'CLAUDE_API') {
    const adapter = new ClaudeAdapter(c.env, toolExecutor);
    result = await adapter.execute({
      execution_id: executionId,
      session_id: body.session_id,
      task_description: body.task_description || `${session.title}\n\n${session.task_desc || ''}`,
      context: {
        files: [], // TODO: Fetch context files if specified
        repo: {
          owner: repo.repo_owner,
          name: repo.repo_name,
          branch: session.branch,
          default_branch: repo.default_branch,
        },
      },
      agent_type: agentType,
      api_key: body.api_key,
    });
  } else {
    // TODO: Add OpenAI and Gemini adapters
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, `Agent type ${agentType} not yet supported`, 400);
  }

  // Update execution and session status
  await c.env.DB.prepare(`
    UPDATE execution_processes 
    SET status = ?, exit_code = ?, completed_at = datetime('now')
    WHERE id = ?
  `).bind(
    result.status === 'completed' ? 'completed' : 'failed',
    result.status === 'completed' ? 0 : 1,
    executionId
  ).run();

  await c.env.DB.prepare(`
    UPDATE workspace_sessions 
    SET status = ?, completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(result.status, body.session_id).run();

  // Store execution result in KV for quick access
  await c.env.CACHE.put(
    `execution:${executionId}`,
    JSON.stringify(result),
    { expirationTtl: 86400 } // 24 hours
  );

  return c.json(result, 200);
});

/**
 * GET /agents/executions/:id - Get execution details
 */
agentsRoutes.get('/executions/:id', async (c) => {
  const user = c.get('user')!;
  const executionId = c.req.param('id');

  // Try to get from KV first (fast path)
  const cached = await c.env.CACHE.get(`execution:${executionId}`);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  // Fall back to database
  const execution = await c.env.DB.prepare(`
    SELECT ep.*, ws.task_id, ws.workspace_id
    FROM execution_processes ep
    JOIN workspace_sessions ws ON ep.session_id = ws.id
    WHERE ep.id = ?
  `).bind(executionId).first();

  if (!execution) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Execution not found', 404);
  }

  return c.json(execution);
});

/**
 * DELETE /agents/executions/:id - Stop an execution
 */
agentsRoutes.delete('/executions/:id', async (c) => {
  const user = c.get('user')!;
  const executionId = c.req.param('id');

  // Get execution and verify access
  const execution = await c.env.DB.prepare(`
    SELECT ep.*, ws.workspace_id
    FROM execution_processes ep
    JOIN workspace_sessions ws ON ep.session_id = ws.id
    WHERE ep.id = ?
  `).bind(executionId).first<{ session_id: string; workspace_id: string; status: string }>();

  if (!execution) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Execution not found', 404);
  }

  if (execution.status !== 'running') {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Execution is not running', 400);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(execution.workspace_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized', 403);
  }

  // Update execution status
  await c.env.DB.prepare(`
    UPDATE execution_processes 
    SET status = 'cancelled', exit_code = -1, completed_at = datetime('now')
    WHERE id = ?
  `).bind(executionId).run();

  // Update session status
  await c.env.DB.prepare(`
    UPDATE workspace_sessions 
    SET status = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).bind(execution.session_id).run();

  return c.json({ success: true, message: 'Execution cancelled' });
});

/**
 * GET /agents/executions/:id/stream - Stream execution events (SSE)
 */
agentsRoutes.get('/executions/:id/stream', async (c) => {
  const user = c.get('user')!;
  const executionId = c.req.param('id');

  // Get execution and verify access
  const execution = await c.env.DB.prepare(`
    SELECT ep.*, ws.workspace_id
    FROM execution_processes ep
    JOIN workspace_sessions ws ON ep.session_id = ws.id
    WHERE ep.id = ?
  `).bind(executionId).first<{ workspace_id: string }>();

  if (!execution) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Execution not found', 404);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(execution.workspace_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized', 403);
  }

  // Use the ExecutionStream SSE helper
  return createSSEStream(c.env, executionId);
});

/**
 * GET /agents/executions/:id/logs - Get execution logs (REST endpoint)
 */
agentsRoutes.get('/executions/:id/logs', async (c) => {
  const user = c.get('user')!;
  const executionId = c.req.param('id');
  const sinceIndex = parseInt(c.req.query('since') || '0', 10);

  // Get execution and verify access
  const execution = await c.env.DB.prepare(`
    SELECT ep.*, ws.workspace_id
    FROM execution_processes ep
    JOIN workspace_sessions ws ON ep.session_id = ws.id
    WHERE ep.id = ?
  `).bind(executionId).first<{ workspace_id: string }>();

  if (!execution) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Execution not found', 404);
  }

  // Verify workspace access
  const member = await c.env.DB.prepare(
    'SELECT role FROM workspace_members WHERE workspace_team_id = ? AND user_id = ?'
  ).bind(execution.workspace_id, user.id).first();

  if (!member) {
    throw new ApiError(ErrorCodes.FORBIDDEN, 'Not authorized', 403);
  }

  // Get logs from KV
  const { logs, hasMore } = await ExecutionStream.getLogsSince(c.env, executionId, sinceIndex);

  return c.json({
    execution_id: executionId,
    logs,
    has_more: hasMore,
    next_index: sinceIndex + logs.length,
  });
});

/**
 * GET /agents/types - List available agent types
 */
agentsRoutes.get('/types', async (c) => {
  return c.json({
    agents: [
      {
        type: 'CLAUDE_API',
        name: 'Claude (Anthropic)',
        description: 'Advanced AI assistant with strong coding capabilities',
        requires_api_key: true,
        capabilities: ['code_generation', 'code_review', 'refactoring', 'debugging'],
        status: 'available',
      },
      {
        type: 'OPENAI_API',
        name: 'GPT-4 (OpenAI)',
        description: 'Powerful language model with function calling',
        requires_api_key: true,
        capabilities: ['code_generation', 'code_review', 'refactoring'],
        status: 'coming_soon',
      },
      {
        type: 'GEMINI_API',
        name: 'Gemini (Google)',
        description: 'Google\'s multimodal AI model',
        requires_api_key: true,
        capabilities: ['code_generation', 'code_review'],
        status: 'coming_soon',
      },
      {
        type: 'LOCAL_RELAY',
        name: 'Local Agent (via Relay)',
        description: 'Connect your local vibe-kanban for CLI agent execution',
        requires_api_key: false,
        capabilities: ['full_cli_access', 'all_agents'],
        status: 'available',
      },
    ],
  });
});

/**
 * GET /agents/tools - List available tools for agents
 */
agentsRoutes.get('/tools', async (c) => {
  return c.json({
    tools: AGENT_TOOLS.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: Object.keys(tool.parameters.properties),
    })),
  });
});

/**
 * POST /agents/local/register - Register a local CLI connection
 */
agentsRoutes.post('/local/register', async (c) => {
    // Provide connection info to the CLI
    return c.json({
        endpoint: `${c.req.url.replace('/register', '/ws')}`,
        message: "Use your existing auth token to connect via WebSocket"
    });
});

/**
 * GET /agents/local/ws - WebSocket connection for local CLI
 */
agentsRoutes.get('/local/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426);
    }

    const userId = c.get('user')?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);

    return stub.fetch(c.req.raw);
});

/**
 * POST /agents/local/execute - Execute command on local CLI
 */
agentsRoutes.post('/local/execute', async (c) => {
    const userId = c.get('user')?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);
    
    // Create new request to Durable Object
    const doReq = new Request('http://do/execute', {
        method: 'POST',
        headers: c.req.raw.headers,
        body: c.req.raw.body 
    });

    return stub.fetch(doReq);
});

/**
 * GET /agents/local/status - Get local CLI status
 */
agentsRoutes.get('/local/status', async (c) => {
    const userId = c.get('user')?.id;
    if (!userId) return c.text('Unauthorized', 401);

    const id = c.env.LOCAL_AGENT_RELAY.idFromName(userId);
    const stub = c.env.LOCAL_AGENT_RELAY.get(id);

    const doReq = new Request('http://do/status');
    return stub.fetch(doReq);
});