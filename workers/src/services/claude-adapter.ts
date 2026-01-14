/**
 * Claude Agent Adapter
 * Implements agent execution using Anthropic's Claude API with tool use
 */

import type { Env } from '../types/env';
import type {
  AgentAdapter,
  CloudAgentType,
  ExecuteParams,
  ExecutionResult,
  StreamEvent,
  ToolDefinition,
  AGENT_TOOLS,
} from './agent-types';
import { ExecutionStream } from './execution-stream';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

interface ClaudeContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, unknown>;
    required: string[];
  };
}

interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContent[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Convert our tool definitions to Claude's format
 */
function toClaudeTools(tools: ToolDefinition[]): ClaudeToolDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: tool.parameters.type,
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  }));
}

/**
 * Build the system prompt for the agent
 */
function buildSystemPrompt(context: ExecuteParams['context']): string {
  return `You are an expert software developer assistant working on a coding task.

## Repository Context
- Owner: ${context.repo.owner}
- Repository: ${context.repo.name}
- Current Branch: ${context.repo.branch}
- Default Branch: ${context.repo.default_branch}

## Your Capabilities
You have access to tools to read files, write files, search code, and run commands.
Use these tools to complete the task given to you.

## Guidelines
1. Start by understanding the codebase - read relevant files first
2. Make minimal, focused changes
3. Follow existing code style and conventions
4. Write clear commit messages
5. Test your changes when possible
6. Call \`complete_task\` when finished with a summary

## Files Provided for Context
${context.files.map(f => `- ${f.path}`).join('\n')}
`;
}

/**
 * Build the initial user message
 */
function buildUserMessage(taskDescription: string, context: ExecuteParams['context']): string {
  let message = `## Task\n${taskDescription}\n\n`;
  
  if (context.files.length > 0) {
    message += `## Relevant Files\n`;
    for (const file of context.files) {
      message += `\n### ${file.path}\n\`\`\`${file.language || ''}\n${file.content}\n\`\`\`\n`;
    }
  }
  
  return message;
}

export class ClaudeAdapter implements AgentAdapter {
  name: CloudAgentType = 'CLAUDE_API';
  
  private env: Env;
  private toolExecutor: ToolExecutor;
  
  constructor(env: Env, toolExecutor: ToolExecutor) {
    this.env = env;
    this.toolExecutor = toolExecutor;
  }
  
