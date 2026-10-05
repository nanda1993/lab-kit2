import { ERROR_CODES } from './error-codes.js';

// The one error type the service throws. The HTTP status comes from the code, so
// callers never pick a status by hand. `retryable` tells withRetry() whether a
// second attempt could succeed.
export class AppError extends Error {
  constructor(code, message, { retryable = false, cause, details } = {}) {
    super(message, cause ? { cause } : undefined);
    if (!ERROR_CODES[code]) throw new TypeError(`Unknown error code "${code}". Add it to src/lib/error-codes.js`);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_CODES[code].status;
    this.retryable = retryable;
    if (details) this.details = details;
  }

  toResponse() {
    return { error: { code: this.code, message: this.message } };
  }
}

export const isAppError = err => err instanceof AppError;
