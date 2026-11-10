export const templateFieldTypes = [
  'text',
  'longText',
  'number',
  'date',
  'select',
  'checkbox',
] as const;
export type TemplateFieldType = (typeof templateFieldTypes)[number];

export interface TemplateField {
  id: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  /** Solo para `select`. */
  options: string[];
  hint: string;
  /** Un campo marcado aparece en la vista para el cliente. Por defecto es interno. */
  showToClient: boolean;
}

export type CustomFieldValue = string | number | boolean | null;

/** Campo de la plantilla copiado a la cotización junto con su valor. */
export interface QuoteCustomField extends TemplateField {
  value: CustomFieldValue;
}

/** Qué medidas pide cada ítem. Un impreso, por ejemplo, no tiene profundidad. */
export interface ItemMeasures {
  width: boolean;
  height: boolean;
  depth: boolean;
}

export const ALL_MEASURES: ItemMeasures = { width: true, height: true, depth: true };

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string;
  active: boolean;
  /** null usa el flujo por defecto. */
  workflowId: string | null;
  fields: TemplateField[];
  measures: ItemMeasures;
  conditions: string[];
  paymentTerms: string;
  validity: string;
  deliveryTime: string;
  vatRate: number;
}

export type QuoteTemplateDraft = Omit<QuoteTemplate, 'id'>;

/** Referencia que la cotización guarda de su plantilla. */
export interface QuoteTemplateRef {
  id: string;
  name: string;
  measures: ItemMeasures;
}

export function emptyFieldValue(type: TemplateFieldType): CustomFieldValue {
  return type === 'checkbox' ? false : null;
}

export function isFieldValueMissing(field: Pick<QuoteCustomField, 'type' | 'value'>): boolean {
  if (field.type === 'checkbox') return false;
  if (field.value === null) return true;
  return typeof field.value === 'string' && !field.value.trim();
}
