import { useState } from 'react';
import type { WorkspaceMember, Workspace } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

interface MemberRowProps {
  member: WorkspaceMember;
  onRemove: () => void;
  onChangeRole: (role: 'Admin' | 'Member' | 'Viewer') => Promise<void> | void;
  currentWorkspace: Workspace;
}

export default function MemberRow({ member, onRemove, onChangeRole, currentWorkspace }: MemberRowProps) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const currentUserRole = (currentWorkspace.user_role || currentWorkspace.role || '').toLowerCase();
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isSelf = member.user_id === user?.id;
  const canRemove = canManageMembers && !isSelf && member.role_name !== 'owner';
  const canChangeRole = canManageMembers && !isSelf && member.role_name !== 'owner';

  const roleColors: Record<string, string> = {
    owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    member: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
            {(member.user_name || member.user_email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center">
              {member.user_name || 'Unknown'}
              {isSelf && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(you)</span>
              )}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{member.user_email || ''}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            roleColors[member.role_name] || roleColors.member
          }`}
        >
          {member.role_name ? member.role_name.charAt(0).toUpperCase() + member.role_name.slice(1) : 'Member'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {formatDate(member.created_at)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        {(canRemove || canChangeRole) && (
          <div className="relative" onMouseLeave={() => setShowActions(false)}>
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                {canChangeRole && (
                  <div className="px-3 pt-3 pb-2">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Role
                    </label>
                    <select
                      value={member.role_name ? member.role_name.toLowerCase() : 'member'}
                      disabled={isUpdatingRole}
                      onChange={async (e) => {
                        const nextRole = e.target.value as 'admin' | 'member' | 'viewer';
                        const normalized =
                          nextRole === 'admin' ? 'Admin' : nextRole === 'viewer' ? 'Viewer' : 'Member';
                        try {
                          setIsUpdatingRole(true);
                          await onChangeRole(normalized);
                        } finally {
                          setIsUpdatingRole(false);
                          setShowActions(false);
                        }
                      }}
                      className="block w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                )}

                {canRemove && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                    {!confirmRemove ? (
                      <button
                        onClick={() => setConfirmRemove(true)}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Remove from workspace
                      </button>
                    ) : (
                      <div className="p-3">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          Remove {member.user_name}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onRemove();
                              setShowActions(false);
                              setConfirmRemove(false);
                            }}
                            className="flex-1 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                          >
                            Remove
                          </button>
                          <button
                            onClick={() => {
                              setConfirmRemove(false);
                              setShowActions(false);
                            }}
                            className="flex-1 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
