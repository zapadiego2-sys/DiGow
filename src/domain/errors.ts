export type RepositoryErrorCode =
  'not-found' | 'storage-full' | 'storage-corrupted' | 'unavailable';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode) {
    super(code);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export type ImportErrorCode = 'invalid-type' | 'too-large' | 'damaged' | 'unrecognized-structure';

export class QuoteImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(code);
    this.name = 'QuoteImportError';
    this.code = code;
  }
}
