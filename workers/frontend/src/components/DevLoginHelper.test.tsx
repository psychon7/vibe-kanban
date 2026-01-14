import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DevLoginHelper from './DevLoginHelper';

describe('DevLoginHelper', () => {
  const mockOnFillCredentials = vi.fn();
  const mockOnAutoLogin = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders in development mode', () => {
    render(
      <DevLoginHelper
        onFillCredentials={mockOnFillCredentials}
        onAutoLogin={mockOnAutoLogin}
      />
    );

    expect(screen.getByText(/dev mode/i)).toBeInTheDocument();
    expect(screen.getByText(/admin@vibe-kanban.dev/i)).toBeInTheDocument();
    expect(screen.getByText(/admin123/i)).toBeInTheDocument();
  });

  it('calls onFillCredentials when Fill Credentials button is clicked', () => {
    render(
      <DevLoginHelper
        onFillCredentials={mockOnFillCredentials}
        onAutoLogin={mockOnAutoLogin}
      />
    );

    const fillButton = screen.getByRole('button', { name: /fill credentials/i });
    fireEvent.click(fillButton);

    expect(mockOnFillCredentials).toHaveBeenCalledWith('admin@vibe-kanban.dev', 'admin123');
  });

  it('calls onFillCredentials and onAutoLogin when Auto Login button is clicked', async () => {
    render(
      <DevLoginHelper
        onFillCredentials={mockOnFillCredentials}
        onAutoLogin={mockOnAutoLogin}
      />
    );

    const autoLoginButton = screen.getByRole('button', { name: /auto login/i });
    fireEvent.click(autoLoginButton);

    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockOnFillCredentials).toHaveBeenCalledWith('admin@vibe-kanban.dev', 'admin123');
      expect(mockOnAutoLogin).toHaveBeenCalled();
    });
  });

  it('displays test credentials information', () => {
    render(
      <DevLoginHelper
        onFillCredentials={mockOnFillCredentials}
        onAutoLogin={mockOnAutoLogin}
      />
    );

    expect(screen.getByText(/email:/i)).toBeInTheDocument();
    expect(screen.getByText(/password:/i)).toBeInTheDocument();
    expect(screen.getByText(/quick login helper/i)).toBeInTheDocument();
  });

  it('has styled warning appearance', () => {
    const { container } = render(
      <DevLoginHelper
        onFillCredentials={mockOnFillCredentials}
        onAutoLogin={mockOnAutoLogin}
      />
    );

    // Check for amber/warning styling classes
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('border-amber');
  });
});
