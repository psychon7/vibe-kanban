import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    login: vi.fn(),
    setToken: vi.fn(),
    getMe: vi.fn(),
    setWorkspaceId: vi.fn(),
  },
}));

const renderLoginPage = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form', () => {
    renderLoginPage();
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders the DevLoginHelper in dev mode', () => {
    renderLoginPage();
    
    // DevLoginHelper should show the DEV MODE badge
    expect(screen.getByText(/dev mode/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@vibe-kanban.dev/i)).toBeInTheDocument();
  });

  it('fills credentials when Fill Credentials button is clicked', async () => {
    renderLoginPage();
    
    const fillButton = screen.getByRole('button', { name: /fill credentials/i });
    fireEvent.click(fillButton);
    
    await waitFor(() => {
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
      expect(emailInput.value).toBe('admin@vibe-kanban.dev');
      expect(passwordInput.value).toBe('admin123');
    });
  });

  it('shows error message on failed login', async () => {
    const { api } = await import('../../api/client');
    vi.mocked(api.login).mockRejectedValueOnce(new Error('Invalid credentials'));
    
    renderLoginPage();
    
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('has link to signup page', () => {
    renderLoginPage();
    
    expect(screen.getByRole('link', { name: /create a new account/i })).toHaveAttribute('href', '/auth/signup');
  });
});
