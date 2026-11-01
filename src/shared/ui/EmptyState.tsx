import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-xl text-center">
      <h2 className="text-subtitle text-text">{title}</h2>
      <p className="text-body-sm text-text-muted">{description}</p>
      {action ? <div className="mt-sm">{action}</div> : null}
    </div>
  );
}
