/**
 * Motor de fórmulas de costo. Analiza y evalúa expresiones aritméticas con variables, sin `eval`:
 * una fórmula escrita en el panel administrativo nunca puede ejecutar código.
 *
 * Sintaxis: números (1.5 o 1,5), variables, + - * / ^, paréntesis y funciones con argumentos
 * separados por punto y coma, como en Excel en español: max(ancho; alto).
 */

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

type Node =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'unary'; operand: Node }
  | { type: 'binary'; operator: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] };

const FUNCTIONS: Record<string, { arity: [number, number]; apply: (...args: number[]) => number }> =
  {
    redondear: {
      arity: [1, 2],
      apply: (x, digits = 0) => Math.round(x * 10 ** digits) / 10 ** digits,
    },
    redondear_arriba: { arity: [1, 1], apply: (x) => Math.ceil(x) },
    redondear_abajo: { arity: [1, 1], apply: (x) => Math.floor(x) },
    min: { arity: [1, 20], apply: (...args) => Math.min(...args) },
    max: { arity: [1, 20], apply: (...args) => Math.max(...args) },
    si_mayor: {
      // si_mayor(a; b; entonces; si_no): devuelve `entonces` si a > b.
      arity: [4, 4],
      apply: (a, b, then, otherwise) => (a > b ? then : otherwise),
    },
  };

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS);

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:[.,]\d+)?)|([a-z_áéíóúñ][a-z0-9_áéíóúñ]*)|([-+*/^();]))/iy;
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index]!)) {
      index++;
      continue;
    }
    pattern.lastIndex = index;
    const match = pattern.exec(source);
    if (!match) throw new FormulaError(`Carácter no válido: "${source[index]}".`);
    index = pattern.lastIndex;
    if (match[1]) tokens.push({ kind: 'number', value: Number(match[1].replace(',', '.')) });
    else if (match[2]) tokens.push({ kind: 'name', value: match[2].toLowerCase() });
    else tokens.push({ kind: 'op', value: match[3]! });
  }
  return tokens;
}

class Parser {
  private position = 0;
  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Node {
    if (this.tokens.length === 0) throw new FormulaError('La fórmula está vacía.');
    const node = this.expression();
    if (this.position < this.tokens.length) {
      throw new FormulaError(`Sobra algo después de la posición ${this.position + 1}.`);
    }
    return node;
  }

  private peek(value: string): boolean {
    const token = this.tokens[this.position];
    return token?.kind === 'op' && token.value === value;
  }

  private expect(value: string) {
    if (!this.peek(value)) throw new FormulaError(`Falta "${value}".`);
    this.position++;
  }

  private expression(): Node {
    let left = this.term();
    while (this.peek('+') || this.peek('-')) {
      const operator = (this.tokens[this.position++] as { value: '+' | '-' }).value;
      left = { type: 'binary', operator, left, right: this.term() };
    }
    return left;
  }

  private term(): Node {
    let left = this.power();
    while (this.peek('*') || this.peek('/')) {
      const operator = (this.tokens[this.position++] as { value: '*' | '/' }).value;
      left = { type: 'binary', operator, left, right: this.power() };
    }
    return left;
  }

  private power(): Node {
    const base = this.unary();
    if (this.peek('^')) {
      this.position++;
      return { type: 'binary', operator: '^', left: base, right: this.power() };
    }
    return base;
  }

