import type { ReactNode } from 'react';

export type BadgeTone = 'default' | 'live' | 'warn';

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  default: '',
  live: 'hh-badge--live',
  warn: 'hh-badge--warn',
};

export function Badge({ tone = 'default', children }: BadgeProps) {
  return <span className={`hh-badge ${toneClass[tone]}`.trim()}>{children}</span>;
}
