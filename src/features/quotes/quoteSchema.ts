import { z } from 'zod';
import { productKinds } from '@/domain/catalog';
import type { ConditionsRef } from '@/domain/conditions';
import { formulaLineCost } from '@/domain/cost';
import { quoteStatuses } from '@/domain/quote';
import { lengthUnits } from '@/domain/units';
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
  z
    .object({
      ...lineBase,
      kind: z.literal('formula'),
      formula: z
        .object({ id: z.string(), name: z.string(), expression: z.string(), version: z.number() })
        .nullable(),
      values: z.record(z.string(), z.number(NUMBER_REQUIRED)),
    })
    .superRefine((line, context) => {
      if (!line.formula) {
        context.addIssue({ code: 'custom', path: ['formula'], message: 'Elige una fórmula.' });
      } else if (!Number.isFinite(formulaLineCost(line))) {
        context.addIssue({
          code: 'custom',
          path: ['formula'],
          message: 'La fórmula no se puede calcular con estos valores.',
        });
      }
    }),
]);

const nonEmptyLines = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

const subItemSchema = z.object({
  id: z.string(),
  catalogSubItemId: z.string().nullable(),
  name: z.string().trim().min(1, 'Escribe el nombre del sub-ítem.'),
  description: z.string(),
  quantity: optionalAmount(),
  predictive: z.boolean(),
  costLines: z.array(costLineSchema),
});

const itemSchema = z.object({
  id: z.string(),
  catalogItemId: z.string().nullable(),
  kind: z.enum(productKinds).nullable(),
  predictive: z.boolean(),
  product: z.string().trim().min(1, 'Escribe el producto.'),
  description: z.string(),
  photoUrl: z.string().nullable(),
  width: optionalAmount(),
  height: optionalAmount(),
  depth: optionalAmount(),
  quantity: optionalAmount(),
  unitPrice: optionalAmount(),
  costLines: z.array(costLineSchema),
  subItems: z.array(subItemSchema),
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
  measureUnit: z.enum(lengthUnits),
  conditionsRef: z.custom<ConditionsRef | null>(),
  createdBy: z.string().nullable(),
  template: z.custom<QuoteTemplateRef | null>(),
  customFields: z.array(customFieldSchema),
  // El flujo se mueve con sus propias acciones; el formulario solo lo conserva.
  workflow: z.custom<QuoteWorkflowState | null>(),
});
