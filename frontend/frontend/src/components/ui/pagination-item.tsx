import React from 'react';

interface PaginationItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  className?: string;
}

const PaginationItem = React.forwardRef<
  HTMLButtonElement,
  PaginationItemProps
>(({ active = false, className, ...props }, ref) => (
  <button
    className={`inline-flex items-center justify-center rounded-border text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground ${active ? 'bg-primary text-primary-foreground' : ''} ${className}`}
    ref={ref}
    {...props}
  />
));

PaginationItem.displayName = 'PaginationItem';

export default PaginationItem;