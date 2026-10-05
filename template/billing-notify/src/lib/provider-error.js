import { AppError } from './app-error.js';

// Provider SDKs throw plain errors with a statusCode. Convert them at the channel
// boundary so the rest of the service only ever sees AppError:
//   5xx or no status → PROVIDER_UNAVAILABLE, retryable
//   4xx              → PROVIDER_REJECTED, permanent
export function fromProviderError(err, channel) {
  const status = err?.statusCode;
  if (status && status >= 400 && status < 500) {
    return new AppError('PROVIDER_REJECTED', `${channel} provider rejected the message: ${err.message}`, { cause: err });
  }
  return new AppError('PROVIDER_UNAVAILABLE', `${channel} provider unavailable: ${err?.message ?? 'unknown error'}`, { retryable: true, cause: err });
}
