import type { ReactNode } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { FormField } from '@/shared/ui/FormField';
import { Input, Textarea } from '@/shared/ui/Input';
import { MoneyField, NumberField } from '@/shared/ui/NumberField';
import { Select, type SelectOption } from '@/shared/ui/Select';

interface FieldProps {
  name: string;
  label: string;
  hint?: ReactNode;
}

function useField(name: string) {
  const { control } = useFormContext();
  return useController({ control, name });
}

export function TextField({
  name,
  label,
  hint,
  type = 'text',
}: FieldProps & { type?: 'text' | 'date' }) {
  const { field, fieldState } = useField(name);
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => <Input {...control} {...field} value={field.value ?? ''} type={type} />}
    </FormField>
  );
}

export function TextAreaField({ name, label, hint }: FieldProps) {
  const { field, fieldState } = useField(name);
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => <Textarea {...control} {...field} value={field.value ?? ''} rows={4} />}
    </FormField>
  );
}

/** Edita una lista de textos como un texto de varias líneas, una por elemento. */
export function LinesField({ name, label, hint }: FieldProps) {
  const { field, fieldState } = useField(name);
  const lines = (field.value ?? []) as string[];
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => (
        <Textarea
          {...control}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={lines.join('\n')}
          rows={Math.max(3, lines.length + 1)}
          onChange={(event) => field.onChange(event.target.value.split('\n'))}
        />
      )}
    </FormField>
  );
}

export function NumericField({ name, label, hint }: FieldProps) {
  const { field, fieldState } = useField(name);
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => (
        <NumberField
          {...control}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={field.value ?? null}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );
}

export function CurrencyField({ name, label, hint }: FieldProps) {
  const { field, fieldState } = useField(name);
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => (
        <MoneyField
          {...control}
          name={field.name}
          ref={field.ref}
          onBlur={field.onBlur}
          value={field.value ?? null}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );
}

export function SelectField<T extends string>({
  name,
  label,
  hint,
  options,
}: FieldProps & { options: readonly SelectOption<T>[] }) {
  const { field, fieldState } = useField(name);
  return (
    <FormField label={label} hint={hint} error={fieldState.error?.message}>
      {(control) => (
        <Select {...control} value={field.value} options={options} onValueChange={field.onChange} />
      )}
    </FormField>
  );
}
