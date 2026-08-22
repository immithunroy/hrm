import React from 'react';

interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  TableHeaderProps
>(({ className, ...props }, ref) => (
  <thead className={`${className}`} ref={ref} {...props} />
));

TableHeader.displayName = 'TableHeader';

export default TableHeader;