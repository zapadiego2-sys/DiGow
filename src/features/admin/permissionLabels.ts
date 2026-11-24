import type { Permission } from '@/domain/access';

export interface PermissionGroup {
  title: string;
  permissions: { value: Permission; label: string; description: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: 'Cotizaciones',
    permissions: [
      {
        value: 'quotes.create',
        label: 'Crear cotizaciones',
        description: 'Registrar solicitudes nuevas.',
      },
      {
        value: 'quotes.viewAll',
        label: 'Ver todas',
        description: 'Sin el permiso, solo ve las que creó o tiene asignadas.',
      },
      {
        value: 'quotes.editAll',
        label: 'Editar cualquiera',
        description: 'Editar aunque no sea el responsable del paso.',
      },
      {
        value: 'quotes.costing',
        label: 'Costos y utilidad',
        description: 'Ver y editar la hoja de costos.',
      },
      {
        value: 'quotes.assignAdvisor',
        label: 'Cambiar el asesor',
        description: 'Editar el asesor y su cargo en una cotización.',
      },
      {
        value: 'quotes.import',
        label: 'Importar desde Excel',
        description: 'Crear borradores desde un archivo .xlsx.',
      },
    ],
  },
  {
    title: 'Inventario',
    permissions: [
      {
        value: 'materials.view',
        label: 'Ver materiales',
        description: 'Consultar el catálogo y sus precios.',
      },
      {
        value: 'materials.manage',
        label: 'Administrar materiales',
        description: 'Crear, editar y cargar desde Excel.',
      },
    ],
  },
  {
    title: 'Flujos',
    permissions: [
      {
        value: 'workflow.manage',
        label: 'Gestionar tareas',
        description: 'Reasignar pasos y ver la carga de trabajo.',
      },
    ],
  },
  {
    title: 'Administración',
    permissions: [
      {
        value: 'admin.users',
        label: 'Usuarios',
        description: 'Crear, editar y desactivar usuarios.',
      },
      {
        value: 'admin.roles',
        label: 'Roles y permisos',
        description: 'Definir qué puede hacer cada rol.',
      },
      {
        value: 'admin.workflows',
        label: 'Flujos y pasos',
        description: 'Configurar los flujos de cotización.',
      },
      {
        value: 'admin.templates',
        label: 'Plantillas',
        description: 'Configurar las plantillas de cotización.',
      },
      {
        value: 'admin.conditions',
        label: 'Condiciones comerciales',
        description: 'Publicar versiones de las plantillas de condiciones.',
      },
      {
        value: 'admin.formulas',
        label: 'Fórmulas de costo',
        description: 'Crear y editar las fórmulas que usa el analista.',
      },
      {
        value: 'admin.catalog',
        label: 'Catálogo de productos',
        description: 'Productos, tipos, sub-ítems y marca predictiva.',
      },
      {
        value: 'settings.demoData',
        label: 'Datos de prueba',
        description: 'Restablecer los datos de ejemplo.',
      },
    ],
  },
];
