// @vitest-environment node
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { lineCost } from '@/domain/cost';
import { itemCost, itemUnitProfit, quoteTotals } from '@/domain/quote';
import { XlsxQuoteImporter } from '@/infrastructure/xlsx/XlsxQuoteImporter';

const FIXTURE = 'tests/fixtures/cotizacion-ejemplo.xlsx';
const importer = new XlsxQuoteImporter();

const fileFrom = (bytes: ArrayBuffer | Uint8Array, name = 'cotizacion.xlsx') =>
  new File([bytes as BlobPart], name);
const fixtureFile = () => fileFrom(readFileSync(FIXTURE));

async function toFile(workbook: ExcelJS.Workbook) {
  return fileFrom(await workbook.xlsx.writeBuffer());
}

/** Crea un archivo mínimo con la estructura de referencia, para poder dañarlo por partes. */
function buildWorkbook(change?: (sheet: ExcelJS.Worksheet) => void) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('COTIZACION');
  sheet.getCell('A10').value = 'Cliente:';
  sheet.getCell('B10').value = 'ACME';
  sheet.getCell('D10').value = 'Fecha';
  sheet.getCell('E10').value = new Date(Date.UTC(2026, 0, 15));
  sheet.getCell('A11').value = 'Contacto:';
  sheet.getCell('B11').value = 'Ana';
  sheet.getCell('D11').value = 'Proyecto ';
  sheet.getCell('E11').value = 'Stand';
  sheet.getCell('K11').value = 'MDF 9MM';
  sheet.getCell('L11').value = 'OTROS';
  sheet.getCell('M11').value = 'TOTAL';
  const headers = [
    '/ PRODUCTO /',
    '/ DESCRIPCIÓN /',
    'FOTO REFERENTE',
    '/ ANCHO /',
    '/ ALTO /',
    '/ PROFUND /',
    ' / CANTIDAD /',
    '/ VALOR UNIDAD /',
    '/ VALOR  TOTAL /',
  ];
  headers.forEach((header, i) => (sheet.getRow(13).getCell(i + 1).value = header));
  const values = ['Stand', 'Descripción', null, 100, 200, 50, 2, 500, 1000];
  values.forEach((value, i) => (sheet.getRow(14).getCell(i + 1).value = value));
  sheet.getCell('K14').value = 100;
  sheet.getCell('L14').value = 50;
  sheet.getCell('M14').value = 150;
  sheet.getCell('N14').value = 500;
  sheet.getCell('H15').value = 'SUB TOTAL';
  sheet.getCell('I15').value = 1000;
  sheet.getCell('H16').value = 'IVA';
  sheet.getCell('I16').value = 190;
  sheet.getCell('H17').value = 'VALOR TOTAL';
  sheet.getCell('I17').value = 1190;
  sheet.getCell('A20').value = 'Condiciones Comerciales:\n•\tUna condición\n•\tOtra condición';
  sheet.getCell('A24').value = 'Forma de pago /';
  sheet.getCell('B24').value = 'Contado';
  sheet.getCell('A25').value = 'Validez de la oferta /';
  sheet.getCell('B25').value = '15 días';
  sheet.getCell('A26').value = 'Tiempo de entrega /';
  sheet.getCell('B26').value = '1 semana';
  sheet.getCell('A28').value = 'Cordialmente,';
  sheet.getCell('A31').value = 'Laura';
  sheet.getCell('A32').value = 'Gestora';
  change?.(sheet);
  return workbook;
}

const messages = (warnings: { message: string }[]) => warnings.map((w) => w.message).join(' | ');

