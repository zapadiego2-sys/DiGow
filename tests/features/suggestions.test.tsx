import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { lineCost } from '@/domain/cost';
import { itemCost } from '@/domain/quote';
import { KeywordCostSuggester } from '@/infrastructure/suggestions/KeywordCostSuggester';
import { seedMaterials } from '@/infrastructure/seed/seedData';
import { renderApp } from './helpers';

const suggester = new KeywordCostSuggester();
const suggest = (text: string) => suggester.suggest(text, seedMaterials());
const labels = async (text: string) => (await suggest(text)).map((s) => s.line.label);

describe('sugerencias por palabras', () => {
  it('encuentra los materiales del catálogo, con plurales y sin distinguir tildes', async () => {
    expect(await labels('Carrito con 4 RUEDAS, bisagras, pasadores y vinilo')).toEqual(
      expect.arrayContaining([
        'Ruedas con freno',
        'Bisagra cápsula con aleta',
        'Pasadores',
        'Vinilo',
      ]),
    );
  });

  it('respeta la medida del material', async () => {
    const found = await labels('Estructura en mdf 12 mm');
    expect(found).toContain('MDF 12 mm');
    expect(found).not.toContain('MDF 9 mm');
  });

  it('no sugiere lo que el texto no menciona', async () => {
    expect(await labels('Mueble metálico pintado')).toEqual([]);
    expect(await labels('')).toEqual([]);
  });

  it('usa la cantidad escrita y calcula el costo', async () => {
    const [wheels] = await suggest('4 ruedas');
    expect(wheels?.missing).toBeNull();
    expect(wheels?.line).toMatchObject({ kind: 'unit', quantity: 4 });
    expect(lineCost(wheels!.line)).toBe(80000);
    const [words] = await suggest('seis pasadores');
    expect(words?.line).toMatchObject({ quantity: 6 });
  });

  it('no toma como cantidad un número de otro material', async () => {
    const found = await suggest('poliestireno cal 100 + lona roja');
    const canvas = found.find((s) => s.line.label === 'Lona roja');
    expect(canvas?.line).toMatchObject({ kind: 'area', areasCm2: [] });
  });

  it('sin cantidad no inventa un costo y pide el dato', async () => {
    const [wheels] = await suggest('con ruedas');
    expect(wheels?.line).toMatchObject({ quantity: 0 });
    expect(lineCost(wheels!.line)).toBe(0);
    expect(wheels?.missing).toBe('Escribe la cantidad.');
  });

  it('un material por área pide las áreas', async () => {
    const [vinyl] = await suggest('forrado en vinilo');
    expect(vinyl?.line).toMatchObject({ kind: 'area', costPerCm2: 6, materialId: 'mat-vinilo' });
    expect(vinyl?.missing).toBe('Escribe las áreas en cm².');
  });
});

async function startItem(user: ReturnType<typeof userEvent.setup>, description: string) {
  const result = renderApp('/cotizaciones/nueva');
  await user.type(await screen.findByRole('textbox', { name: 'Cliente' }), 'ACME');
  await user.click(screen.getAllByRole('button', { name: 'Agregar ítem' })[0]!);
  await user.type(await screen.findByRole('textbox', { name: 'Producto' }), 'Stand');
  await user.type(screen.getByRole('textbox', { name: 'Descripción' }), description);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Sugerir costos desde la descripción' }),
    ).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Sugerir costos desde la descripción' }));
  await screen.findByRole('region', { name: 'Sugerencias de costos' });
  return result;
}

describe('revisar las sugerencias', () => {
  it('solo lo aceptado entra a la cotización guardada', async () => {
    const user = userEvent.setup();
    const { services } = await startItem(user, '4 ruedas y 6 pasadores');

    // Sugerir no cambia nada todavía.
    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(screen.queryByRole('textbox', { name: 'Línea' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aceptar Ruedas con freno' }));
    await user.click(screen.getByRole('button', { name: 'Quitar sugerencia Pasadores' }));
    expect(screen.queryByRole('region', { name: 'Sugerencias de costos' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Línea' })).toHaveLength(1);

    await user.click(within(summary).getByRole('button', { name: 'Crear cotización' }));
    await waitFor(async () => {
      const quotes = await services.quoteReader.list();
      expect(quotes.some((q) => q.client === 'ACME')).toBe(true);
    });
    const saved = (await services.quoteReader.list()).find((q) => q.client === 'ACME')!;
    const item = saved.items[0]!;
    expect(item.costLines.map((l) => l.label)).toEqual(['Ruedas con freno']);
    expect(itemCost(item)).toBe(80000);
    // El precio de venta sigue siendo manual.
    expect(item.unitPrice).toBeNull();
  });

  it('aceptar todas agrega cada línea y no vuelve a sugerirlas', async () => {
    const user = userEvent.setup();
    await startItem(user, '4 ruedas y 6 pasadores');
    await user.click(screen.getByRole('button', { name: 'Aceptar todas (2)' }));
    expect(screen.getAllByRole('textbox', { name: 'Línea' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Sugerir costos desde la descripción' }));
    expect(await screen.findByText(/No hay materiales nuevos/)).toBeInTheDocument();
  });

  it('no se puede sugerir sin descripción', async () => {
    const user = userEvent.setup();
    renderApp('/cotizaciones/nueva');
    await screen.findByRole('textbox', { name: 'Cliente' });
    await user.click(screen.getAllByRole('button', { name: 'Agregar ítem' })[0]!);
    expect(
      await screen.findByRole('button', { name: 'Sugerir costos desde la descripción' }),
    ).toBeDisabled();
  });
});
