import { Moon, Sun, Monitor } from '@phosphor-icons/react';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeMode } from 'shared/types';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const modes = [ThemeMode.LIGHT, ThemeMode.DARK, ThemeMode.SYSTEM];
    const currentIndex = modes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  const getIcon = () => {
    switch (theme) {
      case ThemeMode.LIGHT:
        return <Sun className="size-5" weight="duotone" />;
      case ThemeMode.DARK:
        return <Moon className="size-5" weight="duotone" />;
      case ThemeMode.SYSTEM:
        return <Monitor className="size-5" weight="duotone" />;
      default:
        return <Monitor className="size-5" weight="duotone" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case ThemeMode.LIGHT:
        return 'Light';
      case ThemeMode.DARK:
        return 'Dark (Cyberpunk)';
      case ThemeMode.SYSTEM:
        return 'System';
      default:
        return 'System';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-2 rounded-md',
        'text-sm font-medium transition-all duration-300',
        'border border-cp-border hover:border-cp-primary',
        'dark:hover:shadow-glow-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-primary',
        className
      )}
      aria-label={`Switch theme (current: ${getLabel()})`}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  );
}