describe('archivo de referencia', () => {
  it('reproduce los resultados de context/dominio.md', async () => {
    const { draft } = await importer.import(fixtureFile());
    const item = draft.items[0]!;
    expect(draft.items).toHaveLength(1);
    expect(itemCost(item)).toBeCloseTo(2201733.33, 2);
    expect(item.unitPrice).toBe(2400000);
    expect(itemUnitProfit(item)).toBeCloseTo(198266.67, 2);
    const totals = quoteTotals(draft);
    expect(totals.subtotal).toBe(2400000);
    expect(totals.vat).toBeCloseTo(456000, 6);
    expect(totals.total).toBeCloseTo(2856000, 6);
  });

  it('no genera avisos', async () => {
    const { warnings } = await importer.import(fixtureFile());
    expect(warnings).toEqual([]);
  });

  it('lee los datos generales por etiqueta', async () => {
    const { draft } = await importer.import(fixtureFile());
    expect(draft).toMatchObject({
      status: 'draft',
      client: 'EMPRESA DEMO',
      contact: 'Ana Ejemplo',
      date: '2026-01-15',
      project: 'Carrito Demo',
      managerName: 'Laura Prueba',
      managerRole: 'Gestora de proyectos',
      paymentTerms: 'A convenir',
      validity: '30 días',
      deliveryTime: 'A convenir',
      vatRate: 0.19,
    });
  });

  it('lee el ítem y suma el alto 80+110', async () => {
    const { draft } = await importer.import(fixtureFile());
    expect(draft.items[0]).toMatchObject({
      product: 'Carrito de ejemplo',
      width: 120,
      height: 190,
      depth: 70,
      quantity: 1,
    });
    expect(draft.items[0]!.description).toContain(
      'Medida: 120 x 80 x 70 profund Alto: 1,9 mt aprox',
    );
    expect(draft.items[0]!.description).toContain('bisagras y pasadores');
  });

  it('importa cada costo como fixed con su fórmula como nota', async () => {
    const { draft } = await importer.import(fixtureFile());
    const lines = draft.items[0]!.costLines;
    expect(lines.map((line) => line.label)).toEqual([
      'MDF 9MM',
      'POLI 100',
      'MDF 12MM',
      'TUBO ACERO INOX 1" RED CAL 18',
      'LONA ROJA',
      'VINILO',
      'MANO DE OBRA',
      'RUEDAS CON FRENO',
      'BISAGRA CAPSULA CON ALETA',
      'PASADORES',
      'OTROS',
    ]);
    expect(lines.every((line) => line.kind === 'fixed')).toBe(true);
    expect(lineCost(lines[0]!)).toBeCloseTo(360000, 2);
    expect(lines[0]!.note).toContain('K12*2');
    expect(lines[0]!.note).toContain('90000/0.5');
    expect(lines[5]!.note).toContain('30000*P12');
    expect(lines[6]!.note).toContain('200000*4');
  });

  it('conserva los comentarios de las celdas de costos', async () => {
    const { draft } = await importer.import(fixtureFile());
    const lines = draft.items[0]!.costLines;
    expect(lines[3]!.note).toContain('Aceros Demo');
    expect(lines[2]!.note).toContain('superficie, base y techo');
    expect(lines[6]!.note).toContain('2 dias 2 personas');
  });

  it('conserva las celdas sueltas como notas internas, sin títulos ni datos ya leídos', async () => {
    const { draft } = await importer.import(fixtureFile());
    expect(draft.items[0]!.internalNotes).toEqual([
      'Revisar "riel"',
      'Cotizacion de referencia - para 3 und $1.900.000 / para una unidad $2.000.000',
    ]);
  });

  it('lee las 7 condiciones, sin viñetas ni la etiqueta', async () => {
    const { draft } = await importer.import(fixtureFile());
    expect(draft.conditions).toHaveLength(7);
    expect(draft.conditions[0]).toBe('Los precios incluyen transporte local');
    expect(draft.conditions.join()).not.toMatch(/Condiciones Comerciales|•/);
  });

  it('usa la foto del ítem y no el logo ni la captura externa', async () => {
    const { draft } = await importer.import(fixtureFile());
    const photo = draft.items[0]!.photoUrl!;
    expect(photo.startsWith('data:image/png;base64,')).toBe(true);
    const expected = readFileSync('public/seed/carrito-ejemplo.png').toString('base64');
    expect(photo.split(',')[1]).toBe(expected);
  });
});

describe('archivos no válidos', () => {
  it('rechaza otra extensión', async () => {
    await expect(importer.import(fileFrom(new Uint8Array([1]), 'a.xls'))).rejects.toMatchObject({
      code: 'invalid-type',
    });
  });

  it('rechaza más de 10 MB', async () => {
    const large = fileFrom(new Uint8Array(10 * 1024 * 1024 + 1));
    await expect(importer.import(large)).rejects.toMatchObject({ code: 'too-large' });
  });

  it('informa un archivo que no es un .xlsx real', async () => {
    const fake = fileFrom(new TextEncoder().encode('esto no es un excel'));
    await expect(importer.import(fake)).rejects.toMatchObject({ code: 'damaged' });
  });

  it('informa un archivo truncado', async () => {
    const bytes = readFileSync(FIXTURE);
    const truncated = fileFrom(bytes.subarray(0, Math.floor(bytes.length / 2)));
    await expect(importer.import(truncated)).rejects.toMatchObject({ code: 'damaged' });
  });

  it('informa un archivo vacío', async () => {
    await expect(importer.import(fileFrom(new Uint8Array(0)))).rejects.toMatchObject({
      code: 'damaged',
    });
  });

  it('informa un Excel con otra estructura', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Otra').getCell('A1').value = 'Inventario';
    await expect(importer.import(await toFile(workbook))).rejects.toMatchObject({
      code: 'unrecognized-structure',
    });
  });
});

