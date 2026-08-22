import React from 'react';

interface TableCaptionProps extends React.HTMLAttributes<HTMLTableCaptionElement> {
  className?: string;
}

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  TableCaptionProps
>(({ className, ...props }, ref) => (
  <caption className={`${className} text-base font-semibold leading-none text-muted-foreground`} ref={ref} {...props} />
));

TableCaption.displayName = 'TableCaption';

export default TableCaption;