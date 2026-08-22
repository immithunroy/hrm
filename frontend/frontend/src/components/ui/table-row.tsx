import React from 'react';

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  TableRowProps
>(({ className, ...props }, ref) => (
  <tr className={`${className} border-b`} ref={ref} {...props} />
));

TableRow.displayName = 'TableRow';

export default TableRow;