import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { RuleError } from '@/domain/errors';
import { materialCost } from '@/domain/material';
import { createEmptyItem, createEmptyQuoteDraft } from '@/domain/quote';
import { createMockServices } from '@/infrastructure/mock/createMockServices';
import { createMemoryStore } from '@/infrastructure/mock/storage';
import { DEMO_PASSWORD, USER_IDS } from '@/infrastructure/seed/accessSeed';
import { SEED_IDS } from '@/infrastructure/seed/seedData';
import { HistoricalCostSuggester } from '@/infrastructure/suggestions/HistoricalCostSuggester';
import {
  parseMaterialSheet,
  XlsxMaterialImporter,
} from '@/infrastructure/xlsx/XlsxMaterialImporter';
import {
  describeCrudContract,
  describeMaterialImportContract,
} from '../contracts/repositories.contract';
import { instant, suggestionRequest } from '../features/helpers';

const services = () => createMockServices(createMemoryStore(), instant);
const rule = (code: string) => expect.objectContaining({ name: RuleError.name, code });

describeCrudContract('roles', () => services().roleCatalog, {
  draft: { name: 'Rol de prueba', description: '', permissions: ['quotes.create'] },
  change: (role) => ({ ...role, name: 'Otro nombre' }),
});
describeCrudContract('flujos', () => services().workflowCatalog, {
  draft: {
    name: 'Flujo de prueba',
    description: '',
    active: true,
    isDefault: false,
    steps: [
      {
        id: 's',
        name: 'Paso',
        roleId: 'role-analyst',
        assignment: 'workload',
        instructions: '',
        gate: 'none',
      },
    ],
  },
  change: (workflow) => ({ ...workflow, name: 'Otro nombre' }),
});
describeCrudContract('plantillas', () => services().templateCatalog, {
  draft: {
    name: 'Plantilla de prueba',
    description: '',
    active: true,
    workflowId: null,
    fields: [],
    measures: { width: true, height: true, depth: true },
    measureUnit: 'cm',
    standardSizes: [],
    conditionsTemplateId: null,
    vatRate: 0.19,
  },
  change: (template) => ({ ...template, name: 'Otro nombre' }),
});
describeMaterialImportContract('memoria', () => services().materialCatalog);

describe('inicio de sesión simulado', () => {
  it('ingresa con la contraseña correcta y conserva la sesión', async () => {
    const store = createMemoryStore();
    const { authenticator } = createMockServices(store, instant);
    const session = await authenticator.signIn('  ASESORA@demo.co ', DEMO_PASSWORD);
    expect(session.user.id).toBe(USER_IDS.advisor);
    expect(session.role.name).toBe('Cotizador (asesor)');
    // Otra instancia sobre el mismo almacenamiento ve la sesión abierta.
    const again = createMockServices(store, instant).authenticator;
    await expect(again.currentSession()).resolves.toMatchObject({ user: { id: USER_IDS.advisor } });
    await again.signOut();
    await expect(authenticator.currentSession()).resolves.toBeNull();
  });

  it('el mismo error para correo desconocido y contraseña incorrecta', async () => {
    const { authenticator } = services();
    await expect(authenticator.signIn('nadie@demo.co', DEMO_PASSWORD)).rejects.toEqual(
      rule('invalid-credentials'),
    );
    await expect(authenticator.signIn('asesora@demo.co', 'otra')).rejects.toEqual(
      rule('invalid-credentials'),
    );
  });

  it('no guarda la contraseña en texto plano', async () => {
    const store = createMemoryStore();
    const { userDirectory } = createMockServices(store, instant);
    await userDirectory.create({
      name: 'Nueva',
      email: 'nueva@demo.co',
      title: '',
      roleId: 'role-advisor',
      active: true,
      password: 'secreta123',
    });
    expect(store.getItem('cotizador:credentials:v1')).not.toContain('secreta123');
  });

  it('un usuario desactivado no ingresa y pierde la sesión', async () => {
    const { authenticator, userDirectory } = services();
    await authenticator.signIn('asesora@demo.co', DEMO_PASSWORD);
    const advisor = (await userDirectory.list()).find((u) => u.id === USER_IDS.advisor)!;
    await userDirectory.update({ ...advisor, active: false });
    await expect(authenticator.currentSession()).resolves.toBeNull();
    await expect(authenticator.signIn('asesora@demo.co', DEMO_PASSWORD)).rejects.toEqual(
      rule('inactive-user'),
    );
  });

  it('cambiar la contraseña invalida la anterior', async () => {
    const { authenticator, userDirectory } = services();
    await userDirectory.setPassword(USER_IDS.analyst, 'nueva-clave');
    await expect(authenticator.signIn('analista1@demo.co', DEMO_PASSWORD)).rejects.toEqual(
      rule('invalid-credentials'),
    );
    await expect(authenticator.signIn('analista1@demo.co', 'nueva-clave')).resolves.toBeTruthy();
  });
});

