import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ui-cyberpunk/theme-toggle';
import { 
  Kanban, 
  Gear, 
  List,
  Terminal 
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/projects', label: 'Projects', icon: Kanban },
  { path: '/tasks', label: 'Tasks', icon: List },
  { path: '/logs', label: 'Logs', icon: Terminal },
  { path: '/settings', label: 'Settings', icon: Gear },
];

export function CyberpunkNavbar() {
  const location = useLocation();

  return (
    <nav className="border-b border-cp-border bg-cp-surface/50 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Logo className="h-8 w-8" />
            <span className="font-[Orbitron] text-xl font-bold dark:text-cp-primary">
              Vibe Kanban
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300',
                    isActive
                      ? 'bg-cp-primary/10 text-cp-primary dark:shadow-glow-primary border border-cp-primary'
                      : 'text-muted-foreground hover:text-cp-foreground hover:bg-cp-surface-elevated'
                  )}
                >
                  <Icon className="size-5" weight={isActive ? 'fill' : 'regular'} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}