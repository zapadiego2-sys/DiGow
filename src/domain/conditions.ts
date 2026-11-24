export interface ConditionsContent {
  conditions: string[];
  paymentTerms: string;
  validity: string;
  deliveryTime: string;
}

/** Una versión publicada no cambia nunca: editar la plantilla crea otra. */
export interface ConditionsVersion extends ConditionsContent {
  version: number;
  createdAt: string;
  createdBy: string | null;
}

export interface ConditionsTemplate {
  id: string;
  name: string;
  active: boolean;
  /** De la más antigua a la más reciente. Siempre hay al menos una. */
  versions: ConditionsVersion[];
}

export interface NewConditionsTemplate extends ConditionsContent {
  name: string;
}

/** Lo que guarda la cotización: qué plantilla y qué versión se aplicó. */
export interface ConditionsRef {
  templateId: string;
  name: string;
  version: number;
}

export function latestVersion(template: ConditionsTemplate): ConditionsVersion {
  const latest = template.versions.at(-1);
  if (!latest) throw new RangeError('Una plantilla de condiciones necesita una versión.');
  return latest;
}

export function sameContent(a: ConditionsContent, b: ConditionsContent): boolean {
  return (
    a.paymentTerms === b.paymentTerms &&
    a.validity === b.validity &&
    a.deliveryTime === b.deliveryTime &&
    a.conditions.length === b.conditions.length &&
    a.conditions.every((line, index) => line === b.conditions[index])
  );
}

/** Agrega una versión. Si el contenido no cambió, la plantilla queda igual. */
export function addVersion(
  template: ConditionsTemplate,
  content: ConditionsContent,
  createdAt: string,
  createdBy: string | null,
): ConditionsTemplate {
  const latest = latestVersion(template);
  if (sameContent(latest, content)) return template;
  const version: ConditionsVersion = {
    ...content,
    conditions: [...content.conditions],
    version: latest.version + 1,
    createdAt,
    createdBy,
  };
  return { ...template, versions: [...template.versions, version] };
}

/** Contenido y referencia que se copian a la cotización. */
export function conditionsFrom(template: ConditionsTemplate): ConditionsContent & {
  conditionsRef: ConditionsRef;
} {
  const latest = latestVersion(template);
  return {
    conditions: [...latest.conditions],
    paymentTerms: latest.paymentTerms,
    validity: latest.validity,
    deliveryTime: latest.deliveryTime,
    conditionsRef: { templateId: template.id, name: template.name, version: latest.version },
  };
}