describe('reglas de usuarios y roles', () => {
  it('no permite dos usuarios con el mismo correo', async () => {
    const { userDirectory } = services();
    await expect(
      userDirectory.create({
        name: 'Copia',
        email: 'Admin@Demo.co',
        title: '',
        roleId: 'role-advisor',
        active: true,
        password: 'x'.repeat(8),
      }),
    ).rejects.toEqual(rule('email-taken'));
  });

  it('no deja el sistema sin super admin', async () => {
    const { userDirectory } = services();
    const admin = (await userDirectory.list()).find((u) => u.id === USER_IDS.admin)!;
    await expect(userDirectory.update({ ...admin, roleId: 'role-advisor' })).rejects.toEqual(
      rule('last-admin'),
    );
  });

  it('el rol de super admin no se edita; un rol en uso no se borra', async () => {
    const { roleCatalog } = services();
    const [superAdmin] = (await roleCatalog.list()).filter((r) => r.id === 'role-superadmin');
    await expect(roleCatalog.update({ ...superAdmin!, permissions: [] })).rejects.toEqual(
      rule('system-role'),
    );
    await expect(roleCatalog.remove('role-analyst')).rejects.toEqual(rule('system-role'));
    const custom = await roleCatalog.create({ name: 'Temporal', description: '', permissions: [] });
    await roleCatalog.remove(custom.id);
    expect((await roleCatalog.list()).some((r) => r.id === custom.id)).toBe(false);
  });
});

describe('flujos configurados', () => {
  it('siempre hay exactamente un flujo por defecto', async () => {
    const { workflowCatalog } = services();
    const all = await workflowCatalog.list();
    const standard = all.find((w) => w.id === 'wf-estandar');
    const express = all.find((w) => w.id === 'wf-rapido');
    expect(standard?.isDefault).toBe(true);
    await expect(workflowCatalog.update({ ...standard!, isDefault: false })).rejects.toEqual(
      rule('default-required'),
    );
    await workflowCatalog.update({ ...express!, isDefault: true });
    const defaults = (await workflowCatalog.list()).filter((w) => w.isDefault);
    expect(defaults.map((w) => w.id)).toEqual([express!.id]);
  });

  it('un flujo necesita al menos un paso', async () => {
    const { workflowCatalog } = services();
    const [first] = await workflowCatalog.list();
    await expect(workflowCatalog.update({ ...first!, steps: [] })).rejects.toEqual(
      rule('workflow-empty'),
    );
  });
});

/** Una cotización con un ítem listo para aprobar medidas y costos. */
function completeDraft() {
  return {
    ...createEmptyQuoteDraft('2026-03-01'),
    client: 'X',
    items: [
      {
        ...createEmptyItem('item-completo'),
        product: 'Aviso',
        kind: 'external' as const,
        width: 100,
        height: 50,
        depth: 10,
        quantity: 1,
        unitPrice: 50000,
        costLines: [
          {
            id: 'l',
            kind: 'fixed' as const,
            label: 'Impresión',
            note: '',
            materialId: null,
            value: 30000,
          },
        ],
      },
    ],
  };
}

