import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn';

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: ReactNode;
  description?: ReactNode;
}

/** Casilla nativa con la etiqueta como objetivo táctil de al menos 44 px. */
export function Checkbox({ label, description, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        'flex min-h-control cursor-pointer items-start gap-sm py-sm has-disabled:cursor-not-allowed',
        className,
      )}
    >
      <input type="checkbox" className="mt-xs size-md shrink-0 accent-primary" {...props} />
      <span className="flex min-w-0 flex-col">
        <span className="text-label text-text">{label}</span>
        {description ? <span className="text-caption text-text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
