import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonCyberpunkVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Cyberpunk variants
        'cyber-primary': 
          'bg-cp-primary text-cp-primary-foreground hover:shadow-glow-primary dark:hover:shadow-glow-primary transition-all duration-300 hover:-translate-y-0.5',
        'cyber-secondary': 
          'bg-cp-secondary text-cp-secondary-foreground hover:shadow-glow-secondary dark:hover:shadow-glow-secondary transition-all duration-300 hover:-translate-y-0.5',
        'cyber-accent': 
          'bg-cp-accent text-cp-accent-foreground hover:shadow-glow-accent dark:hover:shadow-glow-accent transition-all duration-300 hover:-translate-y-0.5',
        'cyber-ghost': 
          'border border-cp-primary text-cp-primary hover:bg-cp-primary/10 dark:hover:shadow-glow-primary transition-all duration-300',
        'cyber-outline': 
          'border-2 border-cp-primary text-cp-primary hover:bg-cp-primary hover:text-cp-primary-foreground dark:hover:shadow-glow-primary transition-all duration-300',
        'cyber-glass': 
          'glass-morph border border-cp-primary/30 text-cp-foreground hover:border-cp-primary dark:hover:shadow-glow-primary transition-all duration-300',
        'cyber-destructive':
          'bg-cp-error text-cp-error-foreground hover:shadow-glow-error dark:hover:shadow-glow-error transition-all duration-300 hover:-translate-y-0.5',
        'cyber-success':
          'bg-cp-success text-cp-success-foreground hover:shadow-glow-success dark:hover:shadow-glow-success transition-all duration-300 hover:-translate-y-0.5',
        
        // Standard variants
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        xl: 'h-12 rounded-md px-10 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonCyberpunkProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonCyberpunkVariants> {
  asChild?: boolean;
}

const ButtonCyberpunk = React.forwardRef<HTMLButtonElement, ButtonCyberpunkProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonCyberpunkVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
ButtonCyberpunk.displayName = 'ButtonCyberpunk';

export { ButtonCyberpunk, buttonCyberpunkVariants };