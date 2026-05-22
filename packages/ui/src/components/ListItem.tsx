import type { ReactNode } from 'react';

export interface ListItemProps {
  left: ReactNode;
  right?: ReactNode;
}

export function ListItem({ left, right }: ListItemProps) {
  return (
    <div className="hh-list-item">
      <div>{left}</div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}
