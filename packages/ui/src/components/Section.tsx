import type { ReactNode } from 'react';

export interface SectionProps {
  title?: ReactNode;
  children?: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="hh-section">
      {title ? <h2 className="hh-section__title">{title}</h2> : null}
      {children}
    </section>
  );
}
