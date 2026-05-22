import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'ghost';
  block?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'hh-btn',
    variant === 'primary' ? 'hh-btn--primary' : 'hh-btn--ghost',
    block ? 'hh-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