describe('servicio de flujo', () => {
  it('la solicitud del asesor se asigna a la analista con menos tareas', async () => {
    const { quoteWriter, quoteWorkflow } = services();
    // Marta ya tiene la solicitud semilla en costeo; Pedro no tiene tareas.
    const quote = await quoteWriter.create({
      ...createEmptyQuoteDraft('2026-03-01'),
      client: 'Nuevo',
      createdBy: USER_IDS.advisor,
    });
    const started = await quoteWorkflow.start(quote.id, USER_IDS.advisor, null);
    expect(started.workflow).toMatchObject({
      currentStepId: 'step-solicitud',
      assigneeId: USER_IDS.advisor,
    });
    const sent = await quoteWorkflow.advance(quote.id, USER_IDS.advisor, 'Urgente');
    expect(sent.workflow).toMatchObject({
      currentStepId: 'step-medidas',
      assigneeId: USER_IDS.analyst2,
    });
    await expect(quoteWorkflow.workload()).resolves.toMatchObject({
      [USER_IDS.analyst]: 1,
      [USER_IDS.analyst2]: 1,
    });
  });

  it('solo el responsable o quien gestiona flujos puede moverla', async () => {
    const { quoteWorkflow } = services();
    await expect(quoteWorkflow.advance(SEED_IDS.request, USER_IDS.analyst2, '')).rejects.toEqual(
      rule('not-assignee'),
    );
    await expect(
      quoteWorkflow.reassign(SEED_IDS.request, USER_IDS.analyst, USER_IDS.analyst2),
    ).rejects.toEqual(rule('not-assignee'));
    const moved = await quoteWorkflow.reassign(SEED_IDS.request, USER_IDS.admin, USER_IDS.analyst2);
    expect(moved.workflow?.assigneeId).toBe(USER_IDS.analyst2);
  });

  it('devuelve al asesor que hizo la solicitud', async () => {
    const { quoteWorkflow } = services();
    const back = await quoteWorkflow.sendBack(SEED_IDS.request, USER_IDS.analyst, 'Faltan medidas');
    expect(back.workflow).toMatchObject({
      currentStepId: 'step-solicitud',
      assigneeId: USER_IDS.advisor2,
    });
  });

  it('al terminar el flujo la cotización queda enviada', async () => {
    const { quoteWriter, quoteWorkflow } = services();
    const quote = await quoteWriter.create(completeDraft());
    await quoteWorkflow.start(quote.id, USER_IDS.admin, 'wf-rapido');
    const costing = await quoteWorkflow.advance(quote.id, USER_IDS.admin, '');
    expect(costing.status).toBe('draft');
    const done = await quoteWorkflow.advance(quote.id, USER_IDS.admin, '');
    expect(done.workflow?.currentStepId).toBeNull();
    expect(done.status).toBe('sent');
  });

  it('usa el flujo que indica la plantilla', async () => {
    const { quoteWriter, quoteWorkflow } = services();
    const quote = await quoteWriter.create({ ...createEmptyQuoteDraft('2026-03-01'), client: 'X' });
    const started = await quoteWorkflow.start(quote.id, USER_IDS.admin, 'wf-rapido');
    expect(started.workflow?.workflowName).toBe('Cotización rápida');
  });
});

