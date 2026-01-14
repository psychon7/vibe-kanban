import { useState, useEffect, useRef } from 'react';

interface ExecutionLogsProps {
  executionId: string;
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

interface LogEntry {
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

const LOG_TYPE_STYLES: Record<string, { bg: string; icon: string; label: string }> = {
  start: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: '🚀', label: 'Started' },
  thinking: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: '🤔', label: 'Thinking' },
  tool_call: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: '🔧', label: 'Tool Call' },
  tool_result: { bg: 'bg-green-100 dark:bg-green-900/30', icon: '✅', label: 'Tool Result' },
  message: { bg: 'bg-gray-100 dark:bg-gray-800', icon: '💬', label: 'Message' },
  file_change: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: '📄', label: 'File Change' },
  error: { bg: 'bg-red-100 dark:bg-red-900/30', icon: '❌', label: 'Error' },
  complete: { bg: 'bg-green-100 dark:bg-green-900/30', icon: '🎉', label: 'Complete' },
};

export default function ExecutionLogs({ executionId, status }: ExecutionLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle scroll to toggle auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Load initial logs
  useEffect(() => {
    if (!executionId) return;

    const loadLogs = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/agents/executions/${executionId}/logs`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        }
      } catch (e) {
        console.error('Failed to load logs:', e);
      }
    };

    loadLogs();
  }, [executionId]);

  // Connect to SSE stream when status is running
  useEffect(() => {
    if (status !== 'running' || !executionId) return;

    const token = localStorage.getItem('token');
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/v1/agents/executions/${executionId}/stream?token=${token}`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.addEventListener('log', (event) => {
      try {
        const data = JSON.parse(event.data) as LogEntry;
        setLogs(prev => [...prev, data]);
      } catch (e) {
        console.error('Failed to parse SSE log event:', e);
      }
    });

    eventSource.addEventListener('done', () => {
      setIsConnected(false);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [executionId, status]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Execution Logs
          </span>
          {status === 'running' && (
            <span className={`flex items-center text-xs ${isConnected ? 'text-green-600' : 'text-yellow-600'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-xs text-gray-500">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="mr-1"
            />
            Auto-scroll
          </label>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Logs container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50 dark:bg-gray-900 font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {status === 'pending' ? (
              <p>Session pending. Start execution to see logs.</p>
            ) : status === 'running' ? (
              <p>Waiting for logs...</p>
            ) : (
              <p>No logs available.</p>
            )}
          </div>
        ) : (
          logs.map((log, index) => {
            const style = LOG_TYPE_STYLES[log.type] || LOG_TYPE_STYLES.message;
            
            return (
              <div
                key={index}
                className={`p-3 rounded-lg ${style.bg} border border-gray-200 dark:border-gray-700`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center space-x-2">
                    <span>{style.icon}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {style.label}
                    </span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(log.timestamp)}
                  </span>
                </div>
                
                <div className="text-gray-800 dark:text-gray-200">
                  {log.data.message && (
                    <p className="whitespace-pre-wrap">{log.data.message}</p>
                  )}
                  
                  {log.data.tool_call && (
                    <div className="mt-1">
                      <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                        {log.data.tool_call.name}({JSON.stringify(log.data.tool_call.arguments, null, 2)})
                      </code>
                    </div>
                  )}
                  
                  {log.data.tool_result && (
                    <div className="mt-1">
                      <pre className="text-xs bg-gray-200 dark:bg-gray-700 p-2 rounded overflow-x-auto">
                        {log.data.tool_result.result}
                      </pre>
                      {log.data.tool_result.error && (
                        <p className="text-red-600 text-xs mt-1">{log.data.tool_result.error}</p>
                      )}
                    </div>
                  )}
                  
                  {log.data.file_change && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        log.data.file_change.action === 'create' ? 'bg-green-200 text-green-800' :
                        log.data.file_change.action === 'delete' ? 'bg-red-200 text-red-800' :
                        'bg-yellow-200 text-yellow-800'
                      }`}>
                        {log.data.file_change.action}
                      </span>
                      <code className="text-xs">{log.data.file_change.path}</code>
                    </div>
                  )}
                  
                  {log.data.error && (
                    <p className="text-red-600">{log.data.error}</p>
                  )}
                  
                  {log.data.tokens_used && (
                    <p className="text-xs text-gray-500 mt-1">
                      Tokens used: {log.data.tokens_used.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        {logs.length} log entries • Status: {status}
      </div>
    </div>
  );
}
