/**
 * DevLoginHelper Component
 * 
 * A development/testing helper that provides one-click login with test credentials.
 * Only visible in non-production environments.
 * 
 * Test Credentials:
 *   Email: admin@vibe-kanban.dev
 *   Password: Admin123
 */

interface DevLoginHelperProps {
  onFillCredentials: (email: string, password: string) => void;
  onAutoLogin: () => Promise<void>;
}

const DEV_CREDENTIALS = {
  email: 'admin@vibe-kanban.dev',
  password: 'Admin123',
};

// Check if we're in a non-production environment
const isDevEnvironment = () => {
  // Check Vite mode
  if (import.meta.env.MODE === 'production') return false;
  
  // Check if API URL points to production (safety check)
  const apiUrl = import.meta.env.VITE_API_URL || '';
  
  // For now, always show in development builds
  // In a real app, you might check the API /health endpoint for environment
  return import.meta.env.DEV || !apiUrl.includes('production');
};

export default function DevLoginHelper({ onFillCredentials, onAutoLogin }: DevLoginHelperProps) {
  // Don't render in production
  if (!isDevEnvironment()) {
    return null;
  }

  const handleFill = () => {
    onFillCredentials(DEV_CREDENTIALS.email, DEV_CREDENTIALS.password);
  };

  const handleAutoLogin = async () => {
    onFillCredentials(DEV_CREDENTIALS.email, DEV_CREDENTIALS.password);
    // Small delay to allow state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    await onAutoLogin();
  };

  return (
    <div className="mt-6 p-4 border-2 border-dashed border-amber-400 dark:border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-900/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100">
          DEV MODE
        </span>
        <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
          Quick Login Helper
        </span>
      </div>
      
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
        Use test credentials for development:
      </p>
      
      <div className="text-xs font-mono bg-amber-100 dark:bg-amber-900/40 p-2 rounded mb-3 text-amber-800 dark:text-amber-200">
        <div>Email: {DEV_CREDENTIALS.email}</div>
        <div>Password: {DEV_CREDENTIALS.password}</div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleFill}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded border border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-300 dark:hover:bg-amber-900/40 transition-colors"
        >
          Fill Credentials
        </button>
        <button
          type="button"
          onClick={handleAutoLogin}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 transition-colors"
        >
          🚀 Auto Login
        </button>
      </div>
    </div>
  );
}
