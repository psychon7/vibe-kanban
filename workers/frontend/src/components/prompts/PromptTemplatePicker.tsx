import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import type { PromptTemplate } from '../../api/client';

interface PromptTemplatePickerProps {
  onSelect: (template: string) => void;
}

const CATEGORIES = [
  { id: 'bug-fix', label: 'Bug Fix', icon: '🐛' },
  { id: 'feature', label: 'Feature', icon: '✨' },
  { id: 'refactor', label: 'Refactor', icon: '♻️' },
  { id: 'docs', label: 'Documentation', icon: '📝' },
  { id: 'test', label: 'Testing', icon: '🧪' },
  { id: 'other', label: 'Other', icon: '📋' },
];

export default function PromptTemplatePicker({ onSelect }: PromptTemplatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && templates.length === 0) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { templates } = await api.listPromptTemplates();
      setTemplates(templates);
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = async (template: PromptTemplate) => {
    try {
      const { placeholders } = await api.getPromptTemplate(template.id);
      if (placeholders.length > 0) {
        setSelectedTemplate(template);
        setPlaceholders(placeholders);
        setVariables(Object.fromEntries(placeholders.map((p) => [p, ''])));
        setShowVariableModal(true);
      } else {
        onSelect(template.template);
        setIsOpen(false);
      }
    } catch {
      // Just use the template as-is
      onSelect(template.template);
      setIsOpen(false);
    }
  };

  const handleRenderTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      const { rendered } = await api.renderPromptTemplate(selectedTemplate.id, variables);
      onSelect(rendered);
      setShowVariableModal(false);
      setIsOpen(false);
    } catch {
      // Just use template with placeholders replaced manually
      let result = selectedTemplate.template;
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      onSelect(result);
      setShowVariableModal(false);
      setIsOpen(false);
    }
  };

  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Use Template
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Categories */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`px-2 py-1 text-xs rounded ${
                  selectedCategory === null
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Templates list */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No templates found
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateClick(template)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </span>
                    {template.is_global && (
                      <span className="text-xs text-gray-400">Global</span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                  <div className="flex items-center mt-1 text-xs text-gray-400">
                    <span>Used {template.usage_count}×</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Variable input modal */}
      {showVariableModal && selectedTemplate && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => setShowVariableModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Fill in template variables
              </h4>
              <div className="space-y-3">
                {placeholders.map((placeholder) => (
                  <div key={placeholder}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {placeholder}
                    </label>
                    <input
                      type="text"
                      value={variables[placeholder] || ''}
                      onChange={(e) =>
                        setVariables((prev) => ({ ...prev, [placeholder]: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                      placeholder={`Enter ${placeholder}...`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowVariableModal(false)}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRenderTemplate}
                  className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Use Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