  private unary(): Node {
    if (this.peek('-')) {
      this.position++;
      return { type: 'unary', operand: this.unary() };
    }
    if (this.peek('+')) {
      this.position++;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): Node {
    const token = this.tokens[this.position];
    if (!token) throw new FormulaError('La fórmula termina antes de tiempo.');
    if (token.kind === 'number') {
      this.position++;
      return { type: 'number', value: token.value };
    }
    if (token.kind === 'name') {
      this.position++;
      if (!this.peek('(')) return { type: 'variable', name: token.value };
      this.position++;
      const args: Node[] = [];
      if (!this.peek(')')) {
        args.push(this.expression());
        while (this.peek(';')) {
          this.position++;
          args.push(this.expression());
        }
      }
      this.expect(')');
      return { type: 'call', name: token.value, args };
    }
    if (token.value === '(') {
      this.position++;
      const node = this.expression();
      this.expect(')');
      return node;
    }
    throw new FormulaError(`No se esperaba "${token.value}".`);
  }
}

function collect(node: Node, variables: Set<string>, calls: Node[]) {
  if (node.type === 'variable') variables.add(node.name);
  else if (node.type === 'unary') collect(node.operand, variables, calls);
  else if (node.type === 'binary') {
    collect(node.left, variables, calls);
    collect(node.right, variables, calls);
  } else if (node.type === 'call') {
    calls.push(node);
    node.args.forEach((arg) => collect(arg, variables, calls));
  }
}

export interface FormulaAnalysis {
  variables: string[];
}

/** Valida la sintaxis, las funciones y que cada variable esté permitida. */
export function analyzeFormula(expression: string, allowed: readonly string[]): FormulaAnalysis {
  const ast = new Parser(tokenize(expression)).parse();
  const variables = new Set<string>();
  const calls: Node[] = [];
  collect(ast, variables, calls);
  for (const call of calls) {
    if (call.type !== 'call') continue;
    const fn = FUNCTIONS[call.name];
    if (!fn) throw new FormulaError(`La función "${call.name}" no existe.`);
    const [minArgs, maxArgs] = fn.arity;
    if (call.args.length < minArgs || call.args.length > maxArgs) {
      throw new FormulaError(`"${call.name}" recibe un número de valores no válido.`);
    }
  }
  const allowedSet = new Set(allowed.map((name) => name.toLowerCase()));
  for (const name of variables) {
    if (!allowedSet.has(name)) throw new FormulaError(`La variable "${name}" no existe.`);
  }
  return { variables: [...variables] };
}

function evaluateNode(node: Node, values: Readonly<Record<string, number>>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable': {
      const value = values[node.name];
      if (value === undefined) throw new FormulaError(`Falta el valor de "${node.name}".`);
      return value;
    }
    case 'unary':
      return -evaluateNode(node.operand, values);
    case 'binary': {
      const left = evaluateNode(node.left, values);
      const right = evaluateNode(node.right, values);
      if (node.operator === '+') return left + right;
      if (node.operator === '-') return left - right;
      if (node.operator === '*') return left * right;
      if (node.operator === '/') {
        if (right === 0) throw new FormulaError('La fórmula divide entre 0.');
        return left / right;
      }
      return left ** right;
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) throw new FormulaError(`La función "${node.name}" no existe.`);
      return fn.apply(...node.args.map((arg) => evaluateNode(arg, values)));
    }
  }
}

/** Lanza FormulaError si la fórmula no se puede evaluar. Conserva todos los decimales. */
export function evaluateFormula(
  expression: string,
  values: Readonly<Record<string, number>>,
): number {
  const lowered = Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const result = evaluateNode(new Parser(tokenize(expression)).parse(), lowered);
  if (!Number.isFinite(result)) throw new FormulaError('El resultado no es un número.');
  return result;
}

/** Variables que toda fórmula puede usar. Las medidas llegan en cm. */
export const FORMULA_VARIABLES: readonly { name: string; label: string }[] = [
  { name: 'ancho', label: 'Ancho del ítem en cm' },
  { name: 'alto', label: 'Alto del ítem en cm' },
  { name: 'profundidad', label: 'Profundidad del ítem en cm' },
  { name: 'area_m2', label: 'Ancho × alto en m²' },
  { name: 'perimetro_m', label: 'Perímetro de ancho y alto en m' },
  { name: 'volumen_m3', label: 'Ancho × alto × profundidad en m³' },
  { name: 'cantidad', label: 'Cantidad de unidades del ítem' },
  { name: 'costo', label: 'Costo del material elegido, por su unidad' },
];

export interface FormulaParam {
  /** Nombre que se usa dentro de la expresión. */
  name: string;
  label: string;
  defaultValue: number;
}

export interface CostFormula {
  id: string;
  name: string;
  description: string;
  expression: string;
  params: FormulaParam[];
  active: boolean;
  /** Sube con cada cambio; la línea de costo guarda la versión que usó. */
  version: number;
}

export type CostFormulaDraft = Omit<CostFormula, 'id' | 'version'>;

export function allowedVariables(params: readonly Pick<FormulaParam, 'name'>[]): string[] {
  return [...FORMULA_VARIABLES.map((v) => v.name), ...params.map((p) => p.name)];
}

export const PARAM_NAME = /^[a-z_][a-z0-9_]*$/;
