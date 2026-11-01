import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toClientQuoteView } from '@/domain/clientView';
import { itemCost, quoteTotals } from '@/domain/quote';
import { BrandLogo, brandLogoSources } from '@/features/brand/BrandLogo';
import { ClientQuoteDocument } from '@/features/quotes/ClientQuoteDocument';
import { seedQuotes } from '@/infrastructure/seed/seedData';
import { createTestServices, renderApp, SEED_QUOTE_ID } from './helpers';
import { fireEvent } from '@testing-library/react';

const flat = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

describe('listado', () => {
  it('muestra la cotización semilla con su total', async () => {
    renderApp('/');
    const table = await screen.findByRole('table', { hidden: true });
    expect(within(table).getByText('Carrito Demo')).toBeInTheDocument();
    expect(flat(table.textContent)).toContain('$ 2.856.000');
    expect(within(table).getByText('Borrador')).toBeInTheDocument();
  });

  it('busca y muestra un estado vacío sin resultados', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('table', { hidden: true });
    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'inexistente');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('filtra por estado', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('table', { hidden: true });
    await user.click(screen.getByRole('combobox', { name: 'Estado' }));
    await user.click(await screen.findByRole('option', { name: 'Aprobada' }));
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('duplica como una nueva opción', async () => {
    const user = userEvent.setup();
    const { services } = renderApp('/');
    const table = await screen.findByRole('table', { hidden: true });
    await user.click(
      within(table).getByRole('button', { name: 'Duplicar Carrito Demo', hidden: true }),
    );
    await waitFor(async () => expect(await services.quoteReader.list()).toHaveLength(2));
    expect(await within(table).findByText('Carrito Demo (copia)')).toBeInTheDocument();
  });

  it('muestra un error si el repositorio falla', async () => {
    const services = createTestServices({
      quoteReader: {
        list: () => Promise.reject(new Error('x')),
        get: () => Promise.reject(new Error('x')),
      },
    });
    renderApp('/', services);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
  });
});

describe('editor y hoja de costos', () => {
  it('muestra costo, precio y utilidad en el panel interno', async () => {
    const user = userEvent.setup();
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}`);
    const sheet = await screen.findByText('Hoja de costos');
    const panel = sheet.closest('section')!;
    expect(within(panel).getByText('Interno')).toBeInTheDocument();
    expect(flat(panel.textContent)).toContain('$ 2.201.733');
    expect(flat(panel.textContent)).toContain('$ 2.400.000');
    expect(flat(panel.textContent)).toContain('$ 198.267');
    await user.click(within(panel).getByRole('button', { name: 'Ver 11 líneas de costo' }));
    expect(within(panel).getAllByRole('textbox', { name: 'Línea' })).toHaveLength(11);
  });

  it('el total se recalcula y se guarda', async () => {
    const user = userEvent.setup();
    const { services } = renderApp(`/cotizaciones/${SEED_QUOTE_ID}`);
    const price = await screen.findByRole('textbox', { name: 'Valor unitario' });
    await user.clear(price);
    await user.type(price, '3.000.000');
    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(flat(summary.textContent)).toContain('$ 3.570.000');
    await user.click(within(summary).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(async () => {
      const saved = await services.quoteReader.get(SEED_QUOTE_ID);
      expect(saved.items[0]?.unitPrice).toBe(3000000);
      expect(quoteTotals(saved).total).toBeCloseTo(3570000, 6);
    });
    // Guardar no altera los decimales de los costos.
    const saved = await services.quoteReader.get(SEED_QUOTE_ID);
    expect(itemCost(saved.items[0]!)).toBeCloseTo(2201733.3333, 3);
  });

  it('valida el cliente obligatorio', async () => {
    const user = userEvent.setup();
    const { services } = renderApp('/cotizaciones/nueva');
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    await user.click(within(summary).getByRole('button', { name: 'Crear cotización' }));
    expect(await screen.findByText('Escribe el cliente.')).toBeInTheDocument();
    expect(await services.quoteReader.list()).toHaveLength(1);
  });

  it('crea una cotización con condiciones por defecto', async () => {
    const user = userEvent.setup();
    const { services, router } = renderApp('/cotizaciones/nueva');
    await user.type(await screen.findByRole('textbox', { name: 'Cliente' }), 'ACME');
    const summary = screen.getByRole('region', { name: 'Resumen' });
    await user.click(within(summary).getByRole('button', { name: 'Crear cotización' }));
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/cotizaciones/nueva'));
    const quotes = await services.quoteReader.list();
    const created = quotes.find((q) => q.client === 'ACME')!;
    expect(created.status).toBe('draft');
    expect(created.conditions).toHaveLength(7);
    expect(router.state.location.pathname).toBe(`/cotizaciones/${created.id}`);
  });

  it('pide confirmar antes de salir con cambios sin guardar', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/cotizaciones/${SEED_QUOTE_ID}`);
    await user.type(await screen.findByRole('textbox', { name: 'Cliente' }), ' X');
    await user.click(screen.getAllByRole('link', { name: 'Materiales' })[0]!);
    expect(await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/cotizaciones/${SEED_QUOTE_ID}`);
    await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/materiales'));
  });
});

describe('vista para el cliente', () => {
  const INTERNAL_TEXTS = [
    'Interno',
    'Utilidad',
    'Costo',
    'Factor',
    'Mano de obra',
    'MDF 12 mm (superficie',
    'Revisar',
    'Cotización de referencia',
    '2.201.733',
    '198.267',
    'Aceros Demo',
  ];

  it('no renderiza datos internos, ni siquiera ocultos', async () => {
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}/cliente`);
    await screen.findByRole('heading', { name: 'Cotización' });
    const html = document.body.innerHTML;
    for (const text of INTERNAL_TEXTS) expect(html).not.toContain(text);
  });

  it('muestra los datos del cliente y los totales', async () => {
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}/cliente`);
    await screen.findByRole('heading', { name: 'Cotización' });
    const text = flat(document.body.textContent);
    for (const expected of [
      'EMPRESA DEMO',
      'Ana Ejemplo',
      '15 de enero de 2026',
      'Carrito Demo',
      'Carrito de ejemplo',
      '$ 2.400.000',
      '$ 456.000',
      '$ 2.856.000',
      'Laura Prueba',
      'Luego de 5 días',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('el documento solo depende de ClientQuoteView', () => {
    const view = toClientQuoteView(seedQuotes()[0]!);
    const { container } = render(<ClientQuoteDocument view={view} />);
    for (const text of INTERNAL_TEXTS) expect(container.innerHTML).not.toContain(text);
  });

  it('un dato faltante se muestra como guion, no como 0', () => {
    const quote = seedQuotes()[0]!;
    const view = toClientQuoteView({
      ...quote,
      items: [{ ...quote.items[0]!, width: null, unitPrice: null }],
    });
    render(<ClientQuoteDocument view={view} />);
    const row = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', {
      hidden: true,
    })[1]!;
    expect(row.textContent).toContain('—');
  });
});

describe('catálogo de materiales', () => {
  it('lista precios y factores en un panel interno', async () => {
    renderApp('/materiales');
    const heading = await screen.findByText('Precios y factores');
    const panel = heading.closest('section')!;
    expect(within(panel).getByText('Interno')).toBeInTheDocument();
    expect(within(panel).getAllByText('MDF 9 mm').length).toBeGreaterThan(0);
  });

  it('edita un material y exige un factor mayor que 0', async () => {
    const user = userEvent.setup();
    const { services } = renderApp('/materiales');
    await screen.findByText('Precios y factores');
    const [edit] = screen.getAllByRole('button', { name: 'Editar MDF 9 mm', hidden: true });
    await user.click(edit!);
    const dialog = await screen.findByRole('dialog', { name: 'Editar material' });
    const factor = within(dialog).getByRole('textbox', { name: 'Factor' });
    await user.clear(factor);
    await user.type(factor, '0');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar material' }));
    expect(await within(dialog).findByText('El factor debe ser mayor que 0.')).toBeInTheDocument();
    await user.clear(factor);
    await user.type(factor, '0,5');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar material' }));
    await waitFor(async () => {
      const material = (await services.materialCatalog.list()).find((m) => m.name === 'MDF 9 mm');
      expect(material?.pricing).toMatchObject({ factor: 0.5 });
    });
  });
});

describe('ajustes', () => {
  it('restablece los datos de prueba tras confirmar', async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    await services.quoteWriter.duplicate(SEED_QUOTE_ID);
    renderApp('/ajustes', services);
    await user.click(await screen.findByRole('button', { name: 'Restablecer datos de prueba' }));
    await user.click(await screen.findByRole('button', { name: 'Restablecer' }));
    await waitFor(async () => expect(await services.quoteReader.list()).toHaveLength(1));
  });
});

describe('logo', () => {
  it('sigue el orden URL, archivo y texto', () => {
    expect(brandLogoSources('https://x/logo.png')).toEqual([
      'https://x/logo.png',
      '/brand/logo.png',
    ]);
    expect(brandLogoSources('')).toEqual(['/brand/logo.png']);
    expect(brandLogoSources(undefined)).toEqual(['/brand/logo.png']);
  });

  it('si ninguno carga, muestra el texto sin romper la pantalla', () => {
    render(<BrandLogo sources={['https://x/logo.png', '/brand/logo.png']} />);
    fireEvent.error(screen.getByRole('img', { name: 'Cotizador' }));
    const second = screen.getByRole('img', { name: 'Cotizador' });
    expect(second).toHaveAttribute('src', '/brand/logo.png');
    fireEvent.error(second);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Cotizador')).toBeInTheDocument();
  });
});
