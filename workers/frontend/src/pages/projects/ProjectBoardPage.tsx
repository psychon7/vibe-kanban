import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/client';
import type { Task, Project } from '../../api/client';
import TaskCard from '../../components/tasks/TaskCard';
import TaskModal from '../../components/tasks/TaskModal';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'border-gray-300' },
  { id: 'in_progress', title: 'In Progress', color: 'border-blue-400' },
  { id: 'in_review', title: 'In Review', color: 'border-yellow-400' },
  { id: 'done', title: 'Done', color: 'border-green-400' },
];

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  useEffect(() => {
    if (projectId && currentWorkspace) {
      loadProject();
      loadTasks();
    }
  }, [projectId, currentWorkspace]);

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const { project } = await api.getProject(projectId);
      setProject(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  };

  const loadTasks = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const { tasks } = await api.listTasks(projectId);
      setTasks(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    if (filterAssignee === 'all') return true;
    if (filterAssignee === 'me') return task.assigned_to === user?.id;
    if (filterAssignee === 'unassigned') return !task.assigned_to;
    return true;
  });

  const getTasksByStatus = (status: string) =>
    filteredTasks.filter((task) => task.status === status);

  if (!currentWorkspace) {
    return (
      <div className="p-6 text-center text-gray-500">
        Please select a workspace first.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
            <Link to="/" className="hover:text-gray-700 dark:hover:text-gray-300">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">{project?.name || 'Loading...'}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project?.name || 'Project Board'}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Filter dropdown */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">All Tasks</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex space-x-4 min-w-max pb-4">
            {COLUMNS.map((column) => {
              const columnTasks = getTasksByStatus(column.id);
              return (
                <div
                  key={column.id}
                  className={`w-72 flex-shrink-0 bg-gray-100 dark:bg-gray-800/50 rounded-lg border-t-4 ${column.color}`}
                >
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 dark:text-white">{column.title}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {columnTasks.length}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-400">
                        No tasks
                      </div>
                    ) : (
                      columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={() => setSelectedTask(task)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {(showCreateModal || selectedTask) && projectId && (
        <TaskModal
          task={selectedTask}
          projectId={projectId}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedTask(null);
          }}
          onSaved={loadTasks}
        />
      )}
    </div>
  );
}
