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

export interface DemoDataControl {
  reset(): Promise<void>;
}
