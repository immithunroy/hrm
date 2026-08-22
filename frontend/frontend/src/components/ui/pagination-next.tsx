import React from 'react';

interface PaginationNextProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

const PaginationNext = React.forwardRef<
  HTMLButtonElement,
  PaginationNextProps
>(({ className, ...props }, ref) => (
  <button
    className={`inline-flex h-10 w-10 items-center justify-center rounded-border text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground ${className}`}
    ref={ref}
    {...props}
  />
));

PaginationNext.displayName = 'PaginationNext';

export default PaginationNext;