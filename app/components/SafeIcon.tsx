"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SafeIconProps {
  icon: LucideIcon;
  className?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  [key: string]: any;
}

export const SafeIcon: React.FC<SafeIconProps> = ({ 
  icon: Icon, 
  className,
  size,
  strokeWidth,
  color,
  ...props 
}) => {
  return (
    <Icon 
      className={className}
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      {...props}
      suppressHydrationWarning
    />
  );
};

// Export individual icon wrappers for convenience
export const createSafeIcon = (Icon: LucideIcon) => {
  const SafeIconWrapper = React.forwardRef<SVGSVGElement, Omit<SafeIconProps, 'icon'>>((props, ref) => (
    <Icon 
      {...props}
      ref={ref}
      suppressHydrationWarning
    />
  ));
  
  SafeIconWrapper.displayName = `Safe${Icon.displayName || Icon.name || 'Icon'}`;
  
  return SafeIconWrapper;
}; 