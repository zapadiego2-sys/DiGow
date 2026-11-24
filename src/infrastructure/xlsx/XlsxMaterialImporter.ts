import type { Worksheet } from 'exceljs';
import { FileImportError } from '@/domain/errors';
import type { MaterialDraft, MaterialUnit } from '@/domain/material';
import type {
  ImportWarning,
  MaterialImporter,
  MaterialImportResult,
  MaterialImportRow,
} from '@/domain/ports';
import { parseDecimal, parseMoney } from '@/shared/lib/format';
import { loadExcelJs, loadWorkbook } from './loadWorkbook';
import { normalizeLabel, readValue } from './parseWorkbook';

type Column =
  'name' | 'supplier' | 'purchasePrice' | 'factor' | 'sheetArea' | 'directCost' | 'unit';

/** Cómo puede escribirse cada unidad en el archivo, ya normalizada. */
const UNIT_NAMES: Record<string, MaterialUnit> = {
  unidad: 'unit',
  und: 'unit',
  u: 'unit',
  cm2: 'cm2',
  'cm²': 'cm2',
  m2: 'm2',
  'm²': 'm2',
  'metro lineal': 'linear_m',
  'metros lineales': 'linear_m',
  ml: 'linear_m',
  'cm lineal': 'linear_cm',
  'centimetro lineal': 'linear_cm',
};

/** Encabezados aceptados, ya normalizados. El primero es el que lleva la plantilla. */
const HEADERS: Record<Column, string[]> = {
  name: ['nombre', 'material'],
  supplier: ['proveedor'],
  purchasePrice: ['precio de compra', 'precio'],
  factor: ['factor'],
  sheetArea: ['area de la lamina (cm2)', 'area de la lamina', 'area lamina', 'area'],
  directCost: ['costo directo', 'costo'],
  unit: ['unidad', 'unidad de medida'],
};

const TEMPLATE_HEADERS: Record<Column, string> = {
  name: 'Nombre',
  supplier: 'Proveedor',
  purchasePrice: 'Precio de compra',
  factor: 'Factor',
  sheetArea: 'Área de la lámina (cm2)',
  directCost: 'Costo directo',
  unit: 'Unidad',
};

const HEADER_SEARCH_ROWS = 10;

function columnOf(label: string): Column | null {
  const normalized = normalizeLabel(label);
  for (const [column, names] of Object.entries(HEADERS) as [Column, string[]][]) {
    if (names.includes(normalized)) return column;
  }
  return null;
}

function findHeader(sheet: Worksheet): { row: number; columns: Map<Column, number> } | null {
  for (let row = 1; row <= Math.min(HEADER_SEARCH_ROWS, sheet.rowCount); row++) {
    const columns = new Map<Column, number>();
    sheet.getRow(row).eachCell((cell, col) => {
      const column = columnOf(readValue(cell.value).text);
      if (column && !columns.has(column)) columns.set(column, col);
    });
    if (columns.has('name')) return { row, columns };
  }
  return null;
}

type Reading = { value: number | null; invalid: boolean };

function readNumber(raw: unknown, parse: (text: string) => number | null): Reading {
  const { text, number } = readValue(raw);
  if (number !== null) return { value: number, invalid: false };
  if (!text.trim()) return { value: null, invalid: false };
  const parsed = parse(text);
  return parsed === null ? { value: null, invalid: true } : { value: parsed, invalid: false };
}

