import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Card = React.forwardRef<
  HTMLDivElement,
  CardProps
>(({ className, ...props }, ref) => (
  <div
    className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}
    ref={ref}
    {...props}
  />
));

Card.displayName = 'Card';

export default Card;