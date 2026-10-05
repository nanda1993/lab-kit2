import { AppError } from '../lib/app-error.js';

// Fixed-window limiter per API key, counted in Redis. Must run after requireApiKey (reads req.apiKey).
// If Redis fails the request is let through: billing notices shouldn't stop because the limiter is down.
export function rateLimit({ redis, logger, name = 'dispatch', maxRequests, windowSeconds }) {
  return async (req, res, next) => {
    const key = `ratelimit:${name}:${req.apiKey}`;
    let count;
    let ttl;
    try {
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      ttl = await redis.ttl(key);
      if (ttl === -1) { // a crash between incr and expire would otherwise block this key forever
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
