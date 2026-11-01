import { useState, type ComponentProps } from 'react';
import {
  formatMoney,
  formatNumber,
  parseDecimal,
  parseMoney,
  toEditableNumber,
} from '../lib/format';
import { cn } from '../lib/cn';
import { Input } from './Input';

interface NumericInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

interface NumericBehavior {
  format: (value: number | null) => string;
  parse: (text: string) => number | null;
}

/**
 * Muestra el valor formateado y, al enfocar, el valor completo para editar.
 * Solo notifica cuando el texto cambia: enfocar y salir no altera los decimales.
 */
function NumericInput({
  value,
  onChange,
  format,
  parse,
  className,
  onBlur,
  onFocus,
  ...props
}: NumericInputProps & NumericBehavior) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : format(value));

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn('tabular text-right', className)}
      value={shown}
      onFocus={(event) => {
        setDraft(toEditableNumber(value));
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        if (!text.trim()) {
          onChange(null);
          return;
        }
        const parsed = parse(text);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={(event) => {
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}

export function NumberField(props: NumericInputProps) {
  return <NumericInput format={formatNumber} parse={parseDecimal} {...props} />;
}

export function MoneyField(props: NumericInputProps) {
  return <NumericInput format={formatMoney} parse={parseMoney} {...props} />;
}
