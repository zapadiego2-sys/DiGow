import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
}

interface DataTableProps<T> {
  caption: string;
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}

/** Tabla desde md; en móvil cada fila es una tarjeta con sus etiquetas. */
export function DataTable<T>({ caption, columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block print:block print:overflow-visible">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'bg-primary p-cell text-label text-on-primary',
                    column.numeric ? 'text-right' : 'text-left',
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'bg-surface p-cell text-text',
                      column.numeric ? 'tabular text-right text-money' : 'text-body-sm',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={caption} className="flex flex-col gap-sm md:hidden print:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-border bg-surface p-md">
            <dl className="flex flex-col gap-sm">
              {columns.map((column) => (
                <div key={column.key} className="flex items-center justify-between gap-md">
                  <dt className="text-caption text-text-muted">{column.header}</dt>
                  <dd
                    className={cn(
                      'min-w-0 text-right text-text',
                      column.numeric ? 'tabular text-money' : 'text-body-sm',
                    )}
                  >
                    {column.cell(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
