import type { ReactNode } from 'react';

/** Todo costo, factor o utilidad vive aquí. Nunca se usa en la vista para el cliente. */
export function InternalPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md rounded-lg bg-internal-subtle p-md text-internal">
      <div className="flex items-center justify-between gap-sm">
        {title ? <h3 className="text-subtitle">{title}</h3> : <span />}
        <span className="rounded-full border border-internal px-sm py-xs text-caption">
          Interno
        </span>
      </div>
      {children}
    </section>
  );
}

export function InternalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-md">
      <span className="text-label">{label}</span>
      <span className={strong ? 'tabular text-money font-bold' : 'tabular text-money'}>
        {value}
      </span>
    </div>
  );
}
