import React from 'react';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  asChild?: boolean;
  className?: string;
}

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  CardTitleProps
>(({ asChild = false, className, ...props }, ref) => {
  const Component = asChild ? 'span' : 'h3';
  
  return (
    <Component
      className={`text-lg font-semibold leading-none tracking-tight ${className}`}
      ref={ref}
      {...props}
    />
  );
});

CardTitle.displayName = 'CardTitle';

export default CardTitle;