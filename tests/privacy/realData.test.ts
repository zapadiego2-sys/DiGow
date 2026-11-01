// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

// Fragmentos partidos para que este archivo no contenga los nombres completos que vigila.
const FORBIDDEN = [
  ['ate', 'nea'],
  ['mari', 'ana gut'],
  ['dani', 'ela mon'],
  ['pre', 'bel'],
  ['aci', 'nox'],
  ['color', 'liquido'],
  ['fill', 'ings'],
  ['medel', 'l'],
].map((parts) => parts.join(''));

const IGNORED = new Set(['node_modules', 'dist', 'dev-dist', '.git', 'package-lock.json']);

function projectFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => !IGNORED.has(name))
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? projectFiles(path) : [path];
    });
}

describe('el repositorio no contiene datos reales', () => {
  const files = projectFiles('.');

  it.each(files.filter((file) => /\.(ts|tsx|mjs|js|json|md|html|css)$/.test(file)))(
    '%s',
    (file) => {
      const text = readFileSync(file, 'utf8').toLowerCase();
      for (const word of FORBIDDEN) expect(text).not.toContain(word);
    },
  );

  it('los nombres de archivo tampoco los mencionan', () => {
    for (const file of files) {
      for (const word of FORBIDDEN) expect(file.toLowerCase()).not.toContain(word);
    }
  });
});

describe('el Excel de prueba es ficticio', () => {
  it('ni sus celdas, comentarios o metadatos contienen datos reales', async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('tests/fixtures/cotizacion-ejemplo.xlsx');
    const parts: string[] = [workbook.creator ?? '', workbook.lastModifiedBy ?? ''];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          parts.push(JSON.stringify(cell.value), JSON.stringify(cell.note ?? ''));
        });
      });
    });
    const text = parts.join(' ').toLowerCase();
    expect(text).toContain('empresa demo');
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
  });
});
