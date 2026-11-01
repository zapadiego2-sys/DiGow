// Genera la foto de ejemplo y tests/fixtures/cotizacion-ejemplo.xlsx. Todos los datos son ficticios.
// El archivo imita la estructura descrita en context/dominio.md, con sus dificultades: texto
// enriquecido, celdas combinadas, fórmulas con resultado guardado, comentarios y varias imágenes.
import { mkdirSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { encodePng } from './png.mjs';

const inside = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;

function drawCart() {
  const SKY = [0xe8, 0xed, 0xf6];
  const FLOOR = [0xd5, 0xda, 0xe1];
  const CANOPY = [0x2a, 0x4a, 0x82];
  const BODY = [0x1f, 0x38, 0x64];
  const POST = [0x7c, 0x87, 0x96];
  const WHEEL = [0x1a, 0x22, 0x33];
  return encodePng(370, 480, (x, y) => {
    if (inside(x, y, 40, 50, 330, 120)) return CANOPY;
    if (inside(x, y, 60, 120, 72, 270) || inside(x, y, 298, 120, 310, 270)) return POST;
    if (inside(x, y, 40, 270, 330, 430)) return BODY;
    if (Math.hypot(x - 75, y - 440) < 16 || Math.hypot(x - 295, y - 440) < 16) return WHEEL;
    return y > 430 ? FLOOR : SKY;
  });
}

const solid = (width, height, color) => encodePng(width, height, () => color);

const rich = (...texts) => ({ richText: texts.map((text) => ({ text })) });
const formula = (expression, result) => ({ formula: expression, result });

const photo = drawCart();
mkdirSync('public/seed', { recursive: true });
writeFileSync('public/seed/carrito-ejemplo.png', photo);

const workbook = new ExcelJS.Workbook();
workbook.creator = 'Cotizador';
const sheet = workbook.addWorksheet('OPCION 3');
const put = (address, value) => (sheet.getCell(address).value = value);

for (const range of [
  'A8:I9',
  'B10:C10',
  'E10:I10',
  'B11:C11',
  'E11:I11',
  'K9:K10',
  'L15:T15',
  'A19:I19',
  'A20:I22',
]) {
  sheet.mergeCells(range);
}

put('A8', rich(' /', ' COTIZACIÓN ', '/'));
put('K9', 'Revisar "riel"');
put('A10', 'Cliente:');
put('B10', 'EMPRESA DEMO');
put('D10', 'Fecha');
put('E10', new Date(Date.UTC(2026, 0, 15)));
put('A11', 'Contacto:');
put('B11', 'Ana Ejemplo');
put('D11', 'Proyecto ');
put('E11', 'Carrito Demo ');

const costs = [
  ['K', 'MDF 9MM', '90000/0.5', 90000 / 0.5, (u) => ['K12*2', u * 2]],
  [
    'L',
    'POLI 100',
    '(120000/0.75)/100/300',
    120000 / 0.75 / 100 / 300,
    (u) => ['(120*80*L12)+(80*70*L12*2)', 120 * 80 * u + 80 * 70 * u * 2],
  ],
  ['M', 'MDF 12MM', '120000/0.5', 120000 / 0.5, (u) => ['M12', u]],
  ['N', 'TUBO ACERO INOX 1" RED CAL 18', '60000/0.75', 60000 / 0.75, (u) => ['N12*1.5', u * 1.5]],
  ['O', 'LONA ROJA', '5*0.8', 5 * 0.8, (u) => ['180*140*O12', 180 * 140 * u]],
  ['P', 'VINILO', null, 6, (u) => ['30000*P12', 30000 * u]],
  ['Q', 'MANO DE OBRA', null, null, () => ['200000*4', 800000]],
  ['R', 'RUEDAS CON FRENO', '15000/0.75', 15000 / 0.75, (u) => ['R12*4', u * 4]],
  ['S', 'BISAGRA CAPSULA CON ALETA', '3000/0.75', 3000 / 0.75, (u) => ['S12*6', u * 6]],
  ['T', 'PASADORES', '4500/0.75', 4500 / 0.75, (u) => ['T12*6', u * 6]],
];

let costTotal = 0;
for (const [column, header, helperFormula, helper, line] of costs) {
  put(`${column}11`, header);
  if (helper !== null) put(`${column}12`, helperFormula ? formula(helperFormula, helper) : helper);
  const [expression, value] = line(helper);
  put(`${column}14`, formula(expression, value));
  costTotal += value;
}
put('U11', 'OTROS');
put('U14', 150000);
costTotal += 150000;
put('V11', 'TOTAL');
put('V14', formula('SUM(K14:U14)', costTotal));
sheet.getCell('N12').note = 'Aceros Demo';
sheet.getCell('M14').note = 'superficie, base y techo';
sheet.getCell('Q14').note = '2 dias 2 personas';

const UNIT_PRICE = 2400000;
put('W14', UNIT_PRICE);

const headers = [
  'PRODUCTO',
  'DESCRIPCIÓN',
  null,
  'ANCHO',
  'ALTO',
  'PROFUND',
  'CANTIDAD',
  'VALOR UNIDAD',
  'VALOR  TOTAL',
];
headers.forEach((header, i) => {
  sheet.getRow(13).getCell(i + 1).value = header ? rich('/ ', header, ' /') : 'FOTO REFERENTE';
});

put('A14', 'Carrito de ejemplo');
put(
  'B14',
  rich(
    'Medida: 120 x 80 x 70 profund ',
    'Alto: ',
    '1,9 mt aprox / Mdf 9mm + mdf 12mm + imagen en poliestireno cal 100 + parales en tubo redondo acero inox + lona roja + vinilo + ruedas con freno + bisagras y pasadores',
  ),
);
put('D14', 120);
put('E14', '80+110');
put('F14', 70);
put('G14', 1);
put('H14', formula('W14', UNIT_PRICE));
put('I14', formula('G14*H14', UNIT_PRICE));

put('H15', 'SUB TOTAL ');
put('I15', formula('SUM(I14:I14)', UNIT_PRICE));
put('L15', 'Cotizacion de referencia - para 3 und $1.900.000 / para una unidad $2.000.000');
put('H16', 'IVA');
put('I16', formula('I15*19%', UNIT_PRICE * 0.19));
put('H17', 'VALOR TOTAL');
put('I17', formula('SUM(I15:I16)', UNIT_PRICE * 1.19));

put('A19', rich('OBSERVACIONES', ' /'));
put(
  'A20',
  rich(
    'Condiciones Comerciales:',
    `
•\tLos precios incluyen transporte local
•\tEl tiempo de producción contará a partir de la aprobación por parte del cliente y entrega de artes finales.
•\tEste trabajo se cotiza para producirse en horarios de producción que no sean festivos. En caso de requerirse, los valores pueden variar.
•\tLos precios no incluyen el diseño gráfico, en caso de que por un acuerdo de nivel de servicio se solicite, éstos tendrán un costo adicional.
•\tSi las especificaciones de la producción final cambian con respecto a la cotización previa, se procederá a recotizar según las características del trabajo entregado
•\tLuego de 5 días de recibido el trabajo no se aceptarán reclamos.
•\tEsta cotización está basada en la información suministrada por el cliente, cualquier cambio afectará el valor de la misma.`,
  ),
);

put('A24', rich('Forma de pago', ' /'));
put('B24', 'A convenir ');
put('A25', rich('Validez de la oferta ', '/'));
put('B25', '30 días');
put('A26', rich('Tiempo de entrega ', '/'));
put('B26', 'A convenir ');
put('A28', 'Cordialmente,');
put('A31', 'Laura Prueba ');
put('A32', 'Gestora de proyectos');

// Tres imágenes, como el archivo real: logo, foto del ítem y una captura fuera de la tabla.
const addImage = (buffer, tl, ext) =>
  sheet.addImage(workbook.addImage({ buffer, extension: 'png' }), { tl, ext });
addImage(solid(80, 20, [0xff, 0xff, 0xff]), { col: 0.2, row: 3.2 }, { width: 240, height: 60 });
addImage(photo, { col: 2.5, row: 13.2 }, { width: 185, height: 240 });
addImage(solid(120, 40, [0xee, 0xf1, 0xf5]), { col: 9.2, row: 15.2 }, { width: 600, height: 200 });

mkdirSync('tests/fixtures', { recursive: true });
writeFileSync(
  'tests/fixtures/cotizacion-ejemplo.xlsx',
  Buffer.from(await workbook.xlsx.writeBuffer()),
);
