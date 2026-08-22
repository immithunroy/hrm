import React from 'react';

interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  className?: string;
}

const Pagination = React.forwardRef<
  HTMLElement,
  PaginationProps
>(({ className, ...props }, ref) => (
  <nav className={`${className} flex items-center justify-between text-sm`} ref={ref} {...props} />
));

Pagination.displayName = 'Pagination';

export default Pagination;