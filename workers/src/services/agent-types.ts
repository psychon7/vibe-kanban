/**
 * Agent Execution Service Types
 * Defines interfaces for API-based agent execution
 */

// Supported agent types for cloud execution
export type CloudAgentType = 'CLAUDE_API' | 'OPENAI_API' | 'GEMINI_API';

// Execution status
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Tool definitions for agents
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required: string[];
  };
}

// Tool call result
export interface ToolCallResult {
  tool_call_id: string;
  name: string;
  result: string;
  error?: string;
}

// File content for context
export interface FileContent {
  path: string;
  content: string;
  language?: string;
}

// Repository info
export interface RepoInfo {
  owner: string;
  name: string;
  branch: string;
  default_branch: string;
}

// Execution parameters
export interface ExecuteParams {
  execution_id?: string; // Optional pre-generated ID for streaming
  session_id: string;
  task_description: string;
  context: {
    files: FileContent[];
    repo: RepoInfo;
  };
  agent_type: CloudAgentType;
  api_key?: string; // User's own API key or platform key
  max_tokens?: number;
  temperature?: number;
}

// Stream events for SSE
export type StreamEventType = 
  | 'start'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'file_change'
  | 'error'
  | 'complete';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: string;
  data: {
    message?: string;
    tool_call?: {
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    };
    tool_result?: ToolCallResult;
    file_change?: {
      path: string;
      action: 'create' | 'update' | 'delete';
    };
    error?: string;
    tokens_used?: number;
  };
}

// Execution result
export interface ExecutionResult {
  id: string;
  session_id: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  summary?: string;
  files_changed: string[];
  tokens_used: number;
  cost_usd?: number;
  error?: string;
}

// Agent adapter interface
export interface AgentAdapter {
  name: CloudAgentType;
  
  /**
   * Execute a single-shot request (non-streaming)
   */
  execute(params: ExecuteParams): Promise<ExecutionResult>;
  
  /**
   * Stream execution events (for real-time UI updates)
   */
  stream(params: ExecuteParams): AsyncGenerator<StreamEvent>;
  
  /**
   * Stop an ongoing execution
   */
  stop?(executionId: string): Promise<void>;
}

// Built-in tools for agent execution
export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file from the repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file relative to repository root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or update a file in the repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file relative to repository root',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        message: {
          type: 'string',
          description: 'Commit message for the change',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the repository',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to delete',
        },
        message: {
          type: 'string',
          description: 'Commit message for the deletion',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code patterns in the repository',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (supports regex)',
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g., "*.ts")',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a path',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path (use "" or "/" for root)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_file_diff',
    description: 'Get the diff of changes made to a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command (sandboxed, for tests/builds)',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command to run (e.g., "npm test", "cargo build")',
        },
        working_directory: {
          type: 'string',
          description: 'Working directory for the command',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark the task as complete with a summary',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of changes made',
        },
        files_changed: {
          type: 'array',
          description: 'List of files that were changed',
        },
      },
      required: ['summary'],
    },
  },
];
