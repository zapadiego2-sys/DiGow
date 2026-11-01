import { describe, expect, it } from 'vitest';
import { RepositoryError } from '@/domain/errors';
import type { MaterialDraft } from '@/domain/material';
import type { MaterialCatalog, QuoteReader, QuoteWriter } from '@/domain/ports';
import { createEmptyQuoteDraft, type QuoteDraft } from '@/domain/quote';

const draft = (overrides: Partial<QuoteDraft> = {}): QuoteDraft => ({
  ...createEmptyQuoteDraft('2026-01-15'),
  client: 'Cliente de prueba',
  project: 'Proyecto de prueba',
  ...overrides,
});

const expectNotFound = (promise: Promise<unknown>) =>
  expect(promise).rejects.toMatchObject({ name: RepositoryError.name, code: 'not-found' });

/** Toda implementación de QuoteReader + QuoteWriter debe pasar esta suite. */
export function describeQuoteRepositoryContract(
  name: string,
  create: () => QuoteReader & QuoteWriter,
) {
  describe(`contrato de repositorio de cotizaciones: ${name}`, () => {
    it('crea y recupera', async () => {
      const repository = create();
      const created = await repository.create(draft());
      expect(created.id).toBeTruthy();
      expect(created.createdAt).toBeTruthy();
      await expect(repository.get(created.id)).resolves.toEqual(created);
    });

    it('asigna identificadores únicos', async () => {
      const repository = create();
      const [a, b] = [await repository.create(draft()), await repository.create(draft())];
      expect(a.id).not.toBe(b.id);
    });

    it('lista y filtra por búsqueda y estado', async () => {
      const repository = create();
      const created = await repository.create(draft({ client: 'Único Cliente', status: 'sent' }));
      const ids = async (filter: Parameters<QuoteReader['list']>[0]) =>
        (await repository.list(filter)).map((quote) => quote.id);
      expect(await ids({})).toContain(created.id);
      expect(await ids({ search: 'unico cliente' })).toEqual([created.id]);
      expect(await ids({ search: 'unico cliente', status: 'draft' })).toEqual([]);
      expect(await ids({ status: 'sent' })).toContain(created.id);
    });

    it('actualiza y conserva la identidad', async () => {
      const repository = create();
      const created = await repository.create(draft());
      const updated = await repository.update({ ...created, client: 'Nuevo' });
      expect(updated.id).toBe(created.id);
      await expect(repository.get(created.id)).resolves.toMatchObject({ client: 'Nuevo' });
    });

    it('duplica como borrador, con otro id y sin cambiar el original', async () => {
      const repository = create();
      const created = await repository.create(draft({ status: 'approved' }));
      const copy = await repository.duplicate(created.id);
      expect(copy.id).not.toBe(created.id);
      expect(copy.status).toBe('draft');
      await expect(repository.get(created.id)).resolves.toMatchObject({ status: 'approved' });
    });

    it('devuelve copias: mutar un resultado no altera lo guardado', async () => {
      const repository = create();
      const created = await repository.create(draft());
      const read = await repository.get(created.id);
      read.client = 'Mutado';
      await expect(repository.get(created.id)).resolves.toMatchObject({
        client: 'Cliente de prueba',
      });
    });

    it('falla con not-found ante un id desconocido', async () => {
      const repository = create();
      const created = await repository.create(draft());
      await expectNotFound(repository.get('no-existe'));
      await expectNotFound(repository.duplicate('no-existe'));
      await expectNotFound(repository.update({ ...created, id: 'no-existe' }));
    });
  });
}

const material: MaterialDraft = {
  name: 'Material de prueba',
  supplier: '',
  pricing: { mode: 'factor', purchasePrice: 100, factor: 0.5, sheetAreaCm2: null },
};

/** Toda implementación de MaterialCatalog debe pasar esta suite. */
export function describeMaterialCatalogContract(name: string, create: () => MaterialCatalog) {
  describe(`contrato de catálogo de materiales: ${name}`, () => {
    it('crea y lista', async () => {
      const catalog = create();
      const created = await catalog.create(material);
      expect(created.id).toBeTruthy();
      expect(await catalog.list()).toContainEqual(created);
    });

    it('actualiza', async () => {
      const catalog = create();
      const created = await catalog.create(material);
      const updated = { ...created, name: 'Otro nombre' };
      await catalog.update(updated);
      expect(await catalog.list()).toContainEqual(updated);
    });

    it('falla con not-found al actualizar un id desconocido', async () => {
      const catalog = create();
      await expectNotFound(catalog.update({ ...material, id: 'no-existe' }));
    });
  });
}
