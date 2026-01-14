import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputCyberpunkProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'neon';
}

const InputCyberpunk = React.forwardRef<HTMLInputElement, InputCyberpunkProps>(
  ({ className, type, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: '',
      neon: 'focus-visible:border-cp-primary dark:focus-visible:shadow-glow-primary',
    };

    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-all',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:text-sm',
          variantClasses[variant],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
InputCyberpunk.displayName = 'InputCyberpunk';

export { InputCyberpunk };