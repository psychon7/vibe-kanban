import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
  animated?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  label,
  animated = true,
  className,
}: StatusIndicatorProps) {
  const statusColors = {
    online: 'bg-cp-success',
    offline: 'bg-gray-400',
    busy: 'bg-cp-error',
    away: 'bg-cp-warning',
  };

  const statusGlow = {
    online: 'shadow-glow-success',
    offline: '',
    busy: 'shadow-glow-error',
    away: 'shadow-glow-accent',
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div className="relative">
        <div
          className={cn(
            'size-2 rounded-full',
            statusColors[status],
            animated && status === 'online' && 'pulse-dot'
          )}
        />
        {animated && status === 'online' && (
          <div
            className={cn(
              'absolute inset-0 rounded-full dark:animate-glow-pulse',
              statusColors[status],
              statusGlow[status]
            )}
          />
        )}
      </div>
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}