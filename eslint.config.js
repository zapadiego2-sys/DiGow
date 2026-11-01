import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const layer = (name) => ({ group: [`@/${name}`, `@/${name}/**`, `**/${name}/**`] });
const layerMessage = (group, message) => ({ ...layer(group), message });

const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const noExcelJs = {
  group: ['exceljs', 'exceljs/**'],
  message: 'Solo infrastructure/xlsx conoce exceljs.',
};

const toDomainOnly = 'Regla de arquitectura: domain no depende de nada.';
const noInfrastructure =
  'Regla de arquitectura: solo app/ conoce infrastructure. Depende de las interfaces de domain.';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-restricted-imports': ['error', { patterns: [noExcelJs] }],
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: restrict(
      noExcelJs,
      layerMessage('app', toDomainOnly),
      layerMessage('features', toDomainOnly),
      layerMessage('shared', toDomainOnly),
      layerMessage('infrastructure', toDomainOnly),
      { group: ['react', 'react-dom', 'react/**', 'zod'], message: toDomainOnly },
    ),
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: restrict(
      noExcelJs,
      layerMessage('infrastructure', noInfrastructure),
      layerMessage('app', 'Regla de arquitectura: features no depende de app.'),
    ),
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: restrict(
      noExcelJs,
      layerMessage('infrastructure', noInfrastructure),
      layerMessage('app', 'Regla de arquitectura: shared no conoce la app.'),
      layerMessage('features', 'Regla de arquitectura: shared no conoce el negocio.'),
      layerMessage('domain', 'Regla de arquitectura: shared no conoce el negocio.'),
    ),
  },
  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    ignores: ['src/infrastructure/xlsx/**'],
    rules: restrict(
      noExcelJs,
      layerMessage('app', 'Regla de arquitectura: infrastructure solo implementa domain.'),
      layerMessage('features', 'Regla de arquitectura: infrastructure solo implementa domain.'),
    ),
  },
  {
    files: ['src/infrastructure/xlsx/**/*.ts', 'tests/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
);
