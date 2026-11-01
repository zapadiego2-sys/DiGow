import type { ClientQuoteItem, ClientQuoteView } from '@/domain/clientView';
import { formatDate, formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable';
import { BrandLogo } from '../brand/BrandLogo';

const columns: DataTableColumn<ClientQuoteItem>[] = [
  {
    key: 'product',
    header: 'Producto',
    cell: (item) => (
      <div className="flex flex-col gap-xs text-left">
        <span className="text-label">{item.product}</span>
        <span className="text-body-sm whitespace-pre-line">{item.description}</span>
      </div>
    ),
  },
  {
    key: 'photo',
    header: 'Foto',
    cell: (item) =>
      item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={item.product}
          className="ml-auto size-thumb max-w-none rounded-md object-photo md:ml-0 print:ml-0"
        />
      ) : (
        '—'
      ),
  },
  // Una sola columna de medidas: nueve columnas no caben en el ancho de una hoja carta.
  {
    key: 'measures',
    header: 'Ancho × alto × prof.',
    numeric: true,
    cell: (item) => [item.width, item.height, item.depth].map(formatNumber).join(' × '),
  },
  { key: 'quantity', header: 'Cant.', numeric: true, cell: (item) => formatNumber(item.quantity) },
  {
    key: 'unit',
    header: 'Valor unidad',
    numeric: true,
    cell: (item) => formatMoney(item.unitPrice),
  },
  {
    key: 'total',
    header: 'Valor total',
    numeric: true,
    cell: (item) => formatMoney(item.lineTotal),
  },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd className="text-body">{value || '—'}</dd>
    </div>
  );
}

/** Solo recibe ClientQuoteView: los datos internos no llegan a este componente. */
export function ClientQuoteDocument({ view }: { view: ClientQuoteView }) {
  return (
    <article className="flex flex-col gap-lg rounded-lg border border-border bg-surface p-md md:p-lg print:rounded-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-center justify-between gap-md border-b-2 border-accent pb-md">
        <BrandLogo />
        <h1 className="text-title text-primary">Cotización</h1>
      </header>

      <dl className="grid gap-md sm:grid-cols-2 print:grid-cols-2">
        <Field label="Cliente" value={view.client} />
        <Field label="Fecha" value={view.date ? formatDate(view.date) : ''} />
        <Field label="Contacto" value={view.contact} />
        <Field label="Proyecto" value={view.project} />
      </dl>

      <DataTable
        caption="Ítems de la cotización"
        columns={columns}
        rows={view.items}
        rowKey={(item) => item.id}
      />

      <dl className="ml-auto flex w-full flex-col gap-sm sm:max-w-dialog">
        <div className="flex items-baseline justify-between gap-md">
          <dt className="text-label">Subtotal</dt>
          <dd className="tabular text-money">{formatMoney(view.subtotal)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-md">
          <dt className="text-label">IVA {formatPercent(view.vatRate)}</dt>
          <dd className="tabular text-money">{formatMoney(view.vat)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-md border-t-2 border-accent pt-sm">
          <dt className="text-subtitle">Valor total</dt>
          <dd className="tabular text-money-total">{formatMoney(view.total)}</dd>
        </div>
      </dl>

      {view.conditions.length > 0 ? (
        <section className="flex flex-col gap-sm">
          <h2 className="text-subtitle text-primary">Condiciones comerciales</h2>
          <ul className="flex list-disc flex-col gap-xs pl-lg text-body-sm">
            {view.conditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="grid gap-md sm:grid-cols-3 print:grid-cols-3">
        <Field label="Forma de pago" value={view.paymentTerms} />
        <Field label="Validez de la oferta" value={view.validity} />
        <Field label="Tiempo de entrega" value={view.deliveryTime} />
      </dl>

      {view.managerName ? (
        <footer className="flex flex-col text-body-sm">
          <span>Cordialmente,</span>
          <span className="mt-md text-label">{view.managerName}</span>
          <span>{view.managerRole}</span>
        </footer>
      ) : null}
    </article>
  );
}
