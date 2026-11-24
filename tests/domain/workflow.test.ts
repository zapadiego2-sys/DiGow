import { describe, expect, it } from 'vitest';
import {
  can,
  keepsActiveSuperAdmin,
  SUPER_ADMIN_ROLE_ID,
  type Session,
  type User,
} from '@/domain/access';
import { toClientQuoteView } from '@/domain/clientView';
import { RuleError } from '@/domain/errors';
import { createQuoteDraft, withWorkflowState, type Quote } from '@/domain/quote';
import { canEditQuote, canViewQuote } from '@/domain/quoteAccess';
import type { QuoteTemplate } from '@/domain/template';
import {
  advanceWorkflow,
  countOpenTasks,
  pickLeastBusy,
  reassignWorkflow,
  resolveAssignee,
  returnWorkflow,
  startWorkflow,
  type AssignmentContext,
  type Workflow,
  type WorkflowChange,
} from '@/domain/workflow';
import { seedRoles, seedUsers, USER_IDS } from '@/infrastructure/seed/accessSeed';
import { seedConditions, seedTemplates, seedWorkflows } from '@/infrastructure/seed/processSeed';

const users = seedUsers();
const [standard] = seedWorkflows() as [Workflow];
let counter = 0;
const change = (actorId: string, comment = ''): WorkflowChange => ({
  now: `2026-03-0${++counter % 9}T10:00:00.000Z`,
  eventId: `ev-${counter}`,
  actor: { id: actorId, name: users.find((u) => u.id === actorId)?.name ?? '' },
  comment,
});
const context = (openTasks: Record<string, number> = {}): AssignmentContext => ({
  users,
  openTasks: new Map(Object.entries(openTasks)),
  requesterId: USER_IDS.advisor,
});

describe('asignación automática', () => {
  it('elige a quien tiene menos tareas abiertas', () => {
    const analysts = users.filter((u) => u.roleId === 'role-analyst');
    const tasks = new Map([
      [USER_IDS.analyst, 3],
      [USER_IDS.analyst2, 1],
    ]);
    expect(pickLeastBusy(analysts, tasks)).toBe(USER_IDS.analyst2);
  });

  it('un empate se resuelve por nombre, para ser predecible', () => {
    const analysts = users.filter((u) => u.roleId === 'role-analyst');
    expect(pickLeastBusy(analysts, new Map())).toBe(USER_IDS.analyst); // Marta antes que Pedro
  });

  it('sin candidatos no asigna a nadie', () => {
    expect(pickLeastBusy([], new Map())).toBeNull();
  });

  it('solo asigna a usuarios activos del rol del paso', () => {
    const costing = standard.steps[1]!;
    const inactive = users.map((u) => (u.id === USER_IDS.analyst2 ? { ...u, active: false } : u));
    expect(
      resolveAssignee(costing, {
        ...context({ [USER_IDS.analyst]: 9 }),
        users: inactive,
      }),
    ).toBe(USER_IDS.analyst);
  });

  it('un paso de quien la creó vuelve al asesor; si está inactivo, se asigna por carga', () => {
    const request = standard.steps[0]!;
    expect(resolveAssignee(request, context())).toBe(USER_IDS.advisor);
    const inactive = users.map((u) => (u.id === USER_IDS.advisor ? { ...u, active: false } : u));
    expect(resolveAssignee(request, { ...context(), users: inactive })).toBe(USER_IDS.advisor2);
  });

  it('cuenta solo las tareas de pasos abiertos', () => {
    const started = startWorkflow(standard, context(), change(USER_IDS.advisor));
    const finished = { ...started, currentStepId: null, assigneeId: USER_IDS.analyst };
    expect(countOpenTasks([started, finished, null])).toEqual(new Map([[USER_IDS.advisor, 1]]));
  });
});

