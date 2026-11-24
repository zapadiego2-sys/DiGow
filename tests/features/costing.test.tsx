import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { latestVersion } from '@/domain/conditions';
import { itemCost } from '@/domain/quote';
import { HistoricalCostSuggester } from '@/infrastructure/suggestions/HistoricalCostSuggester';
import {
  createTestServices,
  NEW_STANDARD_QUOTE,
  renderApp,
  SEED_QUOTE_ID,
  SEED_REQUEST_ID,
  USER_IDS,
} from './helpers';

const as = (userId: string) => createTestServices({}, { userId });

async function choose(user: ReturnType<typeof userEvent.setup>, combobox: string, option: string) {
  await user.click(screen.getAllByRole('combobox', { name: combobox })[0]!);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('cotizador sin valores monetarios', () => {
  it('no ve precios, IVA ni hoja de costos, y el asesor es él mismo', async () => {
    const user = userEvent.setup();
    renderApp(NEW_STANDARD_QUOTE, as(USER_IDS.advisor));
    const advisor = await screen.findByRole('textbox', { name: 'Asesor' });
    expect(advisor).toHaveValue('Laura Prueba');
    expect(advisor).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Cargo del asesor' })).toHaveValue(
      'Gestora de proyectos',
    );
    expect(screen.queryByRole('textbox', { name: 'IVA (%)' })).not.toBeInTheDocument();
    expect(screen.getByText(/Los precios los define el analista/)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Agregar ítem' })[0]!);
    await screen.findByRole('textbox', { name: 'Producto' });
    expect(screen.queryByRole('textbox', { name: 'Valor unitario' })).not.toBeInTheDocument();
    expect(screen.queryByText('Hoja de costos')).not.toBeInTheDocument();
    expect(screen.getByText('El precio lo define el analista de costos.')).toBeInTheDocument();
  });

  it('el super admin puede cambiar el asesor', async () => {
    renderApp(NEW_STANDARD_QUOTE, as(USER_IDS.admin));
    expect(await screen.findByRole('textbox', { name: 'Asesor' })).toBeEnabled();
  });

  it('al guardar sin permiso de costos se conservan los costos y el precio', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.advisor);
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}`, services);
    const contact = await screen.findByRole('textbox', { name: 'Contacto' });
    await user.clear(contact);
    await user.type(contact, 'Nueva persona');
    await user.click(
      within(screen.getByRole('region', { name: 'Resumen' })).getByRole('button', {
        name: 'Guardar cambios',
      }),
    );
    await waitFor(async () => {
      const saved = await services.quoteReader.get(SEED_QUOTE_ID);
      expect(saved.contact).toBe('Nueva persona');
      expect(saved.items[0]!.costLines).toHaveLength(11);
      expect(saved.items[0]!.unitPrice).toBe(2400000);
      expect(itemCost(saved.items[0]!)).toBeCloseTo(2201733.33, 2);
    });
  });
});

describe('medidas', () => {
  it('cambiar la unidad convierte las medidas escritas', async () => {
    const user = userEvent.setup();
    renderApp(NEW_STANDARD_QUOTE, as(USER_IDS.analyst));
    await user.click((await screen.findAllByRole('button', { name: 'Agregar ítem' }))[0]!);
    await user.type(await screen.findByRole('textbox', { name: 'Ancho (cm)' }), '120');
    await choose(user, 'Unidad de las medidas', 'Metros (m)');
    expect(await screen.findByRole('textbox', { name: 'Ancho (m)' })).toHaveValue('1,2');
  });

  it('una medida estándar de la plantilla se copia al ítem', async () => {
    const user = userEvent.setup();
    renderApp('/cotizaciones/nueva?plantilla=tpl-punto-venta', as(USER_IDS.analyst));
    await user.click((await screen.findAllByRole('button', { name: 'Agregar ítem' }))[0]!);
    await choose(user, 'Medida estándar', 'Góndola');
    expect(screen.getByRole('textbox', { name: 'Ancho (cm)' })).toHaveValue('100');
    expect(screen.getByRole('textbox', { name: 'Alto (cm)' })).toHaveValue('200');
  });

  it('elegir un producto del catálogo trae su tipo y sus sub-ítems ligados', async () => {
    const user = userEvent.setup();
    renderApp(NEW_STANDARD_QUOTE, as(USER_IDS.advisor));
    await user.click((await screen.findAllByRole('button', { name: 'Agregar ítem' }))[0]!);
    await screen.findByRole('textbox', { name: 'Producto' });
    await choose(user, 'Producto del catálogo', 'Carrito');
    expect(screen.getByRole('textbox', { name: 'Producto' })).toHaveValue('Carrito');
    expect(screen.getAllByText('Producto interno').length).toBeGreaterThan(0);
    const subItems = screen.getAllByRole('textbox', { name: 'Sub-ítem' });
    expect(subItems.map((input) => (input as HTMLInputElement).value)).toEqual([
      'Cabezote iluminado',
      'Juego de ruedas con freno',
    ]);
  });
});

describe('flujo del analista en dos pasos', () => {
  it('aprueba las medidas y luego no puede aprobar costos sin hoja de costos ni precio', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.analyst);
    renderApp(`/cotizaciones/${SEED_REQUEST_ID}`, services);
    await user.click(await screen.findByRole('button', { name: 'Enviar a Aprobar costos' }));
    await waitFor(async () =>
      expect((await services.quoteReader.get(SEED_REQUEST_ID)).workflow?.currentStepId).toBe(
        'step-costeo',
      ),
    );
    const warning = await screen.findByText('Para enviar a Revisión y envío falta:');
    expect(warning.closest('[role="status"]')).toHaveTextContent('la hoja de costos está vacía');
    expect(screen.getByRole('button', { name: 'Enviar a Revisión y envío' })).toBeDisabled();
  });

  it('sugiere los sub-ítems del historial y los agrega con sus costos', async () => {
    const user = userEvent.setup();
    const base = createTestServices({}, { userId: USER_IDS.analyst });
    const services = {
      ...base,
      costSuggester: new HistoricalCostSuggester(base.quoteReader, base.productCatalog),
    };
    renderApp(`/cotizaciones/${SEED_REQUEST_ID}`, services);
    await user.click(
      await screen.findByRole('button', { name: 'Sugerir costos desde la descripción' }),
    );
    const section = await screen.findByRole('region', { name: 'Sub-ítems sugeridos' });
    expect(
      within(section).getByText('Este ítem puede tener costos en sub-ítems'),
    ).toBeInTheDocument();
    await user.click(
      within(section).getByRole('button', { name: 'Agregar sub-ítem Cabezote iluminado' }),
    );
    const costs = await screen.findByRole('region', { name: 'Costos de los sub-ítems' });
    expect(within(costs).getByText('Cabezote iluminado')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Sub-ítem' })[0]).toHaveValue(
      'Cabezote iluminado',
    );
  });

  it('una línea por fórmula toma las medidas del ítem y muestra la fórmula aplicada', async () => {
    const user = userEvent.setup();
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}`, as(USER_IDS.admin));
    const sheet = (await screen.findByText('Hoja de costos')).closest('section')!;
    await user.click(within(sheet).getByRole('button', { name: 'Ver 11 líneas de costo' }));
    await user.click(within(sheet).getByRole('button', { name: 'Agregar línea' }));
    const types = within(sheet).getAllByRole('combobox', { name: 'Tipo' });
    await user.click(types.at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Fórmula' }));
    const formulas = await within(sheet).findAllByRole('combobox', { name: 'Fórmula' });
    await user.click(formulas.at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Mano de obra por área' }));
    // 1,2 × 1,9 m = 2,28 m² × 80.000 = 182.400, mayor que el mínimo de 150.000.
    expect(await within(sheet).findByText('max(minimo; area_m2 * tarifa)')).toBeInTheDocument();
    expect(within(sheet).getByText('Fórmula: Mano de obra por área v1')).toBeInTheDocument();
    const lines = within(sheet).getAllByText('Costo de la línea');
    expect(lines.at(-1)!.parentElement).toHaveTextContent('$ 182.400');
  });
});

