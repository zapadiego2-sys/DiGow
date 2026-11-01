import { useMutation } from '@tanstack/react-query';
import { useWatch } from 'react-hook-form';
import { useState } from 'react';
import { lineCost, type CostLine } from '@/domain/cost';
import type { CostSuggestion } from '@/domain/ports';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useMaterials } from '../materials/useMaterials';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';

interface CostSuggestionsProps {
  itemPath: string;
  existingLines: readonly CostLine[];
  onAccept: (lines: CostLine[]) => void;
}

/** Propone líneas a partir de la descripción. Solo las aceptadas llegan a la hoja de costos. */
export function CostSuggestions({ itemPath, existingLines, onAccept }: CostSuggestionsProps) {
  const { costSuggester } = useServices();
  const materials = useMaterials();
  const description = (useWatch({ name: `${itemPath}.description` }) ?? '') as string;
  const [pending, setPending] = useState<CostSuggestion[] | null>(null);

  const suggest = useMutation({
    mutationFn: async () => {
      const used = new Set(existingLines.map((line) => line.materialId));
      const suggestions = await costSuggester.suggest(description, materials.data ?? []);
      return suggestions.filter((suggestion) => !used.has(suggestion.line.materialId));
    },
    onSuccess: setPending,
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
          Sugerir costos desde la descripción
        </Button>
      </div>
      {suggest.isError ? <p role="alert">{errorMessage(suggest.error)}</p> : null}
      {pending?.length === 0 ? (
        <p role="status" className="text-body-sm">
          No hay materiales nuevos del catálogo para sugerir. Puedes agregar las líneas a mano.
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
