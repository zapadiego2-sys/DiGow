const LOCALE = 'es-CO';

const moneyFormat = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 });

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const percentFormat = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 2 });

const MISSING = '—';

/** Redondea solo para mostrar. */
export function formatMoney(value: number | null): string {
  return value === null || Number.isNaN(value) ? MISSING : moneyFormat.format(value);
}

export function formatNumber(value: number | null): string {
  return value === null ? MISSING : numberFormat.format(value);
}

export function formatPercent(rate: number): string {
  return percentFormat.format(rate);
}

/** Recibe una fecha ISO (AAAA-MM-DD). La zona UTC evita que cambie de día. */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? MISSING : dateFormat.format(date);
}

export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Texto para editar un número sin perder decimales. */
export function toEditableNumber(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/** "1,5" y "1.5" son 1,5. Devuelve null si el texto no es un número. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  return /^\d*\.?\d+$|^\d+\.$/.test(normalized) ? Number(normalized) : null;
}

/** En dinero el punto separa miles: "2.400.000" y "$ 2.400.000,5" son válidos. */
export function parseMoney(text: string): number | null {
  const normalized = text.replace(/[$\s]/g, '').replace(/\./g, '').replace(',', '.');
  return /^\d*\.?\d+$|^\d+\.$/.test(normalized) ? Number(normalized) : null;
}
