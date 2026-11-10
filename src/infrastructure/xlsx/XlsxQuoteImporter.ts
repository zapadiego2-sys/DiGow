import type { QuoteImporter, QuoteImportResult } from '@/domain/ports';
import { loadWorkbook } from './loadWorkbook';
import { parseWorkbook } from './parseWorkbook';

export class XlsxQuoteImporter implements QuoteImporter {
  async import(file: File): Promise<QuoteImportResult> {
    return parseWorkbook(await loadWorkbook(file));
  }
}
