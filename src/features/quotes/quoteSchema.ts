import { z } from 'zod';
import { quoteStatuses } from '@/domain/quote';
import { isFieldValueMissing, templateFieldTypes, type QuoteTemplateRef } from '@/domain/template';
import type { QuoteWorkflowState } from '@/domain/workflow';

const NUMBER_REQUIRED = 'Escribe un número.';
const NOT_NEGATIVE = 'No puede ser negativo.';

const amount = () => z.number(NUMBER_REQUIRED).nonnegative(NOT_NEGATIVE);
const optionalAmount = () => amount().nullable();

const lineBase = {
  id: z.string(),
  label: z.string().trim().min(1, 'Escribe el nombre de la línea.'),
  note: z.string(),
  materialId: z.string().nullable(),
};

const costLineSchema = z.discriminatedUnion('kind', [
  z.object({ ...lineBase, kind: z.literal('unit'), quantity: amount(), unitCost: amount() }),
  z.object({
    ...lineBase,
    kind: z.literal('area'),
    areasCm2: z.array(amount(), 'Escribe las áreas como números o una suma de medidas.'),
    costPerCm2: amount(),
  }),
  z.object({
    ...lineBase,
    kind: z.literal('labor'),
    days: amount(),
    people: amount(),
    dailyRate: amount(),
  }),
  z.object({ ...lineBase, kind: z.literal('fixed'), value: amount() }),
]);

const nonEmptyLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

const itemSchema = z.object({
  id: z.string(),
  product: z.string().trim().min(1, 'Escribe el producto.'),
  description: z.string(),
  photoUrl: z.string().nullable(),
  width: optionalAmount(),
  height: optionalAmount(),
  depth: optionalAmount(),
  quantity: optionalAmount(),
  unitPrice: optionalAmount(),
  costLines: z.array(costLineSchema),
  internalNotes: z.array(z.string()).transform(nonEmptyLines),
});

const customFieldSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    type: z.enum(templateFieldTypes),
    required: z.boolean(),
    options: z.array(z.string()),
    hint: z.string(),
    showToClient: z.boolean(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  })
  .superRefine((field, context) => {
    if (field.required && isFieldValueMissing(field)) {
      context.addIssue({ code: 'custom', path: ['value'], message: `Completa "${field.label}".` });
    }
  });

export const quoteFormSchema = z.object({
  status: z.enum(quoteStatuses),
  client: z.string().trim().min(1, 'Escribe el cliente.'),
  contact: z.string().trim(),
  date: z.string(),
  project: z.string().trim(),
  managerName: z.string().trim(),
  managerRole: z.string().trim(),
  items: z.array(itemSchema),
  conditions: z.array(z.string()).transform(nonEmptyLines),
  paymentTerms: z.string().trim(),
  validity: z.string().trim(),
  deliveryTime: z.string().trim(),
  vatRate: z.number(NUMBER_REQUIRED).nonnegative(NOT_NEGATIVE),
  createdBy: z.string().nullable(),
  template: z.custom<QuoteTemplateRef | null>(),
  customFields: z.array(customFieldSchema),
  // El flujo se mueve con sus propias acciones; el formulario solo lo conserva.
  workflow: z.custom<QuoteWorkflowState | null>(),
});