describe('sugerencia por historial', () => {
  const exhibitor = suggestionRequest({
    quoteId: SEED_IDS.request,
    itemId: 'item-carrito-exhibicion',
    catalogItemId: 'cat-carrito',
    product: 'Carrito de exhibición',
    description:
      'Carrito en mdf 9mm y mdf 12mm, forrado en vinilo, con ruedas con freno y bisagras',
    width: 100,
    height: 180,
    depth: 60,
  });

  it('propone las líneas del ítem más parecido con los precios de hoy y las medidas del ítem', async () => {
    const { quoteReader, materialCatalog, productCatalog } = services();
    const mdf = (await materialCatalog.list()).find((m) => m.id === 'mat-mdf-9')!;
    await materialCatalog.update({
      ...mdf,
      pricing: { mode: 'factor', purchasePrice: 100000, factor: 0.5, sheetAreaCm2: null },
    });
    const result = await new HistoricalCostSuggester(quoteReader, productCatalog).suggest(
      exhibitor,
      await materialCatalog.list(),
    );
    // La góndola se parece más que el carrito: mismo material y medidas más cercanas.
    expect(result.similar.map((s) => s.project)).toEqual(['Góndola Demo', 'Carrito Demo']);
    expect(result.similar[0]!.similarity).toBeGreaterThan(0.3);

    const fromHistory = result.suggestions.filter((s) => s.source.kind === 'history');
    expect(fromHistory.map((s) => s.line.label)).toEqual([
      'MDF 9 mm',
      'Vinilo',
      'Ruedas con freno',
      'Mano de obra',
    ]);
    const mdfLine = fromHistory.find((s) => s.line.materialId === 'mat-mdf-9')!;
    expect(mdfLine.line).toMatchObject({ kind: 'unit', quantity: 2, unitCost: 200000 });
    // El vinilo se calcula por ancho × alto del ítem nuevo: no hay que ajustarlo a mano.
    const vinyl = fromHistory.find((s) => s.line.materialId === 'mat-vinilo')!;
    expect(vinyl.line).toMatchObject({ kind: 'area', areasCm2: [100 * 180] });
    expect(vinyl.missing).toBeNull();
    expect(fromHistory.map((s) => s.line.id)).not.toContain('line-gondola-mdf');
  });

  it('propone los sub-ítems del parecido con sus costos y los que el catálogo liga', async () => {
    const { quoteReader, materialCatalog, productCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader, productCatalog).suggest(
      exhibitor,
      await materialCatalog.list(),
    );
    expect(result.subItems.map((s) => [s.name, s.source.kind, s.lines.length])).toEqual([
      ['Cabezote iluminado', 'history', 2],
      ['Juego de ruedas con freno', 'catalog', 0],
    ]);
    const existing = suggestionRequest({
      ...exhibitor,
      existingSubItems: [{ name: 'Cabezote iluminado', catalogSubItemId: 'sub-cabezote' }],
    });
    const again = await new HistoricalCostSuggester(quoteReader, productCatalog).suggest(
      existing,
      await materialCatalog.list(),
    );
    expect(again.subItems.map((s) => s.name)).toEqual(['Juego de ruedas con freno']);
  });

  it('un ítem sin la marca predictiva no recibe sugerencias del historial', async () => {
    const { quoteReader, materialCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      suggestionRequest({ ...exhibitor, predictive: false }),
      await materialCatalog.list(),
    );
    expect(result.similar).toEqual([]);
    expect(result.suggestions.every((s) => s.source.kind === 'catalog')).toBe(true);
  });

  it('un ítem del historial sin la marca predictiva no se usa como referencia', async () => {
    const { quoteReader, quoteWriter, materialCatalog } = services();
    const gondola = await quoteReader.get(SEED_IDS.gondola);
    await quoteWriter.update({
      ...gondola,
      items: gondola.items.map((item) => ({ ...item, predictive: false })),
    });
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      exhibitor,
      await materialCatalog.list(),
    );
    expect(result.similar.map((s) => s.project)).toEqual(['Carrito Demo']);
  });

  it('compara las medidas en la misma unidad', async () => {
    const { quoteReader, materialCatalog } = services();
    const inMeters = suggestionRequest({
      ...exhibitor,
      width: 1,
      height: 1.8,
      depth: 0.6,
      measureUnit: 'm',
    });
    const [cm, m] = await Promise.all([
      new HistoricalCostSuggester(quoteReader).suggest(exhibitor, await materialCatalog.list()),
      new HistoricalCostSuggester(quoteReader).suggest(inMeters, await materialCatalog.list()),
    ]);
    expect(m.similar[0]!.similarity).toBeCloseTo(cm.similar[0]!.similarity, 9);
  });

  it('no compara un ítem consigo mismo', async () => {
    const { quoteReader, materialCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      suggestionRequest({
        quoteId: SEED_IDS.cart,
        itemId: 'item-carrito-ejemplo',
        product: 'Carrito de ejemplo',
        description: 'Mdf 9mm + mdf 12mm + poliestireno + parales + lona roja + bisagras',
        width: 120,
        height: 190,
        depth: 70,
      }),
      await materialCatalog.list(),
    );
    expect(result.similar.map((s) => s.quoteId)).not.toContain(SEED_IDS.cart);
  });

  it('sin parecidos, sugiere solo desde el catálogo y calcula el área con las medidas', async () => {
    const { quoteReader, materialCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      suggestionRequest({
        product: 'Aviso',
        description: 'Aviso en vinilo',
        width: 50,
        height: 40,
      }),
      await materialCatalog.list(),
    );
    expect(result.similar).toEqual([]);
    expect(result.suggestions.map((s) => [s.line.label, s.missing])).toEqual([['Vinilo', null]]);
    expect(result.suggestions[0]!.line).toMatchObject({ kind: 'area', areasCm2: [2000] });
  });
});

