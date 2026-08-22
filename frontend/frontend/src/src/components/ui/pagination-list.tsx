import React from 'react';

interface PaginationListProps extends React.HTMLAttributes<HTMLUListElement> {
  className?: string;
}

const PaginationList = React.forwardRef<
  HTMLUListElement,
  PaginationListProps
>(({ className, ...props }, ref) => (
  <ul className={`${className} flex items-center gap-1`} ref={ref} {...props} />
));

PaginationList.displayName = 'PaginationList';

export default PaginationList;