import {
  FileImportError,
  RepositoryError,
  RuleError,
  type ImportErrorCode,
  type RepositoryErrorCode,
  type RuleErrorCode,
} from '@/domain/errors';

const REPOSITORY_MESSAGES: Record<RepositoryErrorCode, string> = {
  'not-found':
    'No encontramos este registro; puede que se haya restablecido. Búscalo en el listado de cotizaciones.',
  'storage-full':
    'El almacenamiento de este dispositivo está lleno. Quita fotos de las cotizaciones o restablece los datos en Ajustes, y vuelve a intentarlo.',
  'storage-corrupted':
    'Los datos guardados en este dispositivo están dañados. Puedes restablecerlos en Ajustes.',
  unavailable: 'El servicio no está disponible. Vuelve a intentarlo.',
};

const IMPORT_MESSAGES: Record<ImportErrorCode, string> = {
  'invalid-type': 'Solo se aceptan archivos .xlsx.',
  'too-large': 'El archivo pesa más de 10 MB. Elige uno más liviano.',
  damaged: 'No pudimos leer el archivo. Puede estar dañado; ábrelo en Excel y guárdalo de nuevo.',
  'unrecognized-structure':
    'Este archivo no tiene la estructura de cotización esperada: no encontramos los encabezados de los ítems.',
  'no-material-headers':
    'No encontramos la columna "Nombre" en las primeras filas. Descarga la plantilla de Excel y copia tus materiales en ella.',
};

const RULE_MESSAGES: Record<RuleErrorCode, string> = {
  'invalid-credentials': 'El correo o la contraseña no coinciden. Revísalos y vuelve a intentarlo.',
  'inactive-user': 'Este usuario está desactivado. Pide a un administrador que lo active.',
  'email-taken': 'Ya existe un usuario con ese correo. Usa otro.',
  'last-admin':
    'Debe quedar al menos un super admin activo. Asigna el rol a otra persona antes de cambiar este usuario.',
  'system-role': 'El rol de super admin no se puede editar ni borrar.',
  'role-in-use':
    'Este rol tiene usuarios o pasos de flujo asignados. Cámbialos a otro rol antes de borrarlo.',
  'workflow-empty': 'No hay un flujo activo con pasos. Configura uno en Administración.',
  'workflow-finished': 'El flujo de esta cotización ya terminó.',
  'first-step': 'La cotización está en el primer paso: no hay un paso anterior.',
  'comment-required': 'Escribe el motivo para devolver la cotización.',
  'not-assignee': 'Solo el responsable del paso puede moverlo.',
  'default-required':
    'Debe haber un flujo por defecto activo. Marca otro como predeterminado antes de cambiar este.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return REPOSITORY_MESSAGES[error.code];
  if (error instanceof FileImportError) return IMPORT_MESSAGES[error.code];
  if (error instanceof RuleError) return RULE_MESSAGES[error.code];
  return 'Ocurrió un error inesperado. Vuelve a intentarlo.';
}