  async execute(params: ExecuteParams): Promise<ExecutionResult> {
    const startTime = new Date().toISOString();
    const executionId = params.execution_id || crypto.randomUUID();
    let totalTokens = 0;
    const filesChanged: string[] = [];
    
    // Initialize execution stream for real-time logging
    const stream = new ExecutionStream(this.env, executionId);
    await stream.logStart(`Starting Claude agent execution for task: ${params.task_description.slice(0, 100)}...`);
    
    const apiKey = params.api_key || this.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await stream.logError('No Anthropic API key configured');
      return {
        id: executionId,
        session_id: params.session_id,
        status: 'failed',
        started_at: startTime,
        completed_at: new Date().toISOString(),
        files_changed: [],
        tokens_used: 0,
        error: 'No Anthropic API key configured',
      };
    }
    
    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: buildUserMessage(params.task_description, params.context),
      },
    ];
    
    const tools = toClaudeTools(this.toolExecutor.getTools());
    const systemPrompt = buildSystemPrompt(params.context);
    
    await stream.logThinking('Analyzing task and codebase...');
    
    // Agent loop - continue until task is complete or max iterations
    const MAX_ITERATIONS = 20;
    let iteration = 0;
    let isComplete = false;
    let summary = '';
    
    while (!isComplete && iteration < MAX_ITERATIONS) {
      iteration++;
      
      try {
        await stream.logThinking(`Iteration ${iteration}: Processing...`);
        
        const response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: params.max_tokens || 4096,
            temperature: params.temperature ?? 0.7,
            system: systemPrompt,
            tools,
            messages,
          }),
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Claude API error: ${response.status} ${error}`);
        }
        
        const data = await response.json() as ClaudeResponse;
        totalTokens += data.usage.input_tokens + data.usage.output_tokens;
        
        // Add assistant response to messages
        messages.push({
          role: 'assistant',
          content: data.content,
        });
        
        // Log text responses
        for (const content of data.content) {
          if (content.type === 'text' && content.text) {
            await stream.logMessage(content.text.slice(0, 500));
          }
        }
        
        // Process tool calls
        if (data.stop_reason === 'tool_use') {
          const toolResults: ClaudeContent[] = [];
          
          for (const content of data.content) {
            if (content.type === 'tool_use' && content.name && content.input) {
              // Check if this is the completion tool
              if (content.name === 'complete_task') {
                isComplete = true;
                summary = (content.input as { summary?: string }).summary || '';
                const changedFiles = (content.input as { files_changed?: string[] }).files_changed;
                if (changedFiles) {
                  filesChanged.push(...changedFiles);
                }
                break;
              }
              
              // Log tool call
              await stream.logToolCall(content.id || '', content.name, content.input);
              
              // Execute the tool
              const result = await this.toolExecutor.execute(
                content.name,
                content.input,
                params.context.repo
              );
              
              // Log tool result
              await stream.logToolResult(
                content.id || '',
                content.name,
                typeof result.result === 'string' ? result.result : JSON.stringify(result.result).slice(0, 500),
                result.error
              );
              
              // Track file changes
              if (['write_file', 'delete_file'].includes(content.name)) {
                const filePath = (content.input as { path?: string }).path;
                if (filePath && !filesChanged.includes(filePath)) {
                  filesChanged.push(filePath);
                  await stream.logFileChange(filePath, content.name === 'delete_file' ? 'delete' : 'update');
                }
              }
              
              toolResults.push({
                type: 'tool_result',
                tool_use_id: content.id,
                content: JSON.stringify(result),
                is_error: !!result.error,
              });
            }
          }
          
          if (toolResults.length > 0 && !isComplete) {
            messages.push({
              role: 'user',
              content: toolResults,
            });
          }
        } else {
          // No more tool calls, agent is done
          isComplete = true;
          // Extract summary from the last text content
          const textContent = data.content.find(c => c.type === 'text');
          if (textContent && textContent.text) {
            summary = textContent.text;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await stream.logError(errorMessage);
        return {
          id: executionId,
          session_id: params.session_id,
          status: 'failed',
          started_at: startTime,
          completed_at: new Date().toISOString(),
          files_changed: filesChanged,
          tokens_used: totalTokens,
          error: errorMessage,
        };
      }
    }
    
    // Log completion
    await stream.logComplete(totalTokens);
    
    return {
      id: executionId,
      session_id: params.session_id,
      status: isComplete ? 'completed' : 'failed',
      started_at: startTime,
      completed_at: new Date().toISOString(),
      summary,
      files_changed: filesChanged,
      tokens_used: totalTokens,
      cost_usd: this.calculateCost(totalTokens),
    };
  }
  
  async *stream(params: ExecuteParams): AsyncGenerator<StreamEvent> {
    // For now, wrap execute in a simple stream
    // TODO: Implement true streaming with Anthropic's streaming API
    
    yield {
      type: 'start',
      timestamp: new Date().toISOString(),
      data: { message: 'Starting Claude agent execution...' },
    };
    
    yield {
      type: 'thinking',
      timestamp: new Date().toISOString(),
      data: { message: 'Analyzing task and codebase...' },
    };
    
    const result = await this.execute(params);
    
    if (result.error) {
      yield {
        type: 'error',
        timestamp: new Date().toISOString(),
        data: { error: result.error },
      };
    }
    
    for (const file of result.files_changed) {
      yield {
        type: 'file_change',
        timestamp: new Date().toISOString(),
        data: { file_change: { path: file, action: 'update' } },
      };
    }
    
    yield {
      type: 'complete',
      timestamp: new Date().toISOString(),
      data: {
        message: result.summary || 'Execution complete',
        tokens_used: result.tokens_used,
      },
    };
  }
  
  private calculateCost(tokens: number): number {
    // Claude 3.5 Sonnet pricing (as of early 2024)
    // Input: $3/MTok, Output: $15/MTok
    // Simplified average estimation
    const avgCostPerToken = (3 + 15) / 2 / 1_000_000;
    return tokens * avgCostPerToken;
  }
}

/**
 * Tool Executor - handles executing tools on behalf of agents
 */
export class ToolExecutor {
  private env: Env;
  private githubToken: string;
  private tools: ToolDefinition[];
  
  constructor(env: Env, githubToken: string, tools: ToolDefinition[]) {
    this.env = env;
    this.githubToken = githubToken;
    this.tools = tools;
  }
  
  getTools(): ToolDefinition[] {
    return this.tools;
  }
  
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    repo: { owner: string; name: string; branch: string }
  ): Promise<{ result?: unknown; error?: string }> {
    const GITHUB_API = 'https://api.github.com';
    
    try {
      switch (toolName) {
        case 'read_file': {
          const path = args.path as string;
          const response = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.branch}`,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
            }
          );
          
          if (!response.ok) {
            return { error: `File not found: ${path}` };
          }
          
          const data = await response.json() as { content: string; encoding: string };
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return { result: content };
        }
        
        case 'write_file': {
          const path = args.path as string;
          const content = args.content as string;
          const message = (args.message as string) || `Update ${path}`;
          
          // Get current file SHA if it exists
          let sha: string | undefined;
          const existingResponse = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.branch}`,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
            }
          );
          
          if (existingResponse.ok) {
            const existing = await existingResponse.json() as { sha: string };
            sha = existing.sha;
          }
          
          // Create or update file
          const putResponse = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
              body: JSON.stringify({
                message,
                content: Buffer.from(content).toString('base64'),
                branch: repo.branch,
                ...(sha && { sha }),
              }),
            }
          );
          
          if (!putResponse.ok) {
            const error = await putResponse.text();
            return { error: `Failed to write file: ${error}` };
          }
          
          return { result: `Successfully ${sha ? 'updated' : 'created'} ${path}` };
        }
        
        case 'delete_file': {
          const path = args.path as string;
          const message = (args.message as string) || `Delete ${path}`;
          
          // Get file SHA
          const getResponse = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.branch}`,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
            }
          );
          
          if (!getResponse.ok) {
            return { error: `File not found: ${path}` };
          }
          
          const fileData = await getResponse.json() as { sha: string };
          
          const deleteResponse = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
              body: JSON.stringify({
                message,
                sha: fileData.sha,
                branch: repo.branch,
              }),
            }
          );
          
          if (!deleteResponse.ok) {
            const error = await deleteResponse.text();
            return { error: `Failed to delete file: ${error}` };
          }
          
          return { result: `Successfully deleted ${path}` };
        }
        
        case 'search_code': {
          const query = args.query as string;
          const filePattern = args.file_pattern as string | undefined;
          
          let searchQuery = `${query} repo:${repo.owner}/${repo.name}`;
          if (filePattern) {
            searchQuery += ` filename:${filePattern}`;
          }
          
          const response = await fetch(
            `${GITHUB_API}/search/code?q=${encodeURIComponent(searchQuery)}`,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
            }
          );
          
          if (!response.ok) {
            return { error: 'Search failed' };
          }
          
          const data = await response.json() as { items: Array<{ path: string; html_url: string }> };
          return {
            result: data.items.slice(0, 10).map(item => ({
              path: item.path,
              url: item.html_url,
            })),
          };
        }
        
        case 'list_directory': {
          const path = args.path as string || '';
          
          const response = await fetch(
            `${GITHUB_API}/repos/${repo.owner}/${repo.name}/contents/${path}?ref=${repo.branch}`,
            {
              headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'Vibe-Kanban-Agent',
              },
            }
          );
          
          if (!response.ok) {
            return { error: `Directory not found: ${path}` };
          }
          
          const data = await response.json() as Array<{ name: string; type: string; path: string }>;
          return {
            result: data.map(item => ({
              name: item.name,
              type: item.type,
              path: item.path,
            })),
          };
        }
        
        case 'run_command': {
          // Commands need to be run in an external environment (Codespaces, etc.)
          // For now, return a placeholder
          return {
            result: 'Command execution is not available in cloud mode. Please use a connected development environment.',
          };
        }
        
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Tool execution failed' };
    }
  }
}
