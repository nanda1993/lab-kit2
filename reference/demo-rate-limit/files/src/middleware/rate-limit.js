import { AppError } from '../lib/app-error.js';

// Fixed-window limiter per API key, backed by Redis INCR/EXPIRE. Must run after
// requireApiKey (it reads req.apiKey). Over the limit it throws RATE_LIMITED with
// details.retryAfterSeconds, which the error handler turns into a Retry-After header.
// If Redis fails the request is let through: billing notifications shouldn't stop
// because the limiter is down.
export function rateLimit({ redis, logger, name, maxRequests, windowSeconds }) {
  return async (req, res, next) => {
    const key = `ratelimit:${name}:${req.apiKey}`;
    let count;
    let ttl;
    try {
      count = await redis.incr(key);
      ttl = count === 1 ? -1 : await redis.ttl(key);
      // ttl -1 means no expiry: a new window, or a key left behind by a crash between incr and expire.
      if (ttl === -1) {
        await redis.expire(key, windowSeconds);
        ttl = windowSeconds;
      }
    } catch (err) {
      logger.warn('rate limiter unavailable, allowing request', { limiter: name, message: err.message });
      return next();
    }

    if (count > maxRequests) {
      const retryAfterSeconds = Math.max(1, ttl);
      logger.warn('rate limit exceeded', { limiter: name, path: req.path, retryAfterSeconds });
      throw new AppError('RATE_LIMITED', `Rate limit of ${maxRequests} requests per ${windowSeconds}s exceeded`, {
        details: { retryAfterSeconds },
      });
    }
    return next();
  };
}
