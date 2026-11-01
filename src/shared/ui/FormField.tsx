import { useId, type ReactNode } from 'react';

export interface FieldControlProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}

interface FormFieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Etiqueta visible encima, ayuda y error debajo, enlazados al control. */
export function FormField({ label, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="flex min-w-0 flex-col gap-xs">
      <label htmlFor={id} className="text-label text-text">
        {label}
      </label>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const } : {}),
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      })}
      {hint ? (
        <div id={hintId} className="text-caption text-text-muted">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
