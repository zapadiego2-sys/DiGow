import { cn } from '../lib/cn';

/** La forma se define con className para imitar el contenido que reemplaza. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none',
        className,
      )}
    />
  );
}
