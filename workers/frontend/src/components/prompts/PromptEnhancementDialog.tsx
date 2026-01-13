import { useState } from 'react';
import { api } from '../../api/client';
import type { PromptEnhancementResult } from '../../api/client';

interface PromptEnhancementDialogProps {
  originalPrompt: string;
  onAccept: (enhancedPrompt: string) => void;
  onClose: () => void;
}

export default function PromptEnhancementDialog({
  originalPrompt,
  onAccept,
  onClose,
}: PromptEnhancementDialogProps) {
  const [style, setStyle] = useState<'minimal' | 'balanced' | 'comprehensive'>('balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PromptEnhancementResult | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleEnhance = async () => {
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const enhancement = await api.enhancePrompt(originalPrompt, style);
      setResult(enhancement);
      setEditedPrompt(enhancement.enhancement.enhanced_prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    
    try {
      await api.submitEnhancementFeedback(result.enhancement.id, true);
    } catch {
      // Ignore feedback errors
    }
    
    onAccept(isEditing ? editedPrompt : result.enhancement.enhanced_prompt);
  };

  const handleReject = async () => {
    if (result) {
      try {
        await api.submitEnhancementFeedback(result.enhancement.id, false);
      } catch {
        // Ignore feedback errors
      }
    }
    onClose();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative inline-block bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-4xl sm:w-full">
          <div className="px-4 pt-5 pb-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Prompt Enhancement
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

            {error && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {!result ? (
              /* Enhancement options */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Original Prompt
                  </label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {originalPrompt || <span className="text-gray-400 italic">No description provided</span>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enhancement Style
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['minimal', 'balanced', 'comprehensive'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStyle(s)}
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          style === s
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {s}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {s === 'minimal' && 'Light improvements, preserves original style'}
                          {s === 'balanced' && 'Moderate improvements, good structure'}
                          {s === 'comprehensive' && 'Full rewrite with best practices'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleEnhance}
                  disabled={isLoading || !originalPrompt}
                  className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Enhancing with AI...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Enhance Prompt
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Enhancement result */
              <div className="space-y-4">
                {/* Quality scores */}
                <div className="flex items-center justify-center space-x-8 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Original Score</div>
                    <div className={`text-2xl font-bold ${getScoreColor(result.enhancement.quality_score_before)}`}>
                      {result.enhancement.quality_score_before}
                    </div>
                  </div>
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Enhanced Score</div>
                    <div className={`text-2xl font-bold ${getScoreColor(result.enhancement.quality_score_after)}`}>
                      {result.enhancement.quality_score_after}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Improvement</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      +{result.enhancement.quality_score_after - result.enhancement.quality_score_before}
                    </div>
                  </div>
                </div>

                {/* Feedback badges */}
                {result.feedback.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {result.feedback.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400"
                      >
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {f}
                      </span>
                    ))}
                  </div>
                )}

                {/* Side by side comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Original
                      </label>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-[200px] max-h-[300px] overflow-y-auto">
                      {result.enhancement.original_prompt}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enhanced
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        {isEditing ? 'View' : 'Edit'}
                      </button>
                    </div>
                    {isEditing ? (
                      <textarea
                        value={editedPrompt}
                        onChange={(e) => setEditedPrompt(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 dark:text-white min-h-[200px] max-h-[300px]"
                      />
                    ) : (
                      <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-[200px] max-h-[300px] overflow-y-auto">
                        {result.enhancement.enhanced_prompt}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 sm:px-6 flex justify-end gap-2">
            {result ? (
              <>
                <button
                  type="button"
                  onClick={handleReject}
                  className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Keep Original
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {isEditing ? 'Use Edited Version' : 'Accept Enhancement'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
