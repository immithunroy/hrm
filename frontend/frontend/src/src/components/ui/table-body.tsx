import React from 'react';

interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  TableBodyProps
>(({ className, ...props }, ref) => (
  <tbody className={`${className}`} ref={ref} {...props} />
));

TableBody.displayName = 'TableBody';

export default TableBody;