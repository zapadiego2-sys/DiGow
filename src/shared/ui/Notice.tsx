import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type NoticeTone = 'warning' | 'danger' | 'success';

const TONES: Record<NoticeTone, string> = {
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
  success: 'bg-success-subtle text-success',
};

interface NoticeProps {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
}

/** Aviso de estado. El título de texto evita depender solo del color. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-xs rounded-md p-md text-body-sm', TONES[tone])}
    >
      <p className="text-subtitle">{title}</p>
      {children}
    </div>
  );
}
