interface AgentSelectorProps {
  value: string;
  onChange: (agent: string) => void;
  disabled?: boolean;
}

const AGENTS = [
  {
    id: 'CLAUDE_API',
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Advanced AI with strong coding capabilities',
    icon: '🤖',
    status: 'available',
  },
  {
    id: 'OPENAI_API',
    name: 'GPT-4',
    provider: 'OpenAI',
    description: 'Powerful language model with function calling',
    icon: '🧠',
    status: 'coming_soon',
  },
  {
    id: 'GEMINI_API',
    name: 'Gemini',
    provider: 'Google',
    description: 'Google\'s multimodal AI model',
    icon: '💎',
    status: 'coming_soon',
  },
  {
    id: 'LOCAL_RELAY',
    name: 'Local Agent',
    provider: 'Your Machine',
    description: 'Connect your local vibe-kanban for CLI agents',
    icon: '💻',
    status: 'available',
  },
];

export default function AgentSelector({ value, onChange, disabled }: AgentSelectorProps) {

  const selectedAgent = AGENTS.find(a => a.id === value);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Select Agent
      </label>
      
      <div className="grid grid-cols-2 gap-2">
        {AGENTS.map((agent) => {
          const isSelected = value === agent.id;
          const isDisabled = disabled || agent.status === 'coming_soon';
          
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => !isDisabled && onChange(agent.id)}
              disabled={isDisabled}
              className={`
                relative p-3 rounded-lg border-2 text-left transition-all
                ${isSelected 
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                ${isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'}
              `}
            >
              <div className="flex items-start space-x-2">
                <span className="text-xl">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                      {agent.name}
                    </span>
                    {agent.status === 'coming_soon' && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {agent.provider}
                  </p>
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedAgent && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {selectedAgent.description}
        </p>
      )}
    </div>
  );
}
