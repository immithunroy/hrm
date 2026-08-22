import React from 'react';

interface TableCellProps extends React.HTMLAttributes<HTMLTableDataCellElement> {
  className?: string;
}

const TableCell = React.forwardRef<
  HTMLTableDataCellElement,
  TableCellProps
>(({ className, ...props }, ref) => (
  <td className={`${className} p-4`} ref={ref} {...props} />
));

TableCell.displayName = 'TableCell';

export default TableCell;