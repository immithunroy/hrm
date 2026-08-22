import React from 'react';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  className?: string;
}

const Table = React.forwardRef<
  HTMLTableElement,
  TableProps
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
    <table
      className={`${className} w-full text-sm text-left rtl:text-right border-collapse`}
      ref={ref}
      {...props}
    />
  </div>
));

Table.displayName = 'Table';

export default Table;