describe('flujo de una cotización', () => {
  it('recorre los pasos: solicitud, medidas y costos con la misma analista, revisión y fin', () => {
    let state = startWorkflow(standard, context(), change(USER_IDS.advisor));
    expect(state).toMatchObject({ currentStepId: 'step-solicitud', assigneeId: USER_IDS.advisor });

    state = advanceWorkflow(state, context({ [USER_IDS.analyst]: 2 }), change(USER_IDS.advisor));
    expect(state).toMatchObject({ currentStepId: 'step-medidas', assigneeId: USER_IDS.analyst2 });

    // Aprobar costos sigue con quien aprobó las medidas, aunque tenga más tareas.
    state = advanceWorkflow(state, context({ [USER_IDS.analyst2]: 5 }), change(USER_IDS.analyst2));
    expect(state).toMatchObject({ currentStepId: 'step-costeo', assigneeId: USER_IDS.analyst2 });

    state = advanceWorkflow(state, context(), change(USER_IDS.analyst2));
    expect(state).toMatchObject({ currentStepId: 'step-revision', assigneeId: USER_IDS.advisor });

    state = advanceWorkflow(state, context(), change(USER_IDS.advisor));
    expect(state.currentStepId).toBeNull();
    expect(state.completedAt).not.toBeNull();
    expect(state.history.map((e) => e.action)).toEqual([
      'started',
      'advanced',
      'advanced',
      'advanced',
      'completed',
    ]);
    expect(() => advanceWorkflow(state, context(), change(USER_IDS.advisor))).toThrow(RuleError);
  });

  it('al terminar el flujo la cotización pasa a enviada; los demás pasos no cambian el estado', () => {
    const started = startWorkflow(standard, context(), change(USER_IDS.advisor));
    const quote = { status: 'draft', workflow: started } as Quote;
    const moved = advanceWorkflow(started, context(), change(USER_IDS.advisor));
    expect(withWorkflowState(quote, moved).status).toBe('draft');
    const finished = { ...moved, currentStepId: null, assigneeId: null };
    expect(withWorkflowState({ ...quote, workflow: moved }, finished).status).toBe('sent');
    // Una cotización ya terminada no cambia de estado otra vez.
    const approved = { status: 'approved', workflow: finished } as Quote;
    expect(withWorkflowState(approved, finished).status).toBe('approved');
  });

  it('devolver exige un motivo y vuelve a quien atendió el paso anterior', () => {
    let state = startWorkflow(standard, context(), change(USER_IDS.advisor));
    state = advanceWorkflow(state, context(), change(USER_IDS.advisor));
    expect(() => returnWorkflow(state, context(), change(USER_IDS.analyst))).toThrow(
      expect.objectContaining({ code: 'comment-required' }),
    );
    state = returnWorkflow(state, context(), change(USER_IDS.analyst, 'Faltan las medidas'));
    expect(state).toMatchObject({ currentStepId: 'step-solicitud', assigneeId: USER_IDS.advisor });
    expect(state.history.at(-1)).toMatchObject({
      action: 'returned',
      comment: 'Faltan las medidas',
    });
  });

  it('no se puede devolver desde el primer paso', () => {
    const state = startWorkflow(standard, context(), change(USER_IDS.advisor));
    expect(() => returnWorkflow(state, context(), change(USER_IDS.advisor, 'x'))).toThrow(
      expect.objectContaining({ code: 'first-step' }),
    );
  });

  it('reasignar cambia el responsable sin cambiar de paso', () => {
    let state = startWorkflow(standard, context(), change(USER_IDS.advisor));
    state = advanceWorkflow(state, context(), change(USER_IDS.advisor));
    const pedro = users.find((u) => u.id === USER_IDS.analyst2)!;
    state = reassignWorkflow(state, pedro, change(USER_IDS.admin));
    expect(state).toMatchObject({ currentStepId: 'step-medidas', assigneeId: USER_IDS.analyst2 });
    expect(() =>
      reassignWorkflow(state, { ...pedro, active: false }, change(USER_IDS.admin)),
    ).toThrow(expect.objectContaining({ code: 'inactive-user' }));
  });

  it('copia los pasos al iniciar: cambiar la configuración no altera el flujo en curso', () => {
    const state = startWorkflow(standard, context(), change(USER_IDS.advisor));
    standard.steps[0]!.name = 'Otro nombre';
    expect(state.steps[0]!.name).toBe('Solicitud');
    standard.steps[0]!.name = 'Solicitud';
  });
});

const roles = seedRoles();
const sessionOf = (userId: string): Session => {
  const user = users.find((u) => u.id === userId) as User;
  return { user, role: roles.find((r) => r.id === user.roleId)! };
};

