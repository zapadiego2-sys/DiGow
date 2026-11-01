import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-primary bg-surface text-primary hover:bg-primary-subtle',
  danger: 'bg-danger text-on-primary',
};

/** Clases de botón, también para enlaces que se ven como botones. */
export function buttonClass(variant: ButtonVariant = 'secondary', className?: string): string {
  return cn(
    'inline-flex min-h-control items-center justify-center gap-sm rounded-md px-md text-center text-label transition-colors',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-text-muted disabled:border-border',
    VARIANTS[variant],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

/** Botón de solo ícono: el nombre accesible es obligatorio. */
export function IconButton({
  label,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-control shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary-subtle',
        className,
      )}
      {...props}
    />
  );
}