describe('condiciones con versiones en la cotización', () => {
  it('conserva la versión aplicada y ofrece la más reciente', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.advisor);
    const [standard] = (await services.conditionsCatalog.list()).filter(
      (c) => c.id === 'cond-estandar',
    );
    await services.conditionsCatalog.publish(
      'cond-estandar',
      { ...latestVersion(standard!), validity: '45 días' },
      USER_IDS.admin,
    );
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}`, services);
    expect(await screen.findByText(/Condiciones estándar · versión 1/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Validez de la oferta' })).toHaveValue('30 días');
    await user.click(await screen.findByRole('button', { name: 'Usar la versión 2' }));
    expect(screen.getByRole('textbox', { name: 'Validez de la oferta' })).toHaveValue('45 días');
    expect(screen.getByText(/Condiciones estándar · versión 2/)).toBeInTheDocument();
  });
});

describe('administración de costeo', () => {
  it('crea una fórmula y rechaza una variable que no existe', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    renderApp('/admin/formulas', services);
    await user.click(await screen.findByRole('button', { name: 'Nueva fórmula' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nueva fórmula' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Pintura');
    await user.type(within(dialog).getByRole('textbox', { name: 'Fórmula' }), 'area * costo');
    await user.click(within(dialog).getByRole('button', { name: 'Crear fórmula' }));
    expect(await within(dialog).findAllByText('La variable "area" no existe.')).not.toHaveLength(0);
    const expression = within(dialog).getByRole('textbox', { name: 'Fórmula' });
    await user.clear(expression);
    await user.type(expression, 'area_m2 * costo * 2');
    await user.click(within(dialog).getByRole('button', { name: 'Crear fórmula' }));
    await waitFor(async () =>
      expect((await services.formulaCatalog.list()).some((f) => f.name === 'Pintura')).toBe(true),
    );
  });

  it('editar unas condiciones publica una versión nueva', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    renderApp('/admin/condiciones', services);
    await user.click(await screen.findByRole('button', { name: 'Editar Condiciones estándar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar Condiciones estándar' });
    const validity = within(dialog).getByRole('textbox', { name: 'Validez de la oferta' });
    await user.clear(validity);
    await user.type(validity, '60 días');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar y publicar' }));
    await waitFor(async () => {
      const [standard] = (await services.conditionsCatalog.list()).filter(
        (c) => c.id === 'cond-estandar',
      );
      expect(standard!.versions.map((v) => v.validity)).toEqual(['30 días', '60 días']);
    });
  });

  it('crea un producto externo y un sub-ítem ligado', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    renderApp('/admin/catalogo', services);
    await user.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo producto' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Pendón');
    await user.click(within(dialog).getByRole('combobox', { name: 'Tipo de producto' }));
    await user.click(await screen.findByRole('option', { name: 'Producto externo' }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear producto' }));
    await waitFor(async () =>
      expect(
        (await services.productCatalog.listItems()).find((i) => i.name === 'Pendón'),
      ).toMatchObject({
        kind: 'external',
        predictive: true,
      }),
    );
  });

  it('el material define su unidad y cómo se desprende la cantidad', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.analyst);
    renderApp('/materiales', services);
    await user.click(await screen.findByRole('button', { name: 'Nuevo material' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo material' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Perfil');
    await user.click(within(dialog).getByRole('combobox', { name: 'Forma de costeo' }));
    await user.click(await screen.findByRole('option', { name: 'Costo directo' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Costo' }), '25000');
    await user.click(within(dialog).getByRole('combobox', { name: 'Unidad del costo' }));
    await user.click(await screen.findByRole('option', { name: 'metro lineal' }));
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Cantidad desde las medidas del ítem' }),
    );
    await user.click(await screen.findByRole('option', { name: 'Perímetro de ancho y alto' }));
    await user.click(within(dialog).getByRole('button', { name: 'Guardar material' }));
    await waitFor(async () =>
      expect(
        (await services.materialCatalog.list()).find((m) => m.name === 'Perfil'),
      ).toMatchObject({
        unit: 'linear_m',
        quantityRule: 'perimeter_width_height',
      }),
    );
  });
});
