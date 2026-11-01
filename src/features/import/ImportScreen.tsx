import { useMutation } from '@tanstack/react-query';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Notice } from '@/shared/ui/Notice';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import { QuoteForm } from '../quotes/QuoteForm';
import { useCreateQuote } from '../quotes/useQuotes';
import { errorMessage } from '../services/errorMessages';
import { useServices } from '../services/ServicesContext';

export function ImportScreen() {
  const { quoteImporter } = useServices();
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateQuote();
  const navigate = useNavigate();
  const toast = useToast();
  const importFile = useMutation({
    mutationFn: async (file: File) => ({
      fileName: file.name,
      result: await quoteImporter.import(file),
    }),
  });

  const preview = importFile.data;

  return (
    <div className="flex flex-col gap-lg">
      <title>Importar Excel · Cotizador</title>
      <header className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="text-display">{preview ? 'Revisar importación' : 'Importar Excel'}</h1>
        {preview ? (
          <Button onClick={() => inputRef.current?.click()}>
            <Icon name="upload" />
            Elegir otro archivo
          </Button>
        ) : null}
      </header>

      <label htmlFor="import-file" className="sr-only">
        Archivo de cotización en formato .xlsx
      </label>
      <input
        ref={inputRef}
        id="import-file"
        type="file"
        accept=".xlsx"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) importFile.mutate(file);
        }}
      />

      {preview ? null : (
        <Card className="flex flex-col items-start gap-md" aria-label="Elegir archivo">
          <p className="text-body-sm text-text-muted">
            Elige un archivo .xlsx de hasta 10 MB con la estructura de la cotización. Se lee en este
            dispositivo y funciona sin conexión. Nada se guarda hasta que revises la vista previa.
          </p>
          <Button
            variant="primary"
            disabled={importFile.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" />
            {importFile.isPending ? 'Leyendo el archivo…' : 'Elegir archivo'}
          </Button>
        </Card>
      )}

      {importFile.isError ? (
        <Notice tone="danger" title="No se pudo importar el archivo">
          <p>{errorMessage(importFile.error)}</p>
        </Notice>
      ) : null}

      {importFile.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-sm">
          <Skeleton className="h-2xl w-full" />
          <Skeleton className="h-photo w-full" />
        </div>
      ) : null}

      {preview && !importFile.isPending ? (
        <>
          {preview.result.warnings.length > 0 ? (
            <Notice
              tone="warning"
              title={
                preview.result.warnings.length === 1
                  ? '1 aviso para revisar'
                  : `${preview.result.warnings.length} avisos para revisar`
              }
            >
              <ul className="flex list-disc flex-col gap-xs pl-md">
                {preview.result.warnings.map((warning) => (
                  <li key={warning.message}>{warning.message}</li>
                ))}
              </ul>
            </Notice>
          ) : (
            <Notice tone="success" title="Archivo leído sin avisos">
              <p>Revisa los datos de {preview.fileName} y guárdalos como borrador.</p>
            </Notice>
          )}
          <QuoteForm
            key={importFile.submittedAt}
            initial={preview.result.draft}
            submitLabel="Guardar como borrador"
            isImportPreview
            onSubmit={async (draft) => {
              const quote = await create.mutateAsync({ ...draft, status: 'draft' });
              toast({ tone: 'success', text: 'Borrador creado desde el archivo.' });
              await navigate(`/cotizaciones/${quote.id}`, { replace: true });
            }}
          />
        </>
      ) : null}
    </div>
  );
}