describe('datos faltantes: avisan y no inventan', () => {
  it('un archivo completo no avisa, salvo la foto', async () => {
    const { warnings, draft } = await importer.import(await toFile(buildWorkbook()));
    expect(messages(warnings)).toBe('Fila 14: el ítem no tiene foto.');
    expect(draft.client).toBe('ACME');
    expect(draft.date).toBe('2026-01-15');
    expect(draft.items[0]!.unitPrice).toBe(500);
    expect(draft.conditions).toEqual(['Una condición', 'Otra condición']);
  });

  it('no toma la etiqueta vecina como valor', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('B10').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.client).toBe('');
    expect(messages(warnings)).toContain('No se encontró el cliente.');
  });

  it.each([
    ['A11', 'el contacto'],
    ['E11', 'el proyecto'],
    ['B24', 'la forma de pago'],
    ['B25', 'la validez de la oferta'],
    ['B26', 'el tiempo de entrega'],
    ['E10', 'la fecha'],
  ])('sin %s avisa que falta %s', async (cell, name) => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell(cell).value = null));
    const { warnings } = await importer.import(await toFile(workbook));
    expect(messages(warnings)).toContain(`No se encontró ${name}.`);
  });

  it('una fecha que no se reconoce avisa y queda vacía', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('E10').value = 'pronto'));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.date).toBe('');
    expect(messages(warnings)).toContain('No se reconoció la fecha "pronto"');
  });

  it('acepta una fecha escrita como dd/mm/aaaa', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('E10').value = '7/3/2026'));
    const { draft } = await importer.import(await toFile(workbook));
    expect(draft.date).toBe('2026-03-07');
  });

  it('un alto que no se puede sumar avisa y queda vacío', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('E14').value = '90 aprox'));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.height).toBeNull();
    expect(messages(warnings)).toContain('no se pudo sumar el alto "90 aprox"');
  });

  it('sin precio ni valor unidad avisa y queda vacío', async () => {
    const workbook = buildWorkbook((sheet) => {
      sheet.getCell('H14').value = null;
      sheet.getCell('N14').value = null;
    });
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.unitPrice).toBeNull();
    expect(messages(warnings)).toContain('falta el precio de venta');
  });

  it('sin columna interna usa VALOR UNIDAD como respaldo, sin avisar', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('N14').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.unitPrice).toBe(500);
    expect(messages(warnings)).not.toContain('precio');
  });

  it('avisa si el precio interno y el valor unidad difieren', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('N14').value = 600));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.unitPrice).toBe(600);
    expect(messages(warnings)).toContain('es distinto del valor unidad');
  });

  it('un costo sin valor no se incluye y avisa', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('L14').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.costLines.map((l) => l.label)).toEqual(['MDF 9MM']);
    expect(messages(warnings)).toContain('el costo "OTROS" no tiene un valor calculado');
  });

  it('una fórmula sin resultado guardado no se ejecuta', async () => {
    const workbook = buildWorkbook((sheet) => {
      sheet.getCell('L14').value = { formula: 'K14*2' } as ExcelJS.CellFormulaValue;
    });
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.costLines.map((l) => l.label)).toEqual(['MDF 9MM']);
    expect(messages(warnings)).toContain('"OTROS"');
  });

  it('una celda con error de Excel avisa', async () => {
    const workbook = buildWorkbook((sheet) => {
      sheet.getCell('L14').value = { error: '#REF!' } as ExcelJS.CellErrorValue;
    });
    const { warnings } = await importer.import(await toFile(workbook));
    expect(messages(warnings)).toContain('el costo "OTROS"');
  });

  it('avisa si TOTAL no coincide con la suma', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('M14').value = 999));
    const { warnings } = await importer.import(await toFile(workbook));
    expect(messages(warnings)).toContain('no coincide con la suma');
  });

  it('avisa si los totales del archivo no coinciden', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('I17').value = 5));
    const { warnings } = await importer.import(await toFile(workbook));
    expect(messages(warnings)).toContain('El total del archivo (5)');
  });

  it('sin IVA en el archivo usa el valor por defecto y lo avisa', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('I16').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.vatRate).toBe(0.19);
    expect(messages(warnings)).toContain('se usó el 19 % por defecto');
  });

  it('sin columnas de costos avisa y deja la hoja vacía', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('K11').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.items[0]!.costLines).toEqual([]);
    expect(messages(warnings)).toContain('No se encontraron las columnas de costos');
  });

  it('sin condiciones no usa las de por defecto', async () => {
    const workbook = buildWorkbook((sheet) => (sheet.getCell('A20').value = null));
    const { warnings, draft } = await importer.import(await toFile(workbook));
    expect(draft.conditions).toEqual([]);
    expect(messages(warnings)).toContain('No se encontraron las condiciones comerciales');
  });

  it('importa varios ítems y calcula sus totales', async () => {
    const workbook = buildWorkbook((sheet) => {
      sheet.spliceRows(15, 0, []);
      const added = sheet.getRow(15);
      ['Mesa', 'Otra', null, 10, 10, 10, 1, 100, 100].forEach(
        (value, i) => (added.getCell(i + 1).value = value),
      );
      sheet.getCell('K15').value = 10;
      sheet.getCell('L15').value = 5;
      sheet.getCell('M15').value = 15;
      sheet.getCell('N15').value = 100;
    });
    const { draft } = await importer.import(await toFile(workbook));
    expect(draft.items.map((item) => item.product)).toEqual(['Stand', 'Mesa']);
    expect(quoteTotals(draft).subtotal).toBe(1100);
  });
});
