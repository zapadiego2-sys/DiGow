import type { Cell, Workbook, Worksheet } from 'exceljs';
import type { CostLine } from '@/domain/cost';
import { QuoteImportError } from '@/domain/errors';
import { parseMeasureTerms } from '@/domain/measure';
import type { ImportWarning, QuoteImportResult } from '@/domain/ports';
import { DEFAULT_VAT_RATE, type QuoteDraft, type QuoteItem } from '@/domain/quote';
import { createId } from '@/shared/lib/id';

/** Valor de una celda ya interpretado. Nunca se ejecutan fórmulas: se usa el resultado guardado. */
interface SheetCell {
  address: string;
  row: number;
  col: number;
  text: string;
  number: number | null;
  date: Date | null;
  formula: string | null;
  isError: boolean;
  comment: string;
  label: string;
}

const LABELS = {
  client: 'cliente',
  contact: 'contacto',
  date: 'fecha',
  project: 'proyecto',
  payment: 'forma de pago',
  validity: 'validez de la oferta',
  delivery: 'tiempo de entrega',
  conditions: 'condiciones comerciales',
  signature: 'cordialmente',
  subtotal: 'sub total',
  vat: 'iva',
  total: 'valor total',
} as const;

const ITEM_HEADERS = {
  product: 'producto',
  description: 'descripcion',
  photo: 'foto referente',
  width: 'ancho',
  height: 'alto',
  depth: 'profund',
  quantity: 'cantidad',
  unitPrice: 'valor unidad',
  lineTotal: 'valor total',
} as const;

const FIRST_COST_HEADER = 'mdf 9mm';
const COST_TOTAL_HEADER = 'total';
/** Títulos del formato que no son datos. */
const DECORATIVE_LABELS = new Set(['cotizacion', 'observaciones']);
const KNOWN_LABELS = new Set<string>([...Object.values(LABELS), ...Object.values(ITEM_HEADERS)]);
const TOLERANCE = 0.01;
const MAX_LABEL_VALUE_GAP = 2;

const normalizeLabel = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s/:,]+|[\s/:,]+$/g, '');

function readValue(value: unknown): Pick<SheetCell, 'text' | 'number' | 'date' | 'isError'> {
  const empty = { text: '', number: null, date: null, isError: false };
  if (value === null || value === undefined) return empty;
  if (typeof value === 'number') return { ...empty, text: String(value), number: value };
  if (typeof value === 'string') return { ...empty, text: value };
  if (typeof value === 'boolean') return { ...empty, text: String(value) };
  if (value instanceof Date) return { ...empty, date: value };
  const object = value as Record<string, unknown>;
  if ('richText' in object) {
    const runs = object.richText as { text: string }[];
    return { ...empty, text: runs.map((run) => run.text).join('') };
  }
  if ('error' in object) return { ...empty, isError: true };
  if ('formula' in object || 'sharedFormula' in object) return readValue(object.result);
  if ('text' in object) return readValue(object.text);
  return empty;
}

function readComment(cell: Cell): string {
  const note = cell.note as unknown;
  if (!note) return '';
  if (typeof note === 'string') return note.trim();
  const texts = (note as { texts?: { text: string }[] }).texts ?? [];
  return texts
    .map((part) => part.text)
    .join('')
    .trim();
}

function readFormula(cell: Cell): string | null {
  const value = cell.value as { formula?: string; sharedFormula?: string } | null;
  if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    return cell.formula || value.formula || null;
  }
  return null;
}

function readSheet(worksheet: Worksheet): SheetCell[] {
  const cells: SheetCell[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      // Una celda combinada repite el valor de la principal: solo se lee esa.
      if (cell.master.address !== cell.address) return;
      const value = readValue(cell.value);
      const formula = readFormula(cell);
      const comment = readComment(cell);
      const hasContent =
        value.text.trim() || value.number !== null || value.date || value.isError || formula;
      if (!hasContent && !comment) return;
      cells.push({
        ...value,
        address: cell.address,
        row: rowNumber,
        col,
        formula,
        comment,
        label: normalizeLabel(value.text),
      });
    });
  });
  return cells;
}

class SheetReader {
  readonly warnings: ImportWarning[] = [];
  private readonly consumed = new Set<string>();
  private readonly cells: SheetCell[];

