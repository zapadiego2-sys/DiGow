import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { createTestServices, renderApp, SEED_QUOTE_ID, SEED_REQUEST_ID, USER_IDS } from './helpers';

const as = (userId: string | null) => createTestServices({}, { userId });

describe('inicio de sesión', () => {
  it('sin sesión lleva a ingresar y, al ingresar, vuelve a donde iba', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/cotizaciones', as(null));
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');

    await user.type(screen.getByRole('textbox', { name: 'Correo' }), 'analista1@demo.co');
    await user.type(screen.getByLabelText('Contraseña'), 'demo1234');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cotizaciones'));
    expect(await screen.findByRole('heading', { name: 'Cotizaciones' })).toBeInTheDocument();
  });

  it('una contraseña incorrecta muestra un error sin revelar si el correo existe', async () => {
    const user = userEvent.setup();
    renderApp('/', as(null));
    await user.type(await screen.findByRole('textbox', { name: 'Correo' }), 'admin@demo.co');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no coinciden',
    );
  });

  it('un usuario de prueba llena el formulario', async () => {
    const user = userEvent.setup();
    renderApp('/', as(null));
    await user.click(await screen.findByRole('button', { name: /Marta Analista/ }));
    expect(screen.getByRole('textbox', { name: 'Correo' })).toHaveValue('analista1@demo.co');
  });

  it('cerrar sesión vuelve a ingresar', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/ajustes', as(USER_IDS.advisor));
    const [signOut] = await screen.findAllByRole('button', { name: 'Cerrar sesión' });
    await user.click(signOut!);
    await waitFor(() => expect(router.state.location.pathname).toBe('/ingresar'));
  });
});