function toDraft(
  name: string,
  supplier: string,
  values: Record<'purchasePrice' | 'factor' | 'sheetArea' | 'directCost', Reading>,
  unitText: string,
): { draft: MaterialDraft | null; errors: string[] } {
  const errors: string[] = [];
  const unitKey = normalizeLabel(unitText);
  const namedUnit = unitKey ? UNIT_NAMES[unitKey] : undefined;
  if (unitKey && !namedUnit) {
    errors.push(
      `La unidad "${unitText}" no se reconoce. Usa unidad, cm2, m2, metro lineal o cm lineal.`,
    );
  }
  const labels = {
    purchasePrice: 'precio de compra',
    factor: 'factor',
    sheetArea: 'área de la lámina',
    directCost: 'costo directo',
  };
  for (const [key, reading] of Object.entries(values) as [keyof typeof labels, Reading][]) {
    if (reading.invalid) errors.push(`El ${labels[key]} no es un número.`);
    else if (reading.value !== null && reading.value < 0)
      errors.push(`El ${labels[key]} no puede ser negativo.`);
  }
  if (!name) errors.push('Falta el nombre.');
  const { purchasePrice, factor, sheetArea, directCost } = values;
  const hasDirect = directCost.value !== null;
  const hasFactor = purchasePrice.value !== null || factor.value !== null;
  if (hasDirect && hasFactor) {
    errors.push('Escribe el precio de compra y el factor, o el costo directo, pero no ambos.');
  } else if (!hasDirect && !hasFactor) {
    errors.push('Falta el precio de compra y el factor, o el costo directo.');
  } else if (!hasDirect) {
    if (purchasePrice.value === null) errors.push('Falta el precio de compra.');
    if (factor.value === null) errors.push('Falta el factor.');
    else if (factor.value <= 0) errors.push('El factor debe ser mayor que 0.');
  }
  if (sheetArea.value !== null && sheetArea.value <= 0)
    errors.push('El área de la lámina debe ser mayor que 0.');
  if (errors.length > 0) return { draft: null, errors };

  // Sin columna de unidad se conserva el comportamiento anterior: láminas y costos directos por cm².
  const unit: MaterialUnit = namedUnit ?? (hasDirect || sheetArea.value !== null ? 'cm2' : 'unit');
  const pricing: MaterialDraft['pricing'] = hasDirect
    ? { mode: 'direct', unitCost: directCost.value! }
    : {
        mode: 'factor',
        purchasePrice: purchasePrice.value!,
        factor: factor.value!,
        sheetAreaCm2: sheetArea.value,
      };
  // La cantidad la escribe el analista hasta que se configure una regla en el catálogo.
  return { draft: { name, supplier, pricing, unit, quantityRule: 'manual' }, errors };
}

export function parseMaterialSheet(sheet: Worksheet): MaterialImportResult {
  const header = findHeader(sheet);
  if (!header) throw new FileImportError('no-material-headers');
  const warnings: ImportWarning[] = [];
  for (const column of ['purchasePrice', 'factor', 'directCost'] as const) {
    if (!header.columns.has(column)) {
      warnings.push({ message: `No encontramos la columna "${TEMPLATE_HEADERS[column]}".` });
    }
  }

  const rows: MaterialImportRow[] = [];
  const seen = new Map<string, number>();
  for (let index = header.row + 1; index <= sheet.rowCount; index++) {
    const row = sheet.getRow(index);
    const cell = (column: Column) => {
      const col = header.columns.get(column);
      return col ? row.getCell(col).value : null;
    };
    const name = readValue(cell('name')).text.trim();
    const supplier = readValue(cell('supplier')).text.trim();
    const values = {
      purchasePrice: readNumber(cell('purchasePrice'), parseMoney),
      factor: readNumber(cell('factor'), parseDecimal),
      sheetArea: readNumber(cell('sheetArea'), parseDecimal),
      directCost: readNumber(cell('directCost'), parseDecimal),
    };
    const empty =
      !name &&
      !supplier &&
      !readValue(cell('unit')).text.trim() &&
      Object.values(values).every((v) => v.value === null && !v.invalid);
    if (empty) continue;

    const key = normalizeLabel(name);
    if (name && seen.has(key)) {
      warnings.push({
        message: `"${name}" aparece en las filas ${seen.get(key)} y ${index}; se carga la última.`,
      });
      const previous = rows.find((r) => normalizeLabel(r.name) === key && r.draft);
      if (previous) {
        previous.draft = null;
        previous.errors = [`Reemplazada por la fila ${index}.`];
      }
    }
    seen.set(key, index);
    const unitText = readValue(cell('unit')).text.trim();
    rows.push({ row: index, name, ...toDraft(name, supplier, values, unitText) });
  }
  if (rows.length === 0)
    warnings.push({ message: 'El archivo no tiene materiales debajo de los encabezados.' });
  return { rows, warnings };
}

export class XlsxMaterialImporter implements MaterialImporter {
  async read(file: File): Promise<MaterialImportResult> {
    const workbook = await loadWorkbook(file);
    const sheet = workbook.worksheets.find((s) => findHeader(s) !== null);
    if (!sheet) throw new FileImportError('no-material-headers');
    return parseMaterialSheet(sheet);
  }

  async template(): Promise<Blob> {
    const ExcelJS = await loadExcelJs();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Materiales');
    const columns = Object.values(TEMPLATE_HEADERS);
    sheet.addRow(columns);
    sheet.addRow(['MDF 15 mm', 'Proveedor Demo', 150000, 0.5, null, null, 'unidad']);
    sheet.addRow(['Acrílico 3 mm', '', 200000, 0.75, 122 * 244, null, 'cm2']);
    sheet.addRow(['Lona impresa', '', null, null, null, 45000, 'm2']);
    sheet.addRow(['Perfil de aluminio', '', null, null, null, 25000, 'metro lineal']);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => (column.width = 24));
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
