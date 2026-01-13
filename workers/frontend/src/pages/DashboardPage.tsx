import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import WorkspaceSwitcher from '../components/workspace/WorkspaceSwitcher';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Vibe Kanban
              </h1>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
              <WorkspaceSwitcher />
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {user?.name || user?.email}
              </span>
              <button
                onClick={logout}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {workspaceLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : currentWorkspace ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Welcome to {currentWorkspace.name}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {currentWorkspace.description || 'Your Kanban dashboard is ready. Start by creating projects and tasks!'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Projects</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">Coming soon</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tasks</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">Coming soon</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Members</h3>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{currentWorkspace.member_count || 1}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No workspace selected</h3>
            <p className="mt-1 text-gray-500 dark:text-gray-400">Create a workspace to get started with your projects.</p>
          </div>
        )}
      </main>
    </div>
  );
}
