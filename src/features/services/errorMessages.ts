import {
  QuoteImportError,
  RepositoryError,
  type ImportErrorCode,
  type RepositoryErrorCode,
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
};

export function errorMessage(error: unknown): string {
  if (error instanceof RepositoryError) return REPOSITORY_MESSAGES[error.code];
  if (error instanceof QuoteImportError) return IMPORT_MESSAGES[error.code];
  return 'Ocurrió un error inesperado. Vuelve a intentarlo.';
}
