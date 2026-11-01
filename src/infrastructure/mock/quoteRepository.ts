import { RepositoryError } from '@/domain/errors';
import type { QuoteReader, QuoteWriter } from '@/domain/ports';
import {
  matchesQuoteFilter,
  toDuplicateDraft,
  type Quote,
  type QuoteDraft,
  type QuoteFilter,
} from '@/domain/quote';
import { createId } from '@/shared/lib/id';
import { simulate, type MockBehavior } from './behavior';
import type { VersionedCollection } from './storage';

export class MockQuoteRepository implements QuoteReader, QuoteWriter {
  private readonly quotes: VersionedCollection<Quote>;
  private readonly behavior: MockBehavior;

  constructor(quotes: VersionedCollection<Quote>, behavior: MockBehavior) {
    this.quotes = quotes;
    this.behavior = behavior;
  }

  list(filter: QuoteFilter = {}): Promise<Quote[]> {
    return simulate(this.behavior, () =>
      this.quotes
        .read()
        .filter((quote) => matchesQuoteFilter(quote, filter))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  }

  get(id: string): Promise<Quote> {
    return simulate(this.behavior, () => this.find(id));
  }

  create(draft: QuoteDraft): Promise<Quote> {
    return simulate(this.behavior, () => this.insert(draft));
  }

  update(quote: Quote): Promise<Quote> {
    return simulate(this.behavior, () => {
      this.find(quote.id);
      const updated = { ...quote, updatedAt: new Date().toISOString() };
      this.quotes.write(this.quotes.read().map((q) => (q.id === quote.id ? updated : q)));
      return updated;
    });
  }

  duplicate(id: string): Promise<Quote> {
    return simulate(this.behavior, () => this.insert(toDuplicateDraft(this.find(id))));
  }

  private find(id: string): Quote {
    const quote = this.quotes.read().find((q) => q.id === id);
    if (!quote) throw new RepositoryError('not-found');
    return quote;
  }

  private insert(draft: QuoteDraft): Quote {
    const now = new Date().toISOString();
    const quote: Quote = { ...draft, id: createId(), createdAt: now, updatedAt: now };
    this.quotes.write([quote, ...this.quotes.read()]);
    return quote;
  }
}
