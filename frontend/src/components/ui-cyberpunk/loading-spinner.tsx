import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'accent';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'size-4',
    md: 'size-8',
    lg: 'size-12',
  };

  const variantClasses = {
    primary: 'border-cp-primary dark:shadow-glow-primary',
    secondary: 'border-cp-secondary dark:shadow-glow-secondary',
    accent: 'border-cp-accent dark:shadow-glow-accent',
  };

  return (
    <div
      className={cn(
        'inline-block animate-rotate rounded-full border-2 border-transparent',
        'border-t-current',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}