  constructor(cells: SheetCell[]) {
    this.cells = cells;
  }

  warn(message: string) {
    this.warnings.push({ message });
  }

  consume(cell: SheetCell | undefined) {
    if (cell) this.consumed.add(cell.address);
    return cell;
  }

  at(row: number, col: number) {
    return this.cells.find((c) => c.row === row && c.col === col);
  }

  find(label: string, fromRow = 0) {
    return this.cells.find((c) => c.row >= fromRow && c.label === label);
  }

  /** Celdas de una fila, de izquierda a derecha. */
  rowCells(row: number) {
    return this.cells.filter((c) => c.row === row).sort((a, b) => a.col - b.col);
  }

  /**
   * Valor contiguo a la derecha de una etiqueta. Otra etiqueta o una celda lejana,
   * como un encabezado de costos en la misma fila, significan que el valor falta.
   */
  valueOf(label: string, fromRow = 0): SheetCell | undefined {
    const labelCell = this.consume(this.find(label, fromRow));
    if (!labelCell) return undefined;
    const next = this.rowCells(labelCell.row).find((c) => c.col > labelCell.col);
    if (!next || KNOWN_LABELS.has(next.label)) return undefined;
    if (next.col - labelCell.col > MAX_LABEL_VALUE_GAP) return undefined;
    return this.consume(next);
  }

  labelledText(label: string, name: string): string {
    const text = this.valueOf(label)?.text.trim() ?? '';
    if (!text) this.warn(`No se encontró ${name}.`);
    return text;
  }

  unconsumed() {
    return this.cells.filter((c) => !this.consumed.has(c.address));
  }

  get lastRow() {
    return Math.max(0, ...this.cells.map((c) => c.row));
  }
}

function toIsoDate(cell: SheetCell | undefined): string | null {
  if (!cell) return null;
  // exceljs entrega las fechas en UTC.
  if (cell.date) return cell.date.toISOString().slice(0, 10);
  const text = cell.text.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return text;
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) return `${local[3]}-${local[2]!.padStart(2, '0')}-${local[1]!.padStart(2, '0')}`;
  return null;
}

function readDate(reader: SheetReader): string {
  const cell = reader.valueOf(LABELS.date);
  const iso = toIsoDate(cell);
  if (iso) return iso;
  reader.warn(
    cell
      ? `No se reconoció la fecha "${cell.text.trim()}". Escríbela en la vista previa.`
      : 'No se encontró la fecha.',
  );
  return '';
}

function readConditions(reader: SheetReader): string[] {
  const cell = reader.consume(
    reader.unconsumed().find((c) => c.label.startsWith(LABELS.conditions)),
  );
  if (!cell) {
    reader.warn('No se encontraron las condiciones comerciales.');
    return [];
  }
  const cleanLine = (line: string) => line.replace(/^[\s•·*-]+/, '').trim();
  const inCell = cell.text.split(/\r?\n/).slice(1).map(cleanLine).filter(Boolean);
  if (inCell.length > 0) return inCell;

  const below: string[] = [];
  for (let row = cell.row + 1; row <= reader.lastRow; row++) {
    const next = reader.at(row, cell.col);
    if (!next?.text.trim() || KNOWN_LABELS.has(next.label)) break;
    reader.consume(next);
    below.push(cleanLine(next.text));
  }
  if (below.length === 0) reader.warn('Las condiciones comerciales están vacías.');
  return below.filter(Boolean);
}

function readSignature(reader: SheetReader) {
  const label = reader.consume(reader.find(LABELS.signature));
  if (!label) {
    reader.warn('No se encontró quién firma la cotización.');
    return { name: '', role: '' };
  }
  const below = reader
    .unconsumed()
    .filter((c) => c.col === label.col && c.row > label.row && c.text.trim())
    .sort((a, b) => a.row - b.row)
    .slice(0, 2);
  below.forEach((cell) => reader.consume(cell));
  return { name: below[0]?.text.trim() ?? '', role: below[1]?.text.trim() ?? '' };
}

type ItemColumns = Partial<Record<keyof typeof ITEM_HEADERS, number>>;

