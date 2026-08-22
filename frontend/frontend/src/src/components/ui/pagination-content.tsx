import React from 'react';

interface PaginationContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const PaginationContent = React.forwardRef<
  HTMLDivElement,
  PaginationContentProps
>(({ className, ...props }, ref) => (
  <div className={`${className} flex-1 flex justify-center`} ref={ref} {...props} />
));

PaginationContent.displayName = 'PaginationContent';

export default PaginationContent;