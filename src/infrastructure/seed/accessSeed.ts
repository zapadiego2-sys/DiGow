import { SUPER_ADMIN_ROLE_ID, permissions, type Role, type User } from '@/domain/access';

// Usuarios y contraseñas ficticios: el sitio es público. Todos usan la contraseña demo1234.
export const DEMO_PASSWORD = 'demo1234';

export const ROLE_IDS = {
  superAdmin: SUPER_ADMIN_ROLE_ID,
  advisor: 'role-advisor',
  analyst: 'role-analyst',
} as const;

export const USER_IDS = {
  admin: 'user-admin',
  advisor: 'user-asesora',
  advisor2: 'user-asesor',
  analyst: 'user-analista-1',
  analyst2: 'user-analista-2',
} as const;

export function seedRoles(): Role[] {
  return [
    {
      id: ROLE_IDS.superAdmin,
      name: 'Super admin',
      description: 'Administra usuarios, roles, flujos y plantillas. Tiene todos los permisos.',
      permissions: [...permissions],
      system: true,
    },
    {
      id: ROLE_IDS.advisor,
      name: 'Cotizador (asesor)',
      description:
        'Registra la cotización básica con el cliente, el proyecto y los ítems, y la envía a costeo.',
      permissions: ['quotes.create'],
      system: true,
    },
    {
      id: ROLE_IDS.analyst,
      name: 'Analista de cotizaciones',
      description:
        'Recibe las cotizaciones de los asesores, arma la hoja de costos y mantiene el inventario de materiales.',
      permissions: [
        'quotes.create',
        'quotes.viewAll',
        'quotes.costing',
        'quotes.import',
        'materials.view',
        'materials.manage',
      ],
      system: true,
    },
  ];
}

export function seedUsers(): User[] {
  return [
    {
      id: USER_IDS.admin,
      name: 'Sofía Admin',
      email: 'admin@demo.co',
      title: 'Administradora',
      roleId: ROLE_IDS.superAdmin,
      active: true,
    },
    {
      id: USER_IDS.advisor,
      name: 'Laura Prueba',
      email: 'asesora@demo.co',
      title: 'Gestora de proyectos',
      roleId: ROLE_IDS.advisor,
      active: true,
    },
    {
      id: USER_IDS.advisor2,
      name: 'Carlos Asesor',
      email: 'asesor@demo.co',
      title: 'Asesor comercial',
      roleId: ROLE_IDS.advisor,
      active: true,
    },
    {
      id: USER_IDS.analyst,
      name: 'Marta Analista',
      email: 'analista1@demo.co',
      title: 'Analista de costos',
      roleId: ROLE_IDS.analyst,
      active: true,
    },
    {
      id: USER_IDS.analyst2,
      name: 'Pedro Analista',
      email: 'analista2@demo.co',
      title: 'Analista de costos',
      roleId: ROLE_IDS.analyst,
      active: true,
    },
  ];
}

export interface Credential {
  userId: string;
  salt: string;
  /** SHA-256 de `salt:contraseña`. */
  hash: string;
}

/** Hashes precalculados de demo1234, para no guardar la contraseña en texto plano. */
export function seedCredentials(): Credential[] {
  return [
    {
      userId: USER_IDS.admin,
      salt: '91eb76c38ee21db5645bf79b10b698de',
      hash: '728a92928026b517b405b72034f6b1d8b9ec53bf8b4fc8136bd28b5a51c5a038',
    },
    {
      userId: USER_IDS.advisor,
      salt: 'f68b80e7e9cdc1fc635dcd22d7e0b48c',
      hash: 'a345fae65b8bf0aa88cd2a536b98f9e7000018b19f34ce586636ce778db967a5',
    },
    {
      userId: USER_IDS.advisor2,
      salt: 'e622ed89858fafe362523ea82c7576b9',
      hash: '593bcf3e16c41b76bcc9aaa3bccf7df75c1a3e002f168b9a5ae72652a945ea39',
    },
    {
      userId: USER_IDS.analyst,
      salt: '4b7edc210cb15aecb54c52a9563b629a',
      hash: '4555582ff5005ba1d8821c400d0ba16c16ca80dab07002b618ce1f04b650dbbc',
    },
    {
      userId: USER_IDS.analyst2,
      salt: '19b918feff9b3540f20b486ad5066e9b',
      hash: 'cd553ee4d057d43f032f116d77ac5d637a0ef7d08dd517a2019dcb557df814e4',
    },
  ];
}
