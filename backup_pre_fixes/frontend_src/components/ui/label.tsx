import React from 'react';

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  className?: string;
}

const Label = React.forwardRef<
  HTMLLabelElement,
  LabelProps
>(({ className, ...props }, ref) => (
  <label
    className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50 ${className}`}
    ref={ref}
    {...props}
  />
));

Label.displayName = 'Label';

export default Label;