async function sheetWith(rows: unknown[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Materiales');
  rows.forEach((row) => sheet.addRow(row));
  return sheet;
}

describe('carga de materiales desde Excel', () => {
  const HEADERS = [
    'Nombre',
    'Proveedor',
    'Precio de compra',
    'Factor',
    'Área de la lámina (cm2)',
    'Costo directo',
  ];

  it('lee materiales por factor, por lámina y de costo directo', async () => {
    const { rows, warnings } = parseMaterialSheet(
      await sheetWith([
        ['Inventario de prueba'],
        HEADERS,
        ['MDF 15 mm', 'Proveedor Demo', 150000, 0.5, null, null],
        ['Acrílico 3 mm', '', '200.000', '0,75', 10000, null],
        ['Adhesivo', '', null, null, null, 3],
        [],
      ]),
    );
    expect(warnings).toEqual([]);
    expect(rows.map((r) => [r.row, r.name, r.errors])).toEqual([
      [3, 'MDF 15 mm', []],
      [4, 'Acrílico 3 mm', []],
      [5, 'Adhesivo', []],
    ]);
    expect(materialCost(rows[0]!.draft!)).toBe(300000);
    expect(materialCost(rows[1]!.draft!)).toBeCloseTo(200000 / 0.75 / 10000, 6);
    expect(rows[2]!.draft!.pricing).toEqual({ mode: 'direct', unitCost: 3 });
  });

  it('nunca inventa un dato: una fila incompleta queda con errores', async () => {
    const { rows } = parseMaterialSheet(
      await sheetWith([
        HEADERS,
        ['Sin factor', '', 1000, null, null, null],
        ['Factor cero', '', 1000, 0, null, null],
        ['Ambos', '', 1000, 0.5, null, 4],
        ['', '', 1000, 0.5, null, null],
        ['Texto', '', 'mil', 0.5, null, null],
      ]),
    );
    expect(rows.every((r) => r.draft === null)).toBe(true);
    expect(rows.map((r) => r.errors[0])).toEqual([
      'Falta el factor.',
      'El factor debe ser mayor que 0.',
      'Escribe el precio de compra y el factor, o el costo directo, pero no ambos.',
      'Falta el nombre.',
      'El precio de compra no es un número.',
    ]);
  });

  it('avisa un nombre repetido y carga solo la última fila', async () => {
    const { rows, warnings } = parseMaterialSheet(
      await sheetWith([
        HEADERS,
        ['Vinilo', '', null, null, null, 6],
        ['vinilo', '', null, null, null, 7],
      ]),
    );
    expect(warnings[0]?.message).toContain('aparece en las filas 2 y 3');
    expect(rows.filter((r) => r.draft).map((r) => r.draft!.pricing)).toEqual([
      { mode: 'direct', unitCost: 7 },
    ]);
  });

  it('un archivo sin encabezados se rechaza con un error comprensible', async () => {
    expect(() => parseMaterialSheet(new ExcelJS.Workbook().addWorksheet('x'))).toThrow(
      expect.objectContaining({ code: 'no-material-headers' }),
    );
  });

  it('la plantilla descargable se puede volver a leer', async () => {
    const importer = new XlsxMaterialImporter();
    const blob = await importer.template();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const file = new File([bytes], 'plantilla.xlsx');
    file.arrayBuffer = () => Promise.resolve(bytes.buffer.slice(0));
    const { rows } = await importer.read(file);
    expect(rows.map((r) => [r.name, r.draft?.unit])).toEqual([
      ['MDF 15 mm', 'unit'],
      ['Acrílico 3 mm', 'cm2'],
      ['Lona impresa', 'm2'],
      ['Perfil de aluminio', 'linear_m'],
    ]);
    expect(rows.every((r) => r.draft)).toBe(true);
  });

  it('solo acepta .xlsx', async () => {
    await expect(
      new XlsxMaterialImporter().read(new File(['x'], 'datos.csv')),
    ).rejects.toMatchObject({
      code: 'invalid-type',
    });
  });
});
