import React from 'react';

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardFooter = React.forwardRef<
  HTMLDivElement,
  CardFooterProps
>(({ className, ...props }, ref) => (
  <div className={`flex items-center p-6 pt-0 ${className}`} ref={ref} {...props} />
));

CardFooter.displayName = 'CardFooter';

export default CardFooter;