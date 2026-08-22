import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'muted';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

const Badge = React.forwardRef<
  HTMLSpanElement,
  BadgeProps
>(({ variant = 'default', size = 'default', className, ...props }, ref) => {
  const baseClasses = 'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold';
  
  const sizeClasses = {
    default: '',
    sm: 'px-2 py-0 text-[10px]',
    lg: 'px-3 py-1 text-sm'
  };
  
  const variantClasses = {
    default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
    secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
    destructive: 'border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20',
    outline: 'border-input hover:bg-accent hover:text-accent-foreground',
    muted: 'border-muted bg-muted/20 text-muted-foreground'
  };
  
  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      ref={ref}
      {...props}
    />
  );
});

Badge.displayName = 'Badge';

export default Badge;