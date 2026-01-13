import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { api } from '../../api/client';
import type { WorkspaceMember } from '../../api/client';

interface AssigneeSelectorProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}

export default function AssigneeSelector({ value, onChange, disabled }: AssigneeSelectorProps) {
  const { currentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
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
    if (isOpen && currentWorkspace && members.length === 0) {
      loadMembers();
    }
  }, [isOpen, currentWorkspace]);

  const loadMembers = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const { members } = await api.listWorkspaceMembers(currentWorkspace.id);
      setMembers(members);
    } catch {
      // Ignore errors
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMember = members.find((m) => m.user_id === value);
  const filteredMembers = members.filter(
    (m) =>
      search === '' ||
      m.user_name.toLowerCase().includes(search.toLowerCase()) ||
      m.user_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white sm:text-sm ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600'
        }`}
      >
        {selectedMember ? (
          <div className="flex items-center">
            <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
              {selectedMember.user_name.charAt(0).toUpperCase()}
            </div>
            <span className="ml-2 truncate">{selectedMember.user_name}</span>
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">Unassigned</span>
        )}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {/* Unassigned option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                value === null ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
              }`}
            >
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="ml-2 text-gray-500 dark:text-gray-400">Unassigned</span>
              {value === null && (
                <svg className="ml-auto w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">Loading...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">No members found</div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => {
                    onChange(member.user_id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    value === member.user_id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                >
                  <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {member.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="ml-2 flex-1 text-left">
                    <div className="text-gray-900 dark:text-white">{member.user_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{member.user_email}</div>
                  </div>
                  {value === member.user_id && (
                    <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
