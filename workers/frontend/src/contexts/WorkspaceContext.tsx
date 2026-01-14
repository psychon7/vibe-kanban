import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { Workspace } from '../api/client';
import { useAuth } from './AuthContext';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  selectWorkspace: (workspace: Workspace) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const WORKSPACE_KEY = 'vibe_kanban_workspace_id';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    if (!token) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.listWorkspaces();
      const fetchedWorkspaces = response?.workspaces || [];
      setWorkspaces(fetchedWorkspaces);

      // Try to restore last selected workspace
      const savedWorkspaceId = localStorage.getItem(WORKSPACE_KEY);
      const savedWorkspace = savedWorkspaceId
        ? fetchedWorkspaces.find((w) => w.id === savedWorkspaceId)
        : null;

      if (savedWorkspace) {
        setCurrentWorkspace(savedWorkspace);
        api.setWorkspaceId(savedWorkspace.id);
      } else if (fetchedWorkspaces.length > 0) {
        // Select first workspace if no saved preference
        setCurrentWorkspace(fetchedWorkspaces[0]);
        api.setWorkspaceId(fetchedWorkspaces[0].id);
        localStorage.setItem(WORKSPACE_KEY, fetchedWorkspaces[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      refreshWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      api.setWorkspaceId(null);
      setIsLoading(false);
    }
  }, [user, token, refreshWorkspaces]);

  const selectWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    api.setWorkspaceId(workspace.id);
    localStorage.setItem(WORKSPACE_KEY, workspace.id);
  };

  const createWorkspace = async (name: string, description?: string): Promise<Workspace> => {
    const { workspace } = await api.createWorkspace({ name, description });
    setWorkspaces((prev) => [...prev, workspace]);
    selectWorkspace(workspace);
    return workspace;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        isLoading,
        error,
        selectWorkspace,
        createWorkspace,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
