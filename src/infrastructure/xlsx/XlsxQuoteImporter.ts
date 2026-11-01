import { QuoteImportError } from '@/domain/errors';
import type { QuoteImporter, QuoteImportResult } from '@/domain/ports';
import { parseWorkbook } from './parseWorkbook';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export class XlsxQuoteImporter implements QuoteImporter {
  async import(file: File): Promise<QuoteImportResult> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) throw new QuoteImportError('invalid-type');
    if (file.size > MAX_FILE_BYTES) throw new QuoteImportError('too-large');

    // Carga diferida: exceljs solo se descarga al importar.
    const module = await import('exceljs');
    const ExcelJS = module.default ?? module;
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(await file.arrayBuffer());
    } catch {
      throw new QuoteImportError('damaged');
    }
    return parseWorkbook(workbook);
  }
}
