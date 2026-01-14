import * as React from 'react';
import { cn } from '@/lib/utils';

const CardCyberpunk = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'neon' | 'glass' }
>(({ className, variant = 'default', ...props }, ref) => {
  const variantClasses = {
    default: 'neon-card',
    neon: 'neon-card border-cp-primary dark:shadow-glow-primary',
    glass: 'glass-morph',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg text-card-foreground shadow-sm',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
});
CardCyberpunk.displayName = 'CardCyberpunk';

const CardCyberpunkHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
));
CardCyberpunkHeader.displayName = 'CardCyberpunkHeader';

const CardCyberpunkTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      'font-[Orbitron] dark:text-cp-primary',
      className
    )}
    {...props}
  />
));
CardCyberpunkTitle.displayName = 'CardCyberpunkTitle';

const CardCyberpunkDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardCyberpunkDescription.displayName = 'CardCyberpunkDescription';

const CardCyberpunkContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardCyberpunkContent.displayName = 'CardCyberpunkContent';

const CardCyberpunkFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardCyberpunkFooter.displayName = 'CardCyberpunkFooter';

export {
  CardCyberpunk,
  CardCyberpunkHeader,
  CardCyberpunkFooter,
  CardCyberpunkTitle,
  CardCyberpunkDescription,
  CardCyberpunkContent,
};