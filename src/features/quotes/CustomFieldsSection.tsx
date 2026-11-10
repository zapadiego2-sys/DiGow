import type { ComponentType } from 'react';
import { useWatch } from 'react-hook-form';
import type { QuoteCustomField, TemplateFieldType } from '@/domain/template';
import { Card } from '@/shared/ui/Card';
import {
  CheckboxField,
  NumericField,
  SelectField,
  TextAreaField,
  TextField,
} from '../forms/fields';

interface RendererProps {
  name: string;
  label: string;
  hint: string | undefined;
  field: QuoteCustomField;
}

/** Un control por tipo de campo. Un tipo nuevo solo agrega una entrada aquí. */
const RENDERERS: Record<TemplateFieldType, ComponentType<RendererProps>> = {
  text: ({ name, label, hint }) => <TextField name={name} label={label} hint={hint} />,
  longText: ({ name, label, hint }) => <TextAreaField name={name} label={label} hint={hint} />,
  number: ({ name, label, hint }) => <NumericField name={name} label={label} hint={hint} />,
  date: ({ name, label, hint }) => <TextField name={name} label={label} hint={hint} type="date" />,
  select: ({ name, label, hint, field }) => (
    <SelectField
      name={name}
      label={label}
      hint={hint}
      placeholder="Elige una opción"
      options={field.options.map((option) => ({ value: option, label: option }))}
    />
  ),
  checkbox: ({ name, label, hint }) => <CheckboxField name={name} label={label} hint={hint} />,
};

const WIDE: ReadonlySet<TemplateFieldType> = new Set(['longText', 'checkbox']);

/** Campos que la plantilla agrega a la cotización. */
export function CustomFieldsSection() {
  const fields = (useWatch({ name: 'customFields' }) ?? []) as QuoteCustomField[];
  if (fields.length === 0) return null;

  return (
    <Card className="flex flex-col gap-md" aria-labelledby="project-fields-heading">
      <h2 id="project-fields-heading" className="text-title">
        Datos del proyecto
      </h2>
      <div className="grid gap-md sm:grid-cols-2">
        {fields.map((field, index) => {
          const Renderer = RENDERERS[field.type];
          const label =
            field.required || field.type === 'checkbox' ? field.label : `${field.label} (opcional)`;
          const hint =
            [field.hint, field.showToClient ? 'Aparece en la vista para el cliente.' : '']
              .filter(Boolean)
              .join(' ') || undefined;
          return (
            <div key={field.id} className={WIDE.has(field.type) ? 'sm:col-span-2' : undefined}>
              <Renderer
                name={`customFields.${index}.value`}
                label={label}
                hint={hint}
                field={field}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
