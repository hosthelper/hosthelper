import type { ReactNode } from 'react';

export interface HeroProps {
  title: ReactNode;
  subtitle?: ReactNode;
  ctas?: ReactNode;
}

export function Hero({ title, subtitle, ctas }: HeroProps) {
  return (
    <section className="hh-hero">
      <h1 className="hh-hero__title">{title}</h1>
      {subtitle ? <p className="hh-hero__sub">{subtitle}</p> : null}
      {ctas ? <div className="hh-hero__ctas">{ctas}</div> : null}
    </section>
  );
}
