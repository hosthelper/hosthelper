import type { ReactNode } from 'react';

export interface FooterProps {
  children?: ReactNode;
}

export function Footer({ children = '© hosthelper' }: FooterProps) {
  return <footer className="hh-foot">{children}</footer>;
}
