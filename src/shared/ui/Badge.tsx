import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'danger';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-neutral-subtle text-text',
  info: 'bg-primary-subtle text-primary',
  success: 'bg-success-subtle text-success',
  danger: 'bg-danger-subtle text-danger',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-sm py-xs text-caption whitespace-nowrap',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
