import React from 'react';

interface TableHeadProps extends React.HTMLAttributes<HTMLTableHeaderCellElement> {
  className?: string;
}

const TableHead = React.forwardRef<
  HTMLTableHeaderCellElement,
  TableHeadProps
>(({ className, ...props }, ref) => (
  <th className={`${className} px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider`} ref={ref} {...props} />
));

TableHead.displayName = 'TableHead';

export default TableHead;