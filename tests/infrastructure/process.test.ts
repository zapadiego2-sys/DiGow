import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { RuleError } from '@/domain/errors';
import { materialCost } from '@/domain/material';
import { createEmptyQuoteDraft } from '@/domain/quote';
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
import { instant } from '../features/helpers';

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
      { id: 's', name: 'Paso', roleId: 'role-analyst', assignment: 'workload', instructions: '' },
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
    conditions: [],
    paymentTerms: '',
    validity: '',
    deliveryTime: '',
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
      currentStepId: 'step-costeo',
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
    const quote = await quoteWriter.create({ ...createEmptyQuoteDraft('2026-03-01'), client: 'X' });
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
  it('encuentra el carrito anterior y propone sus líneas con los precios actuales', async () => {
    const { quoteReader, materialCatalog } = services();
    const materials = await materialCatalog.list();
    const mdf = materials.find((m) => m.id === 'mat-mdf-9')!;
    await materialCatalog.update({
      ...mdf,
      pricing: { mode: 'factor', purchasePrice: 100000, factor: 0.5, sheetAreaCm2: null },
    });
    const suggester = new HistoricalCostSuggester(quoteReader);
    const result = await suggester.suggest(
      {
        quoteId: SEED_IDS.request,
        itemId: 'item-carrito-exhibicion',
        product: 'Carrito de exhibición',
        description:
          'Carrito en mdf 9mm y mdf 12mm, forrado en vinilo, con ruedas con freno y bisagras',
        width: 100,
        height: 180,
        depth: 60,
      },
      await materialCatalog.list(),
    );
    expect(result.similar[0]).toMatchObject({ quoteId: SEED_IDS.cart, project: 'Carrito Demo' });
    expect(result.similar[0]!.similarity).toBeGreaterThan(0.3);
    // El MDF subió de 90.000 a 100.000: el costo de hoy es 2 × 20.000 más alto.
    expect(result.similar[0]!.currentUnitCost - result.similar[0]!.unitCost).toBeCloseTo(40000, 2);

    const fromHistory = result.suggestions.filter((s) => s.source.kind === 'history');
    expect(fromHistory).toHaveLength(11);
    const mdfLine = fromHistory.find((s) => s.line.materialId === 'mat-mdf-9')!;
    expect(mdfLine.line).toMatchObject({ kind: 'unit', quantity: 2, unitCost: 200000 });
    const vinyl = fromHistory.find((s) => s.line.materialId === 'mat-vinilo')!;
    expect(vinyl.missing).toContain('120 × 190 × 70');
    // Las líneas copiadas son nuevas: no comparten id con las del historial.
    expect(fromHistory.map((s) => s.line.id)).not.toContain('line-mdf-9');
  });

  it('no compara un ítem consigo mismo', async () => {
    const { quoteReader, materialCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      {
        quoteId: SEED_IDS.cart,
        itemId: 'item-carrito-ejemplo',
        product: 'Carrito de ejemplo',
        description: 'Mdf 9mm + mdf 12mm + vinilo + ruedas con freno',
        width: 120,
        height: 190,
        depth: 70,
      },
      await materialCatalog.list(),
    );
    expect(result.similar).toEqual([]);
    expect(result.suggestions.every((s) => s.source.kind === 'catalog')).toBe(true);
  });

  it('sin parecidos, sugiere solo desde el catálogo', async () => {
    const { quoteReader, materialCatalog } = services();
    const result = await new HistoricalCostSuggester(quoteReader).suggest(
      {
        quoteId: null,
        itemId: 'x',
        product: 'Aviso',
        description: 'Aviso en vinilo',
        width: 50,
        height: 50,
        depth: null,
      },
      await materialCatalog.list(),
    );
    expect(result.similar).toEqual([]);
    expect(result.suggestions.map((s) => s.line.label)).toEqual(['Vinilo']);
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
    expect(rows.map((r) => r.name)).toEqual(['MDF 15 mm', 'Acrílico 3 mm', 'Adhesivo']);
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
