// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const design = readFileSync('DESIGN.md', 'utf8');
const tokens = readFileSync('src/app/styles/tokens.css', 'utf8');

function section(name: string): [string, string][] {
  const match = design.match(new RegExp(`^${name}:\\n((?:  .+\\n)+)`, 'm'));
  if (!match?.[1]) throw new Error(`Sección ${name} no encontrada`);
  return [...match[1].matchAll(/^ {2}([\w-]+): "?([^"\n]+)"?$/gm)].map((m) => [m[1]!, m[2]!]);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('tokens de DESIGN.md', () => {
  it.each(section('colors'))('color %s coincide', (name, value) => {
    expect(tokens.toLowerCase()).toContain(`--color-${name}: ${value.toLowerCase()};`);
  });

  it.each(section('rounded'))('radio %s coincide', (name, value) => {
    expect(tokens).toContain(`--radius-${name}: ${value};`);
  });

  it.each(section('spacing'))('espaciado %s coincide', (name, value) => {
    expect(tokens).toContain(`--spacing-${name}: ${value};`);
  });

  it('las tipografías coinciden', () => {
    const blocks = design.matchAll(
      / {2}([\w-]+):\n {4}fontFamily: Inter\n {4}fontSize: (\w+)\n {4}fontWeight: (\d+)\n {4}lineHeight: ([\d.]+)/g,
    );
    let count = 0;
    for (const [, name, size, weight, lineHeight] of blocks) {
      expect(tokens).toContain(`--text-${name}: ${size};`);
      expect(tokens).toContain(`--text-${name}--font-weight: ${weight};`);
      expect(tokens).toContain(`--text-${name}--line-height: ${lineHeight};`);
      count++;
    }
    expect(count).toBe(9);
  });
});

describe('los componentes usan solo tokens', () => {
  const files = sourceFiles('src').filter((file) => /\.tsx?$/.test(file));

  it.each(files)('%s no tiene colores ni valores arbitrarios', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!\w)/);
    expect(source).not.toMatch(/\b(?:rgb|rgba|hsl|hsla|oklch)\(/);
    // Clases arbitrarias de Tailwind como p-[13px] o text-[#fff]
    expect(source).not.toMatch(/\b[a-z-]+-\[[^\]]+\]/);
    // Tamaños numéricos de Tailwind, que no existen en la escala de tokens
    expect(source).not.toMatch(/["'` ](?:p|px|py|m|mx|my|gap|h|w)-\d+\b(?!\/)/);
    expect(source).not.toMatch(/\bstyle=\{\{/);
  });
});
