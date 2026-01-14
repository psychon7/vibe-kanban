import { useState } from 'react';
import type { FormEvent } from 'react';
import AgentSelector from './AgentSelector';

interface StartSessionModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}

export default function StartSessionModal({ taskId, taskTitle, onClose, onStarted }: StartSessionModalProps) {
  const [selectedAgent, setSelectedAgent] = useState('CLAUDE_API');
  const [executionMode, setExecutionMode] = useState<'cloud' | 'local'>('cloud');
  const [customBranch, setCustomBranch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          task_id: taskId,
          executor: selectedAgent,
          execution_mode: executionMode,
          branch: customBranch || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to create session');
      }

      const { id } = await response.json();
      onStarted(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative inline-block bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="px-4 pt-5 pb-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Start Agent Session
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Task: <span className="font-medium text-gray-900 dark:text-white">{taskTitle}</span>
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <AgentSelector
                  value={selectedAgent}
                  onChange={setSelectedAgent}
                  disabled={isLoading}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Execution Mode
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="cloud"
                        checked={executionMode === 'cloud'}
                        onChange={() => setExecutionMode('cloud')}
                        className="mr-2"
                        disabled={isLoading}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Cloud</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="local"
                        checked={executionMode === 'local'}
                        onChange={() => setExecutionMode('local')}
                        className="mr-2"
                        disabled={selectedAgent !== 'LOCAL_RELAY' || isLoading}
                      />
                      <span className={`text-sm ${selectedAgent !== 'LOCAL_RELAY' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        Local (via Relay)
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  {showAdvanced ? '▼' : '▶'} Advanced Options
                </button>

                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Custom Branch Name
                      </label>
                      <input
                        type="text"
                        value={customBranch}
                        onChange={(e) => setCustomBranch(e.target.value)}
                        placeholder="vibe/custom-branch-name"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                        disabled={isLoading}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Leave empty for auto-generated branch name
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 sm:px-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Session
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
