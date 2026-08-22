import React from 'react';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardContent = React.forwardRef<
  HTMLDivElement,
  CardContentProps
>(({ className, ...props }, ref) => (
  <div className={`p-6 pt-0 ${className}`} ref={ref} {...props} />
));

CardContent.displayName = 'CardContent';

export default CardContent;