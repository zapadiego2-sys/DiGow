import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { lineCost, linesCost, type CostLine } from '@/domain/cost';
import type { CostSuggestion, SimilarItem, SuggestedSubItem } from '@/domain/ports';
import type { QuoteItem } from '@/domain/quote';
import type { LengthUnit } from '@/domain/units';
import { formatMoney, formatNumber, formatPercent } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useMaterials } from '../materials/useMaterials';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';

interface CostSuggestionsProps {
  itemPath: string;
  existingLines: readonly CostLine[];
  onAccept: (lines: CostLine[]) => void;
  onAcceptSubItem: (subItem: SuggestedSubItem) => void;
}

/** Una línea ya está en la hoja si comparte material o, sin material, el mismo nombre. */
function isAlreadyUsed(suggestion: CostSuggestion, existing: readonly CostLine[]): boolean {
  const { materialId, label } = suggestion.line;
  return existing.some((line) =>
    materialId ? line.materialId === materialId : !line.materialId && line.label === label,
  );
}

function SimilarItems({ items }: { items: readonly SimilarItem[] }) {
  return (
    <section aria-label="Ítems parecidos" className="flex flex-col gap-sm">
      <h4 className="text-label">Ítems parecidos en cotizaciones anteriores</h4>
      <ul className="flex flex-col gap-sm">
        {items.map((item) => (
          <li
            key={`${item.quoteId}-${item.itemId}`}
            className="flex flex-col gap-xs rounded-md border border-internal p-sm text-body-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-sm">
              <span className="text-label">{item.product}</span>
              <span className="text-caption">Similitud {formatPercent(item.similarity)}</span>
            </div>
            <span>
              {item.project || 'Sin proyecto'} · {item.client} ·{' '}
              {[item.width, item.height, item.depth].map(formatNumber).join(' × ')}
            </span>
            <span className="tabular">
              Costo entonces {formatMoney(item.unitCost)} · con precios de hoy{' '}
              {formatMoney(item.currentUnitCost)} · precio de venta {formatMoney(item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Propone líneas desde el historial y el catálogo. Solo las aceptadas llegan a la hoja de costos. */
export function CostSuggestions({
  itemPath,
  existingLines,
  onAccept,
  onAcceptSubItem,
}: CostSuggestionsProps) {
  const { costSuggester } = useServices();
  const materials = useMaterials();
  const item = useWatch({ name: itemPath }) as QuoteItem;
  const quoteId = (useWatch({ name: 'id' }) ?? null) as string | null;
  const measureUnit = (useWatch({ name: 'measureUnit' }) ?? 'cm') as LengthUnit;
  const [subItems, setSubItems] = useState<SuggestedSubItem[]>([]);
  const [pending, setPending] = useState<CostSuggestion[] | null>(null);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const description = item.description ?? '';

  const suggest = useMutation({
    mutationFn: async () => {
      const found = await costSuggester.suggest(
        {
          quoteId,
          itemId: item.id,
          catalogItemId: item.catalogItemId,
          product: item.product,
          description,
          width: item.width,
          height: item.height,
          depth: item.depth,
          measureUnit,
          predictive: item.predictive,
          existingSubItems: item.subItems.map((sub) => ({
            name: sub.name,
            catalogSubItemId: sub.catalogSubItemId,
          })),
        },
        materials.data ?? [],
      );
      return {
        ...found,
        suggestions: found.suggestions.filter((s) => !isAlreadyUsed(s, existingLines)),
      };
    },
    onSuccess: (found) => {
      setPending(found.suggestions);
      setSimilar(found.similar);
      setSubItems(found.subItems);
    },
  });

  const remove = (suggestion: CostSuggestion) =>
    setPending((current) => current?.filter((s) => s !== suggestion) ?? null);

  return (
    <div className="flex flex-col gap-sm">
      <div>
        <Button
          disabled={!description.trim() || materials.isPending || suggest.isPending}
          onClick={() => suggest.mutate()}
        >
          <Icon name="sparkle" />
          Sugerir costos desde la descripción
        </Button>
      </div>
      {suggest.isError ? <p role="alert">{errorMessage(suggest.error)}</p> : null}
      {item.predictive ? null : (
        <p className="text-body-sm">
          Este ítem no aplica para el modelo predictivo: solo se sugieren materiales del catálogo.
        </p>
      )}
      {similar.length > 0 ? <SimilarItems items={similar} /> : null}
      {subItems.length > 0 ? (
        <section
          aria-label="Sub-ítems sugeridos"
          className="flex flex-col gap-sm rounded-md border-2 border-internal p-sm"
        >
          <h4 className="text-label">Este ítem puede tener costos en sub-ítems</h4>
          <ul className="flex flex-col gap-sm">
            {subItems.map((sub) => (
              <li key={`${sub.catalogSubItemId}-${sub.name}`} className="flex flex-col gap-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-sm">
                  <span className="text-label">
                    {sub.name} × {formatNumber(sub.quantity)}
                  </span>
                  <span className="tabular text-money">
                    {sub.lines.length > 0 ? formatMoney(linesCost(sub.lines)) : 'Sin costos'}
                  </span>
                </div>
                <p className="text-caption">{sub.reason}</p>
                <div>
                  <Button
                    aria-label={`Agregar sub-ítem ${sub.name}`}
                    onClick={() => {
                      onAcceptSubItem(sub);
                      setSubItems((current) => current.filter((s) => s !== sub));
                    }}
                  >
                    <Icon name="plus" />
                    {sub.lines.length > 0 ? 'Agregar con sus costos' : 'Agregar sub-ítem'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pending?.length === 0 ? (
        <p role="status" className="text-body-sm">
          No hay líneas nuevas para sugerir desde el historial ni el catálogo. Puedes agregarlas a
          mano.
        </p>
      ) : null}
      {pending && pending.length > 0 ? (
        <section aria-label="Sugerencias de costos" className="flex flex-col gap-sm">
          <p className="text-body-sm">
            Revisa cada sugerencia. Solo las que aceptes se agregan a la hoja de costos.
          </p>
          <ul className="flex flex-col gap-sm">
            {pending.map((suggestion) => (
              <li
                key={suggestion.line.id}
                className="flex flex-col gap-sm rounded-md border border-internal p-sm"
              >
                <div className="flex items-baseline justify-between gap-md">
                  <span className="min-w-0 text-label">{suggestion.line.label}</span>
                  <span className="tabular text-money">
                    {formatMoney(lineCost(suggestion.line))}
                  </span>
                </div>
                <div>
                  {suggestion.source.kind === 'history' ? (
                    <Badge tone="info">Del historial: {suggestion.source.project}</Badge>
                  ) : (
                    <Badge tone="neutral">Del catálogo</Badge>
                  )}
                </div>
                {suggestion.missing ? (
                  <p className="text-caption">Falta un dato: {suggestion.missing}</p>
                ) : null}
                <div className="flex flex-wrap gap-sm">
                  <Button
                    aria-label={`Aceptar ${suggestion.line.label}`}
                    onClick={() => {
                      onAccept([suggestion.line]);
                      remove(suggestion);
                    }}
                  >
                    <Icon name="check" />
                    Aceptar
                  </Button>
                  <Button
                    aria-label={`Quitar sugerencia ${suggestion.line.label}`}
                    onClick={() => remove(suggestion)}
                  >
                    <Icon name="close" />
                    Quitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {pending.length > 1 ? (
            <div>
              <Button
                onClick={() => {
                  onAccept(pending.map((suggestion) => suggestion.line));
                  setPending(null);
                }}
              >
                Aceptar todas ({pending.length})
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
