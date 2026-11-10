import type { Worksheet } from 'exceljs';
import { FileImportError } from '@/domain/errors';
import type { MaterialDraft } from '@/domain/material';
import type {
  ImportWarning,
  MaterialImporter,
  MaterialImportResult,
  MaterialImportRow,
} from '@/domain/ports';
import { parseDecimal, parseMoney } from '@/shared/lib/format';
import { loadExcelJs, loadWorkbook } from './loadWorkbook';
import { normalizeLabel, readValue } from './parseWorkbook';

type Column = 'name' | 'supplier' | 'purchasePrice' | 'factor' | 'sheetArea' | 'directCost';

/** Encabezados aceptados, ya normalizados. El primero es el que lleva la plantilla. */
const HEADERS: Record<Column, string[]> = {
  name: ['nombre', 'material'],
  supplier: ['proveedor'],
  purchasePrice: ['precio de compra', 'precio'],
  factor: ['factor'],
  sheetArea: ['area de la lamina (cm2)', 'area de la lamina', 'area lamina', 'area'],
  directCost: ['costo directo', 'costo'],
};

const TEMPLATE_HEADERS: Record<Column, string> = {
  name: 'Nombre',
  supplier: 'Proveedor',
  purchasePrice: 'Precio de compra',
  factor: 'Factor',
  sheetArea: 'Área de la lámina (cm2)',
  directCost: 'Costo directo',
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
): { draft: MaterialDraft | null; errors: string[] } {
  const errors: string[] = [];
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

  const draft: MaterialDraft = hasDirect
    ? { name, supplier, pricing: { mode: 'direct', unitCost: directCost.value! } }
    : {
        name,
        supplier,
        pricing: {
          mode: 'factor',
          purchasePrice: purchasePrice.value!,
          factor: factor.value!,
          sheetAreaCm2: sheetArea.value,
        },
      };
  return { draft, errors };
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
      !name && !supplier && Object.values(values).every((v) => v.value === null && !v.invalid);
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
    rows.push({ row: index, name, ...toDraft(name, supplier, values) });
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
    sheet.addRow(['MDF 15 mm', 'Proveedor Demo', 150000, 0.5, null, null]);
    sheet.addRow(['Acrílico 3 mm', '', 200000, 0.75, 122 * 244, null]);
    sheet.addRow(['Adhesivo', '', null, null, null, 3]);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((column) => (column.width = 24));
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}
