import { useState, useEffect } from 'react';
import StartSessionModal from './StartSessionModal';
import ExecutionLogs from './ExecutionLogs';

interface Session {
  id: string;
  task_id: string;
  workspace_id: string;
  executor: string;
  execution_mode: string;
  branch: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  latest_execution_id?: string; // Added for streaming
}

interface SessionPanelProps {
  taskId: string;
  taskTitle: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
};

const EXECUTOR_NAMES: Record<string, string> = {
  'CLAUDE_API': 'Claude',
  'OPENAI_API': 'GPT-4',
  'GEMINI_API': 'Gemini',
  'LOCAL_RELAY': 'Local Agent',
};

export default function SessionPanel({ taskId, taskTitle }: SessionPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/sessions?task_id=${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [taskId]);

  // Refresh sessions when status might change
  useEffect(() => {
    const hasRunning = sessions.some(s => s.status === 'running');
    if (!hasRunning) return;

    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [sessions]);

  const handleStartExecution = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/agents/execute`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            agent_type: sessions.find(s => s.id === sessionId)?.executor,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to start execution');
      }

      // Get the execution result which includes the execution ID
      const result = await response.json();
      
      // Update session with execution ID
      setSessions(prev => prev.map(s => 
        s.id === sessionId 
          ? { ...s, latest_execution_id: result.id, status: 'running' as const }
          : s
      ));
      
      loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start execution');
    }
  };

  const handleStopExecution = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/sessions/${sessionId}/stop`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to stop execution');
      }

      loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop execution');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-white">
          Agent Sessions
        </h4>
        <button
          onClick={() => setShowStartModal(true)}
          className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Session
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p>No sessions yet</p>
          <p className="text-sm mt-1">Start a session to run an AI agent on this task</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`
                border rounded-lg overflow-hidden
                ${selectedSession?.id === session.id ? 'border-indigo-500' : 'border-gray-200 dark:border-gray-700'}
              `}
            >
              {/* Session header */}
              <div
                className="p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50"
                onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[session.status]}`}>
                      {session.status}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {EXECUTOR_NAMES[session.executor] || session.executor}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {session.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartExecution(session.id);
                        }}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                        Run
                      </button>
                    )}
                    {session.status === 'running' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStopExecution(session.id);
                        }}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop
                      </button>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transform transition-transform ${selectedSession?.id === session.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-mono">{session.branch}</span>
                  <span>Created: {formatDate(session.created_at)}</span>
                </div>
              </div>

              {/* Expanded session details */}
              {selectedSession?.id === session.id && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <div className="h-64">
                    <ExecutionLogs
                      executionId={session.latest_execution_id || ''}
                      sessionId={session.id}
                      status={session.status}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showStartModal && (
        <StartSessionModal
          taskId={taskId}
          taskTitle={taskTitle}
          onClose={() => setShowStartModal(false)}
          onStarted={(_sessionId) => {
            setShowStartModal(false);
            loadSessions();
          }}
        />
      )}
    </div>
  );
}
