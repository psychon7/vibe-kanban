import { useState, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { apiClient } from '../../api/client';

const AI_MODELS = [
  { id: '@cf/meta/llama-2-7b-chat-int8', name: 'Llama 2 7B (Default)', description: 'Fast, good for basic tasks' },
  { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 8B', description: 'Better reasoning, slightly slower' },
  { id: '@cf/mistral/mistral-7b-instruct-v0.1', name: 'Mistral 7B', description: 'Balanced performance' },
];

const ENHANCEMENT_STYLES = [
  { id: 'minimal', name: 'Minimal', description: 'Light touch - fix grammar and clarity only' },
  { id: 'balanced', name: 'Balanced', description: 'Moderate improvements to structure and detail' },
  { id: 'comprehensive', name: 'Comprehensive', description: 'Thorough rewrite with full detail and context' },
];

export default function PromptSettingsPage() {
  const { currentWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [preferredModel, setPreferredModel] = useState('@cf/meta/llama-2-7b-chat-int8');
  const [enhancementStyle, setEnhancementStyle] = useState<'minimal' | 'balanced' | 'comprehensive'>('balanced');
  const [includeCodebaseContext, setIncludeCodebaseContext] = useState(true);
  const [includeGitHistory, setIncludeGitHistory] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  useEffect(() => {
    if (!currentWorkspace) return;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const { settings: data } = await apiClient.getPromptSettings(currentWorkspace.id);
        // Populate form
        setAutoEnhance(data.auto_enhance_enabled);
        setPreferredModel(data.preferred_model);
        setEnhancementStyle(data.enhancement_style);
        setIncludeCodebaseContext(data.include_codebase_context);
        setIncludeGitHistory(data.include_git_history);
        setCustomInstructions(data.custom_instructions || '');
      } catch {
        // Settings might not exist yet, use defaults
        console.warn('Using default settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [currentWorkspace]);

  const handleSave = async () => {
    if (!currentWorkspace) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      await apiClient.updatePromptSettings(currentWorkspace.id, {
        auto_enhance_enabled: autoEnhance,
        preferred_model: preferredModel,
        enhancement_style: enhancementStyle,
        include_codebase_context: includeCodebaseContext,
        include_git_history: includeGitHistory,
        custom_instructions: customInstructions || undefined,
      });

      setSuccessMessage('Settings saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prompt Enhancement Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure AI-powered prompt enhancement for your workspace
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
        </div>
      )}

      <div className="space-y-8">
        {/* Auto-enhance toggle */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Auto-enhance Tasks</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Automatically enhance task descriptions when creating new tasks
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoEnhance(!autoEnhance)}
              className={`${
                autoEnhance ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
            >
              <span
                className={`${
                  autoEnhance ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
              />
            </button>
          </div>
        </div>

        {/* Model selection */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">AI Model</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Choose the AI model used for prompt enhancement
          </p>
          <div className="space-y-3">
            {AI_MODELS.map((model) => (
              <label
                key={model.id}
                className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                  preferredModel === model.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="model"
                  value={model.id}
                  checked={preferredModel === model.id}
                  onChange={(e) => setPreferredModel(e.target.value)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {model.name}
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    {model.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Enhancement style */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Enhancement Style</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            How aggressively should the AI improve prompts?
          </p>
          <div className="space-y-3">
            {ENHANCEMENT_STYLES.map((style) => (
              <label
                key={style.id}
                className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                  enhancementStyle === style.id
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="style"
                  value={style.id}
                  checked={enhancementStyle === style.id}
                  onChange={(e) => setEnhancementStyle(e.target.value as typeof enhancementStyle)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 mt-0.5"
                />
                <div className="ml-3">
                  <span className="block text-sm font-medium text-gray-900 dark:text-white">
                    {style.name}
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    {style.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Context options */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Context Options</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Additional context to include when enhancing prompts
          </p>
          <div className="space-y-4">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={includeCodebaseContext}
                onChange={(e) => setIncludeCodebaseContext(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded mt-0.5"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  Include codebase context
                </span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">
                  Analyze connected repositories for relevant file patterns and conventions
                </span>
              </div>
            </label>
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={includeGitHistory}
                onChange={(e) => setIncludeGitHistory(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 rounded mt-0.5"
              />
              <div className="ml-3">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  Include git history
                </span>
                <span className="block text-sm text-gray-500 dark:text-gray-400">
                  Reference recent commits and changes for better context
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Custom instructions */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Custom Instructions</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add custom instructions that will be included with every enhancement request
          </p>
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={4}
            placeholder="e.g., Always include acceptance criteria. Use our team's coding style guide. Focus on testability..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm"
          />
        </div>

        {/* Usage summary (placeholder) */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">--</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enhancements this month</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">--</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tokens used</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">--</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg. quality score</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
            Usage tracking coming soon
          </p>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
