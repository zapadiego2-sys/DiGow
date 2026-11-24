import type { User } from '@/domain/access';
import type { Material } from '@/domain/material';
import type { Quote, QuoteItem } from '@/domain/quote';
import type { QuoteTemplate } from '@/domain/template';
import type { Workflow, WorkflowStep } from '@/domain/workflow';
import { CONDITIONS_IDS } from '../seed/processSeed';

/**
 * Migraciones de los datos guardados en el navegador: migrations[n] convierte datos vn en vn+1.
 * Lo que la versión anterior no tenía queda vacío o con el valor que no cambia el resultado.
 */

type Rows = Record<string, unknown>[];
const rows = (data: unknown) => data as Rows;

/** v2 agrega autor, plantilla, campos propios y flujo. */
const quotesV1: (data: unknown) => unknown = (data) =>
  rows(data).map((quote) => ({
    ...quote,
    createdBy: null,
    template: null,
    customFields: [],
    workflow: null,
  }));

function stepV2(step: Record<string, unknown>): WorkflowStep {
  return { gate: 'none', ...step } as WorkflowStep;
}

/** v3 agrega unidad de medida, condiciones aplicadas, catálogo, tipo y sub-ítems. */
const quotesV2: (data: unknown) => unknown = (data) =>
  rows(data).map((quote): Quote => {
    const template = quote.template as Record<string, unknown> | null;
    const workflow = quote.workflow as Record<string, unknown> | null;
    return {
      ...(quote as unknown as Quote),
      measureUnit: 'cm',
      conditionsRef: null,
      template: template
        ? ({ standardSizes: [], ...template } as unknown as Quote['template'])
        : null,
      workflow: workflow
        ? ({
            ...workflow,
            steps: (workflow.steps as Record<string, unknown>[]).map(stepV2),
          } as Quote['workflow'])
        : null,
      items: (quote.items as Rows).map(
        (item) =>
          ({
            catalogItemId: null,
            kind: null,
            predictive: true,
            subItems: [],
            ...item,
          }) as unknown as QuoteItem,
      ),
    };
  });

export const quoteMigrations = { 1: quotesV1, 2: quotesV2 };

/** v2 agrega la unidad y la regla de cantidad. Antes, láminas y costos directos iban por cm². */
export const materialMigrations = {
  1: (data: unknown) =>
    rows(data).map((material): Material => {
      const pricing = material.pricing as Material['pricing'];
      const perArea = pricing.mode === 'direct' || pricing.sheetAreaCm2 !== null;
      return {
        ...(material as unknown as Material),
        unit: perArea ? 'cm2' : 'unit',
        quantityRule: 'manual',
      };
    }),
};

/** v2 agrega el cargo. */
export const userMigrations = {
  1: (data: unknown) => rows(data).map((user) => ({ title: '', ...user }) as unknown as User),
};

/** v2 agrega la validación de cada paso. */
export const workflowMigrations = {
  1: (data: unknown) =>
    rows(data).map(
      (workflow) =>
        ({
          ...workflow,
          steps: (workflow.steps as Record<string, unknown>[]).map(stepV2),
        }) as unknown as Workflow,
    ),
};

/** v2 lleva las condiciones a una plantilla de condiciones con versiones, y agrega la unidad. */
export const templateMigrations = {
  1: (data: unknown) =>
    rows(data).map((template): QuoteTemplate => {
      const { conditions, paymentTerms, validity, deliveryTime, ...rest } = template;
      void [conditions, paymentTerms, validity, deliveryTime];
      return {
        ...(rest as unknown as QuoteTemplate),
        measureUnit: 'cm',
        standardSizes: [],
        conditionsTemplateId: CONDITIONS_IDS.standard,
      };
    }),
};
