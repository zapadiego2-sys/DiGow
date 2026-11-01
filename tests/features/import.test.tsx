import { readFileSync } from 'node:fs';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuoteImportError } from '@/domain/errors';
import type { QuoteImporter } from '@/domain/ports';
import { createEmptyItem, createEmptyQuoteDraft, itemCost, quoteTotals } from '@/domain/quote';
import { createTestServices, renderApp } from './helpers';

const flat = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

function upload(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  const input = screen.getByLabelText('Archivo de cotización en formato .xlsx');
  return user.upload(input, file);
}

function fixture() {
  const bytes = readFileSync('tests/fixtures/cotizacion-ejemplo.xlsx');
  const file = new File([bytes], 'cotizacion-ejemplo.xlsx');
  file.arrayBuffer = () =>
    Promise.resolve(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return file;
}

describe('importar desde .xlsx', () => {
  it('el archivo de referencia pasa por la vista previa y crea un borrador con los mismos totales', async () => {
    const user = userEvent.setup();
    const { services, router } = renderApp('/cotizaciones/importar');
    const create = vi.spyOn(services.quoteWriter, 'create');

    await upload(fixture());

    // Vista previa: todavía no se guardó nada.
    const summary = await screen.findByRole('region', { name: 'Resumen' }, { timeout: 15000 });
    expect(screen.getByRole('heading', { name: 'Revisar importación' })).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(await services.quoteReader.list()).toHaveLength(1);
    expect(flat(summary.textContent)).toContain('$ 2.856.000');
    expect(screen.getByText('Archivo leído sin avisos')).toBeInTheDocument();

    // La vista previa es editable.
    const contact = screen.getByRole<HTMLInputElement>('textbox', { name: 'Contacto' });
    expect(contact.value).toBe('Ana Ejemplo');
    await user.clear(contact);
    await user.type(contact, 'Otra persona');

    await user.click(within(summary).getByRole('button', { name: 'Guardar como borrador' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await waitFor(() => expect(router.state.location.pathname).not.toContain('importar'));

    const saved = (await services.quoteReader.list()).find(
      (q) => q.client === 'EMPRESA DEMO' && q.contact === 'Otra persona',
    )!;
    expect(saved.status).toBe('draft');
    expect(itemCost(saved.items[0]!)).toBeCloseTo(2201733.33, 2);
    const totals = quoteTotals(saved);
    expect(totals.subtotal).toBe(2400000);
    expect(totals.vat).toBeCloseTo(456000, 6);
    expect(totals.total).toBeCloseTo(2856000, 6);
    expect(saved.items[0]!.costLines.every((line) => line.kind === 'fixed')).toBe(true);
  });

  it('los costos importados no aparecen en la vista para el cliente', async () => {
    const { XlsxQuoteImporter } = await import('@/infrastructure/xlsx/XlsxQuoteImporter');
    const services = createTestServices();
    const { draft } = await new XlsxQuoteImporter().import(fixture());
    const quote = await services.quoteWriter.create(draft);
    renderApp(`/cotizaciones/${quote.id}/cliente`, services);
    await screen.findByRole('heading', { name: 'Cotización' });
    const html = document.body.innerHTML;
    for (const text of [
      'MANO DE OBRA',
      'MDF 9MM',
      'riel',
      'Cotizacion de referencia',
      '2.201.733',
      'Fórmula',
    ]) {
      expect(html).not.toContain(text);
    }
    expect(flat(document.body.textContent)).toContain('$ 2.856.000');
  });

  it('un archivo dañado muestra un error comprensible y no guarda', async () => {
    const importer: QuoteImporter = {
      import: () => Promise.reject(new QuoteImportError('damaged')),
    };
    const services = createTestServices({ quoteImporter: importer });
    const create = vi.spyOn(services.quoteWriter, 'create');
    renderApp('/cotizaciones/importar', services);
    await upload(new File(['x'], 'danado.xlsx'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Puede estar dañado');
    expect(create).not.toHaveBeenCalled();
  });

  it('muestra los avisos en la vista previa y conserva el dato vacío', async () => {
    const importer: QuoteImporter = {
      import: () =>
        Promise.resolve({
          draft: {
            ...createEmptyQuoteDraft('2026-01-01'),
            client: 'ACME',
            items: [{ ...createEmptyItem('i'), product: 'Stand', quantity: 1, unitPrice: null }],
          },
          warnings: [{ message: 'Fila 14: falta el precio de venta.' }],
        }),
    };
    renderApp('/cotizaciones/importar', createTestServices({ quoteImporter: importer }));
    await upload(new File(['x'], 'incompleto.xlsx'));
    expect(await screen.findByText('1 aviso para revisar')).toBeInTheDocument();
    expect(screen.getByText('Fila 14: falta el precio de venta.')).toBeInTheDocument();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Valor unitario' }).value).toBe(
      '',
    );
  });

  it('pide confirmar antes de abandonar la vista previa', async () => {
    const user = userEvent.setup();
    const importer: QuoteImporter = {
      import: () =>
        Promise.resolve({
          draft: { ...createEmptyQuoteDraft('2026-01-01'), client: 'A' },
          warnings: [],
        }),
    };
    renderApp('/cotizaciones/importar', createTestServices({ quoteImporter: importer }));
    await upload(new File(['x'], 'a.xlsx'));
    await screen.findByRole('region', { name: 'Resumen' });
    await user.click(screen.getAllByRole('link', { name: 'Materiales' })[0]!);
    expect(await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
  });
});
