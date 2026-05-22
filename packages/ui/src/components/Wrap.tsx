import type { ReactNode } from 'react';

export interface WrapProps {
  children: ReactNode;
}

export function Wrap({ children }: WrapProps) {
  return <div className="hh-wrap">{children}</div>;
}
