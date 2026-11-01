import type { ComponentProps } from 'react';
import { cn } from '../lib/cn';

export const inputClass =
  'w-full min-w-0 rounded-md border border-border-strong bg-surface px-cell text-body text-text placeholder:text-text-muted aria-invalid:border-danger disabled:bg-surface-muted';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, 'min-h-control', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'min-h-thumb py-sm', className)} {...props} />;
}
