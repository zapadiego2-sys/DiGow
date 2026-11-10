import type { Workbook } from 'exceljs';
import { FileImportError } from '@/domain/errors';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Carga diferida: exceljs solo se descarga cuando se usa. */
export async function loadExcelJs() {
  const module = await import('exceljs');
  return module.default ?? module;
}

/** Solo .xlsx de hasta 10 MB. Un archivo dañado se informa, nunca rompe la pantalla. */
export async function loadWorkbook(file: File): Promise<Workbook> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new FileImportError('invalid-type');
  if (file.size > MAX_FILE_BYTES) throw new FileImportError('too-large');
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new FileImportError('damaged');
  }
  return workbook;
}
