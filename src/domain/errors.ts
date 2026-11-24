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

export type ImportErrorCode =
  'invalid-type' | 'too-large' | 'damaged' | 'unrecognized-structure' | 'no-material-headers';

export class FileImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode) {
    super(code);
    this.name = 'FileImportError';
    this.code = code;
  }
}

export type RuleErrorCode =
  | 'invalid-credentials'
  | 'inactive-user'
  | 'email-taken'
  | 'last-admin'
  | 'system-role'
  | 'role-in-use'
  | 'workflow-empty'
  | 'workflow-finished'
  | 'first-step'
  | 'comment-required'
  | 'not-assignee'
  | 'default-required'
  | 'gate-incomplete'
  | 'invalid-formula';

/** Una regla del negocio impidió la operación. */
export class RuleError extends Error {
  readonly code: RuleErrorCode;
  /** Qué falta, por ejemplo los datos que impiden aprobar un paso. */
  readonly details: string[];

  constructor(code: RuleErrorCode, details: string[] = []) {
    super(code);
    this.name = 'RuleError';
    this.code = code;
    this.details = details;
  }
}
