import { isAppError } from './app-error.js';

const realSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Retries `fn` with exponential backoff, but only for errors marked retryable.
// A permanent failure (bad recipient, rejected content) is thrown straight away.
//   withRetry(() => provider.send(msg), config.channels.email.retry, { logger })
export async function withRetry(fn, { attempts, baseDelayMs }, { logger, sleep = realSleep, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const retryable = isAppError(err) && err.retryable;
      if (!retryable || attempt === attempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      logger?.warn('retrying', { label, attempt, delayMs: delay, code: err.code });
      await sleep(delay);
    }
  }
  throw lastError;
}
