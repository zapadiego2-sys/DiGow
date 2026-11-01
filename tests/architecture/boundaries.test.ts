// @vitest-environment node
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function isRejected(filePath: string, source: string) {
  const [result] = await eslint.lintText(source, { filePath });
  return (result?.messages ?? []).some((m) => m.ruleId === 'no-restricted-imports');
}

describe('reglas de arquitectura', () => {
  it.each([
    ['src/features/quotes/Screen.tsx', "import { x } from '@/infrastructure/seed';"],
    ['src/features/quotes/Screen.tsx', "import { x } from '../../infrastructure/seed';"],
    ['src/features/quotes/Screen.tsx', "import { x } from '@/app/App';"],
    ['src/shared/ui/Button.tsx', "import { x } from '@/domain/quote';"],
    ['src/shared/ui/Button.tsx', "import { x } from '@/features/quotes/x';"],
    ['src/domain/quote.ts', "import { x } from '@/shared/lib/format';"],
    ['src/domain/quote.ts', "import { x } from 'react';"],
    ['src/infrastructure/seed/index.ts', "import { x } from '@/features/quotes/x';"],
    ['src/features/import/Screen.tsx', "import ExcelJS from 'exceljs';"],
    ['src/infrastructure/mock/repo.ts', "import ExcelJS from 'exceljs';"],
  ])('rechaza en %s: %s', async (filePath, source) => {
    expect(await isRejected(filePath, source)).toBe(true);
  });

  it.each([
    ['src/features/quotes/Screen.tsx', "import { x } from '@/domain/quote';"],
    ['src/features/quotes/Screen.tsx', "import { x } from '@/shared/ui/Button';"],
    ['src/infrastructure/mock/repo.ts', "import { x } from '@/domain/quote';"],
    ['src/infrastructure/xlsx/importer.ts', "import ExcelJS from 'exceljs';"],
    ['src/app/App.tsx', "import { x } from '@/infrastructure/seed';"],
  ])('permite en %s: %s', async (filePath, source) => {
    expect(await isRejected(filePath, source)).toBe(false);
  });
});
