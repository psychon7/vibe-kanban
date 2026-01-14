import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { api } from '../api/client';
import type { Project } from '../api/client';
import CreateProjectModal from '../components/projects/CreateProjectModal';

export default function DashboardPage() {
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      loadProjects();
    }
  }, [currentWorkspace]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const response = await api.listProjects();
      setProjects(response?.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No workspace selected</h3>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Create a workspace to get started with your projects.</p>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'active');
  const totalTasks = projects.reduce((sum, p) => sum + (p.task_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Welcome to {currentWorkspace.name}!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {currentWorkspace.description || 'Your Kanban dashboard is ready. Start by creating projects and tasks!'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Link to="/projects" className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Projects</h3>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{projects.length}</p>
          </Link>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tasks</h3>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{totalTasks}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Team Members</h3>
            <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">{currentWorkspace.member_count || 1}</p>
          </div>
        </div>
      </div>

      {/* Projects section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Active Projects</h3>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : activeProjects.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No projects yet. Create your first one!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeProjects.slice(0, 6).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="block p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{project.name}</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{project.task_count || 0} tasks</span>
                  </div>
                  {project.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{project.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {activeProjects.length > 6 && (
            <div className="mt-4 text-center">
              <Link to="/projects" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                View all {activeProjects.length} projects →
              </Link>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            loadProjects();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}
