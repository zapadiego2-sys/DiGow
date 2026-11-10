import type { Role, RoleDraft, Session, User, UserDraft } from './access';
import type { CostLine } from './cost';
import type { Material, MaterialDraft } from './material';
import type { Quote, QuoteDraft, QuoteFilter } from './quote';
import type { QuoteTemplate, QuoteTemplateDraft } from './template';
import type { Workflow, WorkflowDraft } from './workflow';

export interface QuoteReader {
  list(filter?: QuoteFilter): Promise<Quote[]>;
  get(id: string): Promise<Quote>;
}

export interface QuoteWriter {
  create(draft: QuoteDraft): Promise<Quote>;
  update(quote: Quote): Promise<Quote>;
  duplicate(id: string): Promise<Quote>;
}

export interface MaterialImportSummary {
  created: number;
  updated: number;
}

export interface MaterialCatalog {
  list(): Promise<Material[]>;
  create(draft: MaterialDraft): Promise<Material>;
  update(material: Material): Promise<Material>;
  /** Crea los materiales nuevos y actualiza los que ya existen con el mismo nombre. */
  importMany(drafts: readonly MaterialDraft[]): Promise<MaterialImportSummary>;
}

export interface MaterialImportRow {
  /** Fila del archivo, para que el analista la ubique. */
  row: number;
  name: string;
  /** null si la fila tiene errores y no se puede cargar. */
  draft: MaterialDraft | null;
  errors: string[];
}

export interface MaterialImportResult {
  rows: MaterialImportRow[];
  warnings: ImportWarning[];
}

export interface MaterialImporter {
  read(file: File): Promise<MaterialImportResult>;
  /** Archivo de ejemplo con los encabezados esperados. */
  template(): Promise<Blob>;
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

export type SuggestionSource =
  { kind: 'catalog' } | { kind: 'history'; quoteId: string; project: string; product: string };

/** Una línea propuesta. Nada entra a la hoja de costos hasta que la gestora la acepta. */
export interface CostSuggestion {
  line: CostLine;
  /** Dato que no se pudo deducir y que la gestora debe escribir o revisar. */
  missing: string | null;
  source: SuggestionSource;
}

export interface CostSuggestionRequest {
  /** La cotización y el ítem que se están costeando, para no compararlos consigo mismos. */
  quoteId: string | null;
  itemId: string;
  product: string;
  description: string;
  width: number | null;
  height: number | null;
  depth: number | null;
}

/** Ítem de una cotización anterior que se parece al que se está costeando. */
export interface SimilarItem {
  quoteId: string;
  itemId: string;
  project: string;
  client: string;
  date: string;
  product: string;
  width: number | null;
  height: number | null;
  depth: number | null;
  /** Costo de una unidad cuando se cotizó. */
  unitCost: number;
  /** El mismo costo con los precios actuales del catálogo. */
  currentUnitCost: number;
  unitPrice: number | null;
  /** Entre 0 y 1. */
  similarity: number;
}

export interface CostSuggestionResult {
  suggestions: CostSuggestion[];
  similar: SimilarItem[];
}

export interface CostSuggester {
  suggest(
    request: CostSuggestionRequest,
    materials: readonly Material[],
  ): Promise<CostSuggestionResult>;
}

export interface DemoDataControl {
  reset(): Promise<void>;
}

export interface Authenticator {
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  /** null si no hay sesión o si el usuario ya no está activo. */
  currentSession(): Promise<Session | null>;
}

export interface NewUser extends UserDraft {
  password: string;
}

export interface UserDirectory {
  list(): Promise<User[]>;
  create(user: NewUser): Promise<User>;
  update(user: User): Promise<User>;
  setPassword(userId: string, password: string): Promise<void>;
}

export interface RoleCatalog {
  list(): Promise<Role[]>;
  create(draft: RoleDraft): Promise<Role>;
  update(role: Role): Promise<Role>;
  remove(id: string): Promise<void>;
}

export interface WorkflowCatalog {
  list(): Promise<Workflow[]>;
  create(draft: WorkflowDraft): Promise<Workflow>;
  update(workflow: Workflow): Promise<Workflow>;
}

export interface TemplateCatalog {
  list(): Promise<QuoteTemplate[]>;
  create(draft: QuoteTemplateDraft): Promise<QuoteTemplate>;
  update(template: QuoteTemplate): Promise<QuoteTemplate>;
}

/** Mueve una cotización por los pasos de su flujo y asigna a cada responsable. */
export interface QuoteWorkflowService {
  /** Usa el flujo indicado, o el por defecto si es null. */
  start(quoteId: string, actorId: string, workflowId: string | null): Promise<Quote>;
  advance(quoteId: string, actorId: string, comment: string): Promise<Quote>;
  sendBack(quoteId: string, actorId: string, comment: string): Promise<Quote>;
  reassign(quoteId: string, actorId: string, assigneeId: string): Promise<Quote>;
  /** Tareas abiertas por usuario. */
  workload(): Promise<Record<string, number>>;
}
