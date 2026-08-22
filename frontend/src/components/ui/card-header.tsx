import React from 'react';

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardHeader = React.forwardRef<
  HTMLDivElement,
  CardHeaderProps
>(({ className, ...props }, ref) => (
  <div className={`flex flex-row space-y-1.5 p-6 ${className}`} ref={ref} {...props} />
));

CardHeader.displayName = 'CardHeader';

export default CardHeader;