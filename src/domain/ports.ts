import type { CostLine } from './cost';
import type { Material, MaterialDraft } from './material';
import type { Quote, QuoteDraft, QuoteFilter } from './quote';

export interface QuoteReader {
  list(filter?: QuoteFilter): Promise<Quote[]>;
  get(id: string): Promise<Quote>;
}

export interface QuoteWriter {
  create(draft: QuoteDraft): Promise<Quote>;
  update(quote: Quote): Promise<Quote>;
  duplicate(id: string): Promise<Quote>;
}

export interface MaterialCatalog {
  list(): Promise<Material[]>;
  create(draft: MaterialDraft): Promise<Material>;
  update(material: Material): Promise<Material>;
}

export interface ImportWarning {
  message: string;
}

export interface QuoteImportResult {
  draft: QuoteDraft;
  warnings: ImportWarning[];
}

export interface QuoteImporter {
  import(file: File): Promise<QuoteImportResult>;
}

/** Una línea propuesta. Nada entra a la hoja de costos hasta que la gestora la acepta. */
export interface CostSuggestion {
  line: CostLine;
  /** Dato que no se pudo deducir de la descripción y que la gestora debe escribir. */
  missing: string | null;
}

export interface CostSuggester {
  suggest(description: string, materials: readonly Material[]): Promise<CostSuggestion[]>;
}

export interface DemoDataControl {
  reset(): Promise<void>;
}