describe('roles', () => {
  it('el asesor no ve materiales ni administración, y no entra por la URL', async () => {
    renderApp('/admin/usuarios', as(USER_IDS.advisor));
    expect(await screen.findByText('No tienes acceso a la administración')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(within(nav).queryByRole('link', { name: 'Materiales' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Mis tareas' })).toBeInTheDocument();
  });

  it('el asesor solo ve sus cotizaciones y sin costos', async () => {
    renderApp('/cotizaciones', as(USER_IDS.advisor));
    const table = await screen.findByRole('table', { hidden: true });
    expect(within(table).getByText('Carrito Demo')).toBeInTheDocument();
    expect(within(table).queryByText('Exhibidor Demo')).not.toBeInTheDocument();
  });

  it('en el editor, el asesor no ve la hoja de costos ni la utilidad', async () => {
    renderApp(`/cotizaciones/${SEED_QUOTE_ID}`, as(USER_IDS.advisor));
    await screen.findByRole('textbox', { name: 'Cliente' });
    expect(screen.queryByText('Hoja de costos')).not.toBeInTheDocument();
    expect(screen.queryByText('Utilidad')).not.toBeInTheDocument();
  });

  it('quien no es responsable del paso solo consulta la cotización', async () => {
    renderApp(`/cotizaciones/${SEED_REQUEST_ID}`, as(USER_IDS.analyst2));
    expect(await screen.findByText(/Solo puedes consultar esta cotización/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Cliente' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();
  });

  it('una cotización ajena no se muestra al asesor', async () => {
    renderApp(`/cotizaciones/${SEED_REQUEST_ID}`, as(USER_IDS.advisor));
    expect(await screen.findByText('No tienes acceso a esta cotización')).toBeInTheDocument();
  });
});

describe('flujo de cotización', () => {
  it('la analista ve en sus tareas la solicitud que le llegó', async () => {
    renderApp('/', as(USER_IDS.analyst));
    const list = await screen.findByRole('list', { name: 'Mis tareas' });
    expect(within(list).getByText('Exhibidor Demo')).toBeInTheDocument();
    expect(within(list).getByText('Aprobar medidas')).toBeInTheDocument();
  });

  it('el asesor crea una cotización con plantilla y la envía a costeo', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.advisor);
    const { router } = renderApp('/cotizaciones/nueva', services);

    await user.click(await screen.findByRole('link', { name: /Mobiliario de punto de venta/ }));
    await user.type(await screen.findByRole('textbox', { name: 'Cliente' }), 'ACME');
    const summary = screen.getByRole('region', { name: 'Resumen' });

    // La plantilla exige la ciudad de instalación.
    await user.click(within(summary).getByRole('button', { name: 'Crear cotización' }));
    expect(await screen.findByText('Completa "Ciudad de instalación".')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ciudad de instalación' }), 'Cali');
    await user.click(within(summary).getByRole('button', { name: 'Crear cotización' }));
    await waitFor(() => expect(router.state.location.pathname).not.toContain('nueva'));

    const send = await screen.findByRole('button', { name: 'Enviar a Aprobar medidas' });
    await user.click(send);
    await waitFor(async () => {
      const quote = (await services.quoteReader.list()).find((q) => q.client === 'ACME')!;
      // Marta ya tiene una tarea: la recibe Pedro, que no tiene ninguna.
      expect(quote.workflow).toMatchObject({
        currentStepId: 'step-medidas',
        assigneeId: USER_IDS.analyst2,
      });
      expect(quote.customFields.find((f) => f.label === 'Ciudad de instalación')?.value).toBe(
        'Cali',
      );
    });
    // Ya no es responsable: queda en modo consulta.
    expect(await screen.findByText(/Solo puedes consultar esta cotización/)).toBeInTheDocument();
  });

  it('devolver exige un motivo', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.analyst);
    renderApp(`/cotizaciones/${SEED_REQUEST_ID}`, services);
    await user.click(await screen.findByRole('button', { name: 'Devolver a Solicitud' }));
    expect(await screen.findByText('Escribe el motivo para devolverla.')).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Comentario (obligatorio para devolver)' }),
      'Faltan las fotos',
    );
    await user.click(screen.getByRole('button', { name: 'Devolver a Solicitud' }));
    await waitFor(async () => {
      const quote = await services.quoteReader.get(SEED_REQUEST_ID);
      expect(quote.workflow).toMatchObject({
        currentStepId: 'step-solicitud',
        assigneeId: USER_IDS.advisor2,
      });
    });
  });

  it('el super admin ve la carga de trabajo', async () => {
    renderApp('/', as(USER_IDS.admin));
    const workload = await screen.findByRole('table', { name: 'Carga de trabajo', hidden: true });
    expect(within(workload).getByText('Marta Analista')).toBeInTheDocument();
  });
});

describe('administración', () => {
  it('crea una plantilla con un campo propio y aparece al crear una cotización', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    const { router } = renderApp('/admin/plantillas/nueva', services);
    await user.type(await screen.findByRole('textbox', { name: 'Nombre' }), 'Eventos');
    await user.click(screen.getByRole('button', { name: 'Agregar campo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre del campo' }), 'Lugar del evento');
    await user.click(screen.getByRole('checkbox', { name: 'Profundidad' }));
    await user.click(screen.getByRole('button', { name: 'Crear plantilla' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/plantillas'));

    const created = (await services.templateCatalog.list()).find((t) => t.name === 'Eventos')!;
    expect(created.fields.map((f) => f.label)).toEqual(['Lugar del evento']);
    expect(created.measures).toEqual({ width: true, height: true, depth: false });

    await router.navigate(`/cotizaciones/nueva?plantilla=${created.id}`);
    expect(
      await screen.findByRole('textbox', { name: 'Lugar del evento (opcional)' }),
    ).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Agregar ítem' })[0]!);
    expect(await screen.findByRole('textbox', { name: 'Ancho (cm)' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Profundidad (cm)' })).not.toBeInTheDocument();
  });

  it('edita los permisos de un rol', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    renderApp('/admin/roles', services);
    await user.click(await screen.findByRole('button', { name: 'Editar Cotizador (asesor)' }));
    await user.click(await screen.findByRole('checkbox', { name: /Ver materiales/ }));
    await user.click(screen.getByRole('button', { name: 'Guardar rol' }));
    await waitFor(async () => {
      const advisor = (await services.roleCatalog.list()).find((r) => r.id === 'role-advisor')!;
      expect(advisor.permissions).toContain('materials.view');
    });
  });

  it('agrega un paso a un flujo', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    const { router } = renderApp('/admin/flujos/wf-rapido', services);
    await user.click(await screen.findByRole('button', { name: 'Agregar paso' }));
    const steps = screen.getAllByRole('textbox', { name: 'Nombre del paso' });
    await user.type(steps.at(-1)!, 'Aprobación');
    const roles = screen.getAllByRole('combobox', { name: 'Rol responsable' });
    await user.click(roles.at(-1)!);
    await user.click(await screen.findByRole('option', { name: 'Super admin' }));
    await user.click(screen.getByRole('button', { name: 'Guardar flujo' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/flujos'));
    const express = (await services.workflowCatalog.list()).find((w) => w.id === 'wf-rapido')!;
    expect(express.steps.map((s) => s.name)).toEqual(['Solicitud', 'Costeo', 'Aprobación']);
  });

  it('crea un usuario que puede ingresar', async () => {
    const user = userEvent.setup();
    const services = as(USER_IDS.admin);
    renderApp('/admin/usuarios', services);
    await user.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo usuario' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Nombre' }), 'Ana Nueva');
    await user.type(within(dialog).getByRole('textbox', { name: 'Correo' }), 'ana@demo.co');
    await user.click(within(dialog).getByRole('combobox', { name: 'Rol' }));
    await user.click(await screen.findByRole('option', { name: 'Analista de cotizaciones' }));
    await user.type(within(dialog).getByLabelText('Contraseña temporal'), 'corta');
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    expect(await within(dialog).findByText(/al menos 8 caracteres/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Contraseña temporal'), '-larga');
    await user.click(within(dialog).getByRole('button', { name: 'Crear usuario' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await expect(
      services.authenticator.signIn('ana@demo.co', 'corta-larga'),
    ).resolves.toMatchObject({
      role: { id: 'role-analyst' },
    });
  });
});

async function materialsFile() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Materiales');
  sheet.addRow([
    'Nombre',
    'Proveedor',
    'Precio de compra',
    'Factor',
    'Área de la lámina (cm2)',
    'Costo directo',
  ]);
  sheet.addRow(['Acrílico 3 mm', '', 200000, 0.75, null, null]);
  sheet.addRow(['Vinilo', '', null, null, null, 7]);
  sheet.addRow(['Sin precio', '', null, 0.5, null, null]);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const file = new File([bytes], 'materiales.xlsx');
  file.arrayBuffer = () => Promise.resolve(bytes.buffer.slice(0));
  return file;
}

describe('carga masiva de materiales', () => {
  it('la analista revisa la vista previa y carga solo las filas válidas', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const services = as(USER_IDS.analyst);
    const { router } = renderApp('/materiales/cargar', services);
    await user.upload(
      await screen.findByLabelText('Archivo de materiales en formato .xlsx'),
      await materialsFile(),
    );
    const preview = await screen.findByRole('table', {
      name: 'Vista previa de materiales',
      hidden: true,
    });
    expect(within(preview).getByText('Nuevo')).toBeInTheDocument();
    expect(within(preview).getByText('Actualiza')).toBeInTheDocument();
    expect(within(preview).getByText('Con errores')).toBeInTheDocument();
    // Nada se guarda antes de confirmar.
    expect((await services.materialCatalog.list()).some((m) => m.name === 'Acrílico 3 mm')).toBe(
      false,
    );

    await user.click(screen.getByRole('button', { name: 'Cargar 2 materiales' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/materiales'));
    const materials = await services.materialCatalog.list();
    expect(materials.some((m) => m.name === 'Acrílico 3 mm')).toBe(true);
    expect(materials.some((m) => m.name === 'Sin precio')).toBe(false);
    expect(materials.find((m) => m.name === 'Vinilo')?.pricing).toEqual({
      mode: 'direct',
      unitCost: 7,
    });
  });

  it('el asesor no puede cargar materiales', async () => {
    renderApp('/materiales/cargar', as(USER_IDS.advisor));
    expect(await screen.findByText('No tienes acceso a esta sección')).toBeInTheDocument();
  });
});
