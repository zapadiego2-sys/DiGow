import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import type { Permission } from '@/domain/access';
import { AdminLayout } from '@/features/admin/AdminLayout';
import { RolesScreen } from '@/features/admin/RolesScreen';
import { TemplateEditorScreen, TemplatesScreen } from '@/features/admin/TemplatesScreen';
import { UsersScreen } from '@/features/admin/UsersScreen';
import { WorkflowEditorScreen, WorkflowsScreen } from '@/features/admin/WorkflowsScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { RequireAuth, RequirePermission, SIGN_IN_PATH } from '@/features/auth/RequireAuth';
import { ImportScreen } from '@/features/import/ImportScreen';
import { MaterialImportScreen } from '@/features/materials/MaterialImportScreen';
import { MaterialsScreen } from '@/features/materials/MaterialsScreen';
import { ClientQuoteScreen } from '@/features/quotes/ClientQuoteScreen';
import { NewQuoteScreen } from '@/features/quotes/NewQuoteScreen';
import { QuoteEditorScreen } from '@/features/quotes/QuoteEditorScreen';
import { QuoteListScreen } from '@/features/quotes/QuoteListScreen';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { TasksScreen } from '@/features/tasks/TasksScreen';
import { DEMO_PASSWORD, seedRoles, seedUsers } from '@/infrastructure/seed/accessSeed';
import { Shell } from './Shell';

// Mientras la app use datos simulados, el ingreso ofrece las cuentas de prueba.
const demoAccounts = seedUsers().map((user) => ({
  email: user.email,
  name: user.name,
  role: seedRoles().find((role) => role.id === user.roleId)?.name ?? '',
}));

const guard = (permission: Permission, element: ReactNode) => (
  <RequirePermission permission={permission}>{element}</RequirePermission>
);

export const routes: RouteObject[] = [
  {
    path: SIGN_IN_PATH,
    element: <LoginScreen demoAccounts={demoAccounts} demoPassword={DEMO_PASSWORD} />,
  },
  {
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
    children: [
      { path: '/', element: <TasksScreen /> },
      { path: '/cotizaciones', element: <QuoteListScreen /> },
      { path: '/cotizaciones/nueva', element: guard('quotes.create', <NewQuoteScreen />) },
      { path: '/cotizaciones/importar', element: guard('quotes.import', <ImportScreen />) },
      { path: '/cotizaciones/:id', element: <QuoteEditorScreen /> },
      { path: '/materiales', element: guard('materials.view', <MaterialsScreen />) },
      { path: '/materiales/cargar', element: guard('materials.manage', <MaterialImportScreen />) },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { path: 'usuarios', element: guard('admin.users', <UsersScreen />) },
          { path: 'roles', element: guard('admin.roles', <RolesScreen />) },
          { path: 'flujos', element: guard('admin.workflows', <WorkflowsScreen />) },
          { path: 'flujos/:id', element: guard('admin.workflows', <WorkflowEditorScreen />) },
          { path: 'plantillas', element: guard('admin.templates', <TemplatesScreen />) },
          { path: 'plantillas/:id', element: guard('admin.templates', <TemplateEditorScreen />) },
        ],
      },
      { path: '/ajustes', element: <SettingsScreen /> },
    ],
  },
  // Sin navegación: es lo que se imprime para el cliente.
  {
    path: '/cotizaciones/:id/cliente',
    element: (
      <RequireAuth>
        <ClientQuoteScreen />
      </RequireAuth>
    ),
  },
];
