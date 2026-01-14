/**
 * Execution Stream Service
 * Handles real-time log streaming for agent executions
 */

import type { Env } from '../types/env';

export interface LogEntry {
  type: 'start' | 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'file_change' | 'error' | 'complete';
  timestamp: string;
  data: {
    message?: string;
    tool_call?: {
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };
    tool_result?: {
      tool_call_id: string;
      name: string;
      result: string;
      error?: string;
    };
    file_change?: {
      path: string;
      action: 'create' | 'update' | 'delete';
    };
    error?: string;
    tokens_used?: number;
    status?: string;
  };
}

export class ExecutionStream {
  private env: Env;
  private executionId: string;
  private logs: LogEntry[] = [];

  constructor(env: Env, executionId: string) {
    this.env = env;
    this.executionId = executionId;
  }

  /**
   * Add a log entry and persist to KV
   */
  async addLog(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    
    this.logs.push(logEntry);
    
    // Persist to KV for streaming clients
    await this.env.CACHE.put(
      `execution:${this.executionId}:logs`,
      JSON.stringify(this.logs),
      { expirationTtl: 86400 } // 24 hours
    );
    
    // Update latest log index for polling clients
    await this.env.CACHE.put(
      `execution:${this.executionId}:latest`,
      JSON.stringify({ 
        count: this.logs.length, 
        lastUpdate: logEntry.timestamp,
        status: entry.data.status || 'running'
      }),
      { expirationTtl: 86400 }
    );
  }

  /**
   * Log execution start
   */
  async logStart(message: string): Promise<void> {
    await this.addLog({
      type: 'start',
      data: { message, status: 'running' },
    });
  }

  /**
   * Log thinking/reasoning
   */
  async logThinking(message: string): Promise<void> {
    await this.addLog({
      type: 'thinking',
      data: { message },
    });
  }

  /**
   * Log tool call
   */
  async logToolCall(id: string, name: string, args: Record<string, unknown>): Promise<void> {
    await this.addLog({
      type: 'tool_call',
      data: {
        tool_call: { id, name, arguments: args },
      },
    });
  }

  /**
   * Log tool result
   */
  async logToolResult(toolCallId: string, name: string, result: string, error?: string): Promise<void> {
    await this.addLog({
      type: 'tool_result',
      data: {
        tool_result: { tool_call_id: toolCallId, name, result, error },
      },
    });
  }

  /**
   * Log a message from the agent
   */
  async logMessage(message: string): Promise<void> {
    await this.addLog({
      type: 'message',
      data: { message },
    });
  }

  /**
   * Log file change
   */
  async logFileChange(path: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    await this.addLog({
      type: 'file_change',
      data: { file_change: { path, action } },
    });
  }

  /**
   * Log error
   */
  async logError(error: string): Promise<void> {
    await this.addLog({
      type: 'error',
      data: { error, status: 'failed' },
    });
  }

  /**
   * Log completion
   */
  async logComplete(tokensUsed?: number): Promise<void> {
    await this.addLog({
      type: 'complete',
      data: { 
        message: 'Execution completed successfully',
        tokens_used: tokensUsed,
        status: 'completed'
      },
    });
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return this.logs;
  }

  /**
   * Static: Get logs from KV
   */
  static async getLogsFromKV(env: Env, executionId: string): Promise<LogEntry[]> {
    const cached = await env.CACHE.get(`execution:${executionId}:logs`);
    if (cached) {
      return JSON.parse(cached);
    }
    return [];
  }

  /**
   * Static: Get logs since index (for polling)
   */
  static async getLogsSince(env: Env, executionId: string, sinceIndex: number): Promise<{ logs: LogEntry[]; hasMore: boolean }> {
    const logs = await ExecutionStream.getLogsFromKV(env, executionId);
    const newLogs = logs.slice(sinceIndex);
    
    // Check if execution is complete
    const latest = await env.CACHE.get(`execution:${executionId}:latest`);
    const latestInfo = latest ? JSON.parse(latest) : { status: 'unknown' };
    
    return {
      logs: newLogs,
      hasMore: latestInfo.status === 'running',
    };
  }
}

/**
 * Create SSE response for execution streaming
 */
export function createSSEStream(env: Env, executionId: string): Response {
  const encoder = new TextEncoder();
  let lastIndex = 0;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: {"executionId":"${executionId}"}\n\n`));
      
      // Poll for updates
      const poll = async () => {
        if (closed) return;
        
        try {
          const { logs, hasMore } = await ExecutionStream.getLogsSince(env, executionId, lastIndex);
          
          // Send new logs
          for (const log of logs) {
            const eventData = JSON.stringify(log);
            controller.enqueue(encoder.encode(`event: log\ndata: ${eventData}\n\n`));
            lastIndex++;
          }
          
          // Check if execution is complete
          if (!hasMore) {
            controller.enqueue(encoder.encode(`event: done\ndata: {"status":"complete"}\n\n`));
            controller.close();
            closed = true;
            return;
          }
          
          // Send heartbeat
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          
          // Schedule next poll
          setTimeout(poll, 1000);
        } catch (error) {
          console.error('SSE polling error:', error);
          controller.enqueue(encoder.encode(`event: error\ndata: {"error":"Stream error"}\n\n`));
          controller.close();
          closed = true;
        }
      };
      
      // Start polling
      setTimeout(poll, 100);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