function readItemColumns(reader: SheetReader, headerRow: number): ItemColumns {
  const columns: ItemColumns = {};
  const cells = reader.rowCells(headerRow);
  for (const key of Object.keys(ITEM_HEADERS) as (keyof typeof ITEM_HEADERS)[]) {
    const header = cells.find((c) => c.label === ITEM_HEADERS[key]);
    if (header) {
      reader.consume(header);
      columns[key] = header.col;
    } else {
      reader.warn(`No se encontró la columna "${ITEM_HEADERS[key].toUpperCase()}".`);
    }
  }
  return columns;
}

interface CostColumn {
  col: number;
  label: string;
}

interface CostLayout {
  columns: CostColumn[];
  headerRow: number;
  totalCol: number | null;
  firstCol: number;
}

function readCostLayout(reader: SheetReader): CostLayout | null {
  const first = reader.find(FIRST_COST_HEADER);
  if (!first) {
    reader.warn('No se encontraron las columnas de costos; la hoja de costos queda vacía.');
    return null;
  }
  const headers = reader.rowCells(first.row).filter((c) => c.col >= first.col);
  const total = headers.find((c) => c.label === COST_TOTAL_HEADER);
  if (!total) reader.warn('No se encontró la columna TOTAL de los costos.');
  const columns = headers.filter((c) => !total || c.col < total.col);
  columns.forEach((cell) => reader.consume(cell));
  reader.consume(total);
  return {
    columns: columns.map((c) => ({ col: c.col, label: c.text.trim() })),
    headerRow: first.row,
    totalCol: total?.col ?? null,
    firstCol: first.col,
  };
}

/** La nota conserva la fórmula, los valores auxiliares de la columna y los comentarios. */
function buildCostNote(reader: SheetReader, value: SheetCell, helpers: (SheetCell | undefined)[]) {
  const parts: string[] = [];
  if (value.formula) parts.push(`Fórmula: ${value.formula}`);
  for (const helper of helpers) {
    if (!helper) continue;
    reader.consume(helper);
    const content = helper.formula ?? (helper.text.trim() || null);
    if (content) parts.push(`${helper.address}: ${content}`);
    if (helper.comment) parts.push(helper.comment);
  }
  if (value.comment) parts.push(value.comment);
  return parts.join(' · ');
}

function readCostLines(
  reader: SheetReader,
  layout: CostLayout | null,
  row: number,
  firstItemRow: number,
) {
  const lines: CostLine[] = [];
  if (!layout) return lines;
  for (const column of layout.columns) {
    const value = reader.consume(reader.at(row, column.col));
    if (value?.number === null || value === undefined) {
      const problem = value?.isError ? 'tiene un error' : 'no tiene un valor calculado';
      reader.warn(`Fila ${row}: el costo "${column.label}" ${problem}; no se incluyó.`);
      continue;
    }
    const helpers: (SheetCell | undefined)[] = [];
    for (let helperRow = layout.headerRow + 1; helperRow < firstItemRow; helperRow++) {
      helpers.push(reader.at(helperRow, column.col));
    }
    lines.push({
      id: createId(),
      kind: 'fixed',
      label: column.label,
      note: buildCostNote(reader, value, helpers),
      materialId: null,
      value: value.number,
    });
  }
  return lines;
}

function readMeasure(reader: SheetReader, cell: SheetCell | undefined, row: number, name: string) {
  reader.consume(cell);
  if (!cell) {
    reader.warn(`Fila ${row}: falta ${name}.`);
    return null;
  }
  if (cell.number !== null) return cell.number;
  const terms = parseMeasureTerms(cell.text);
  if (!terms) {
    reader.warn(`Fila ${row}: no se pudo sumar ${name} "${cell.text.trim()}".`);
    return null;
  }
  return terms.reduce((total, term) => total + term, 0);
}

