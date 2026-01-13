interface VisibilityToggleProps {
  value: 'workspace' | 'private' | 'restricted';
  onChange: (visibility: 'workspace' | 'private' | 'restricted') => void;
  disabled?: boolean;
}

const VISIBILITY_OPTIONS = [
  {
    value: 'workspace' as const,
    label: 'Workspace',
    description: 'Visible to all workspace members',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    value: 'private' as const,
    label: 'Private',
    description: 'Only visible to you',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  },
  {
    value: 'restricted' as const,
    label: 'Restricted',
    description: 'Visible to specific people',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
];

export default function VisibilityToggle({ value, onChange, disabled }: VisibilityToggleProps) {
  return (
    <div className="space-y-2">
      {VISIBILITY_OPTIONS.map((option) => (
        <label
          key={option.value}
          className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            value === option.value
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
          }`}
        >
          <input
            type="radio"
            name="visibility"
            value={option.value}
            checked={value === option.value}
            onChange={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <svg
                className={`w-4 h-4 mr-1.5 ${
                  value === option.value ? 'text-indigo-600' : 'text-gray-400'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
