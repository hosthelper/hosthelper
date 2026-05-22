import type { ReactNode } from 'react';

export interface NavProps {
  logo?: ReactNode;
  right?: ReactNode;
}

export function Nav({ logo = 'hosthelper', right }: NavProps) {
  return (
    <nav className="hh-nav">
      <span className="hh-nav__logo">{logo}</span>
      {right ? <span className="hh-nav__right">{right}</span> : null}
    </nav>
  );
}