function toDataUrl(buffer: ArrayLike<number>, extension: string): string | null {
  const mime = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif' }[
    extension
  ];
  if (!mime) return null;
  const bytes = Uint8Array.from(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Solo sirve una imagen anclada a la fila del ítem y fuera de las columnas internas. */
function readPhoto(
  reader: SheetReader,
  workbook: Workbook,
  worksheet: Worksheet,
  row: number,
  layout: CostLayout | null,
): string | null {
  const anchored = worksheet.getImages().filter((image) => {
    const anchor = image.range.tl;
    const anchorRow = anchor.nativeRow ?? Math.floor(anchor.row);
    const anchorCol = anchor.nativeCol ?? Math.floor(anchor.col);
    return anchorRow + 1 === row && (!layout || anchorCol + 1 < layout.firstCol);
  });
  const [image] = anchored;
  if (!image) {
    reader.warn(`Fila ${row}: el ítem no tiene foto.`);
    return null;
  }
  if (anchored.length > 1) reader.warn(`Fila ${row}: hay varias fotos; se usó la primera.`);
  const media = workbook.getImage(Number(image.imageId));
  const dataUrl = media.buffer
    ? toDataUrl(media.buffer as unknown as ArrayLike<number>, media.extension)
    : null;
  if (!dataUrl) reader.warn(`Fila ${row}: la foto tiene un formato no compatible.`);
  return dataUrl;
}

function readItem(
  reader: SheetReader,
  context: {
    workbook: Workbook;
    worksheet: Worksheet;
    row: number;
    firstItemRow: number;
    columns: ItemColumns;
    layout: CostLayout | null;
  },
): QuoteItem {
  const { workbook, worksheet, row, firstItemRow, columns, layout } = context;
  const cellOf = (key: keyof ItemColumns) => {
    const col = columns[key];
    return col === undefined ? undefined : reader.at(row, col);
  };

  const product = reader.consume(cellOf('product'))?.text.trim() ?? '';
  if (!product) reader.warn(`Fila ${row}: falta el nombre del producto.`);
  const description = reader.consume(cellOf('description'))?.text.trim() ?? '';
  if (!description) reader.warn(`Fila ${row}: falta la descripción.`);

  const costLines = readCostLines(reader, layout, row, firstItemRow);

  // Precio: la celda sin encabezado a la derecha de TOTAL; de respaldo, VALOR UNIDAD.
  const fileUnitPrice = reader.consume(cellOf('unitPrice'))?.number ?? null;
  reader.consume(cellOf('lineTotal'));
  const internalPrice =
    layout?.totalCol != null
      ? (reader.consume(reader.at(row, layout.totalCol + 1))?.number ?? null)
      : null;
  const unitPrice = internalPrice ?? fileUnitPrice;
  if (unitPrice === null) reader.warn(`Fila ${row}: falta el precio de venta.`);
  if (internalPrice !== null && fileUnitPrice !== null && internalPrice !== fileUnitPrice) {
    reader.warn(
      `Fila ${row}: el precio interno (${internalPrice}) es distinto del valor unidad (${fileUnitPrice}); se usó el interno.`,
    );
  }

  if (layout?.totalCol != null) {
    const fileCost = reader.consume(reader.at(row, layout.totalCol))?.number ?? null;
    const sum = costLines.reduce(
      (total, line) => total + (line.kind === 'fixed' ? line.value : 0),
      0,
    );
    if (fileCost === null) {
      reader.warn(`Fila ${row}: la columna TOTAL de costos no tiene un valor.`);
    } else if (Math.abs(fileCost - sum) > TOLERANCE) {
      reader.warn(
        `Fila ${row}: el TOTAL de costos del archivo (${fileCost}) no coincide con la suma de las líneas (${sum}).`,
      );
    }
  }

  return {
    id: createId(),
    product,
    description,
    photoUrl: readPhoto(reader, workbook, worksheet, row, layout),
    width: readMeasure(reader, cellOf('width'), row, 'el ancho'),
    height: readMeasure(reader, cellOf('height'), row, 'el alto'),
    depth: readMeasure(reader, cellOf('depth'), row, 'la profundidad'),
    quantity: readMeasure(reader, cellOf('quantity'), row, 'la cantidad'),
    unitPrice,
    costLines,
    internalNotes: [],
  };
}

function readItems(
  reader: SheetReader,
  workbook: Workbook,
  worksheet: Worksheet,
  headerRow: number,
  layout: CostLayout | null,
): QuoteItem[] {
  const columns = readItemColumns(reader, headerRow);
  const clientCols = new Set(Object.values(columns));
  const firstItemRow = headerRow + 1;
  const stopLabels = new Set<string>([LABELS.subtotal, LABELS.vat, LABELS.total, 'observaciones']);
  const items: QuoteItem[] = [];

  for (let row = firstItemRow; row <= reader.lastRow; row++) {
    const cells = reader.rowCells(row).filter((c) => clientCols.has(c.col));
    if (cells.some((c) => stopLabels.has(c.label) || c.label.startsWith(LABELS.conditions))) break;
    if (cells.length === 0) continue;
    items.push(readItem(reader, { workbook, worksheet, row, firstItemRow, columns, layout }));
  }
  if (items.length === 0) reader.warn('No se encontraron ítems bajo los encabezados.');
  return items;
}

function readVatRate(reader: SheetReader, items: QuoteItem[], fromRow: number): number {
  const fileSubtotal = reader.valueOf(LABELS.subtotal, fromRow)?.number ?? null;
  const fileVat = reader.valueOf(LABELS.vat, fromRow)?.number ?? null;
  const fileTotal = reader.valueOf(LABELS.total, fromRow)?.number ?? null;

  let vatRate = DEFAULT_VAT_RATE;
  if (fileSubtotal && fileVat !== null) {
    vatRate = Math.round((fileVat / fileSubtotal) * 1e6) / 1e6;
  } else {
    reader.warn(
      `No se pudo leer el IVA del archivo; se usó el ${DEFAULT_VAT_RATE * 100} % por defecto.`,
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice ?? 0),
    0,
  );
  if (fileSubtotal !== null && Math.abs(fileSubtotal - subtotal) > TOLERANCE) {
    reader.warn(
      `El subtotal del archivo (${fileSubtotal}) no coincide con el calculado (${subtotal}).`,
    );
  }
  const total = subtotal + subtotal * vatRate;
  if (fileTotal !== null && Math.abs(fileTotal - total) > TOLERANCE) {
    reader.warn(`El total del archivo (${fileTotal}) no coincide con el calculado (${total}).`);
  }
  return vatRate;
}

/** Lo que queda fuera de la tabla se conserva como nota interna. */
function attachNotes(reader: SheetReader, items: QuoteItem[]) {
  const notes = reader
    .unconsumed()
    .filter((cell) => !DECORATIVE_LABELS.has(cell.label))
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .flatMap((cell) => [
      cell.text.trim() || (cell.number !== null ? String(cell.number) : ''),
      cell.comment,
    ])
    .filter(Boolean);
  if (notes.length === 0) return;
  const [first] = items;
  if (!first) {
    reader.warn(`Hay ${notes.length} notas del archivo que no se conservaron porque no hay ítems.`);
    return;
  }
  first.internalNotes.push(...notes);
  if (items.length > 1) reader.warn('Las notas del archivo se guardaron en el primer ítem.');
}

export function parseWorkbook(workbook: Workbook): QuoteImportResult {
  const [match, ...others] = workbook.worksheets
    .map((worksheet) => ({ worksheet, cells: readSheet(worksheet) }))
    .filter(({ cells }) => cells.some((cell) => cell.label === ITEM_HEADERS.product));
  if (!match) throw new QuoteImportError('unrecognized-structure');

  const reader = new SheetReader(match.cells);
  if (others.length > 0) {
    reader.warn(
      `El archivo tiene varias hojas con cotización; se importó "${match.worksheet.name}".`,
    );
  }

  const headerRow = reader.find(ITEM_HEADERS.product)!.row;
  const client = reader.labelledText(LABELS.client, 'el cliente');
  const contact = reader.labelledText(LABELS.contact, 'el contacto');
  const date = readDate(reader);
  const project = reader.labelledText(LABELS.project, 'el proyecto');
  const layout = readCostLayout(reader);
  const items = readItems(reader, workbook, match.worksheet, headerRow, layout);
  const vatRate = readVatRate(reader, items, headerRow + 1);
  const conditions = readConditions(reader);
  const paymentTerms = reader.labelledText(LABELS.payment, 'la forma de pago');
  const validity = reader.labelledText(LABELS.validity, 'la validez de la oferta');
  const deliveryTime = reader.labelledText(LABELS.delivery, 'el tiempo de entrega');
  const signature = readSignature(reader);
  attachNotes(reader, items);

  const draft: QuoteDraft = {
    status: 'draft',
    client,
    contact,
    date,
    project,
    managerName: signature.name,
    managerRole: signature.role,
    items,
    conditions,
    paymentTerms,
    validity,
    deliveryTime,
    vatRate,
  };
  return { draft, warnings: reader.warnings };
}
