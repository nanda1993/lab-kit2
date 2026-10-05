import { isAppError } from '../lib/app-error.js';

// The single place that turns errors into HTTP responses. Response shape is always
//   { "error": { "code": "UPPER_SNAKE", "message": "..." } }
// Routes never build error JSON themselves; they throw and end up here.
export function errorHandler({ logger }) {
  return (err, req, res, next) => {
    if (isAppError(err)) {
      if (err.status >= 500) logger.error('request failed', { path: req.path, code: err.code });
      if (err.details?.retryAfterSeconds) res.set('Retry-After', err.details.retryAfterSeconds);
      return res.status(err.status).json(err.toResponse());
    }
    if (err.statusCode) {
      if (err.statusCode >= 500) logger.error('request failed', { path: req.path, code: err.code });
      return res.status(err.statusCode).json({ error: { code: err.code ?? 'BAD_REQUEST', message: err.message } });
    }
    logger.error('unhandled error', { path: req.path, message: err.message });
    return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  };
}
