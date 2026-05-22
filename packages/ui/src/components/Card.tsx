import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div className={`hh-card ${className ?? ''}`.trim()} {...rest}>
      {children}
    </div>
  );
}