describe('roles y permisos', () => {
  it('el super admin tiene todos los permisos; el asesor no ve costos', () => {
    expect(can(sessionOf(USER_IDS.admin), 'admin.templates')).toBe(true);
    expect(can(sessionOf(USER_IDS.advisor), 'quotes.costing')).toBe(false);
    expect(can(sessionOf(USER_IDS.analyst), 'materials.manage')).toBe(true);
    expect(can(null, 'quotes.create')).toBe(false);
  });

  it('siempre queda un super admin activo', () => {
    const admin = users.find((u) => u.roleId === SUPER_ADMIN_ROLE_ID)!;
    expect(keepsActiveSuperAdmin(users, { ...admin, active: false })).toBe(false);
    expect(keepsActiveSuperAdmin(users, { ...admin, name: 'Otro' })).toBe(true);
  });

  it('en un paso abierto solo edita el responsable; la ven quien la creó y quien ve todas', () => {
    const state = advanceWorkflow(
      startWorkflow(standard, context(), change(USER_IDS.advisor)),
      context(),
      change(USER_IDS.advisor),
    );
    const quote = { createdBy: USER_IDS.advisor, workflow: state } as Quote;
    expect(canEditQuote(quote, sessionOf(USER_IDS.analyst))).toBe(true);
    expect(canEditQuote(quote, sessionOf(USER_IDS.advisor))).toBe(false);
    expect(canEditQuote(quote, sessionOf(USER_IDS.admin))).toBe(true);
    expect(canViewQuote(quote, sessionOf(USER_IDS.advisor))).toBe(true);
    expect(canViewQuote(quote, sessionOf(USER_IDS.advisor2))).toBe(false);
    expect(canViewQuote(quote, sessionOf(USER_IDS.analyst2))).toBe(true);
  });
});

describe('plantillas', () => {
  const pos = seedTemplates().find((t) => t.id === 'tpl-punto-venta') as QuoteTemplate;
  const print = seedTemplates().find((t) => t.id === 'tpl-impresos') as QuoteTemplate;

  const advisor = { id: USER_IDS.advisor, name: 'Laura Prueba', title: 'Gestora de proyectos' };
  const printConditions = seedConditions().find((c) => c.id === 'cond-impresos')!;

  it('el borrador copia campos, medidas, unidad y condiciones de la plantilla', () => {
    const draft = createQuoteDraft({
      today: '2026-03-01',
      advisor,
      template: print,
      conditions: printConditions,
    });
    expect(draft.template).toMatchObject({
      id: 'tpl-impresos',
      name: 'Impresos y gráficas',
      measures: { width: true, height: true, depth: false },
    });
    expect(draft.template?.standardSizes.map((s) => s.name)).toEqual(['Pendón', 'Valla']);
    expect(draft.measureUnit).toBe('m');
    expect(draft.conditionsRef).toEqual({
      templateId: 'cond-impresos',
      name: 'Condiciones de impresos',
      version: 1,
    });
    expect(draft.customFields.map((f) => [f.label, f.value])).toEqual([
      ['Material de impresión', null],
      ['Acabado', null],
      ['Requiere instalación', false],
    ]);
    expect(draft.validity).toBe('15 días');
    expect(draft.createdBy).toBe(USER_IDS.advisor);
    // El asesor es quien crea la cotización.
    expect([draft.managerName, draft.managerRole]).toEqual([
      'Laura Prueba',
      'Gestora de proyectos',
    ]);
  });

  it('la vista para el cliente solo recibe los campos marcados como visibles', () => {
    const draft = createQuoteDraft({ today: '2026-03-01', advisor: null, template: pos });
    const fields = draft.customFields.map((f) => ({
      ...f,
      value: f.type === 'checkbox' ? true : f.type === 'date' ? '2026-04-01' : `valor ${f.label}`,
    }));
    const view = toClientQuoteView({
      ...draft,
      customFields: fields,
      id: 'q',
      createdAt: '',
      updatedAt: '',
    });
    expect(view.projectFields.map((f) => f.label)).toEqual([
      'Ciudad de instalación',
      'Requiere instalación',
    ]);
    expect(JSON.stringify(view)).not.toContain('Marca o campaña');
    expect(JSON.stringify(view)).not.toContain('workflow');
  });
});
