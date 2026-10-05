# BILL-176: Rate limiting on POST /notifications/dispatch

## Context
Other services call `POST /notifications/dispatch` with an `x-api-key`. We cap each key at 100 requests/minute. Over the cap the response is 429 with a `Retry-After` header. Counters live in the existing Redis client (`src/lib/redis.js`). The limit is a config value in `config/limits.js`.

## Approach
Fixed-window counter per API key: `INCR ratelimit:dispatch:<apiKey>`, `EXPIRE` when the key is new, `TTL` gives Retry-After. The Redis stand-in already supports incr/expire/ttl.
Middleware runs after `requireApiKey` (uses `req.apiKey`) and is attached only to the dispatch route. Invalid keys never touch the limiter, and `GET /notifications/:id` is not limited.

## Files
| # | File | Change |
|---|---|---|
| 1 | `config/limits.js` (new) | `export const limits = Object.freeze({ dispatch: Object.freeze({ maxRequests: 100, windowSeconds: 60 }) })`, same shape as `config/channels.js` |
| 2 | `config/index.js` | import `limits`, add to frozen `config` |
| 3 | `src/lib/error-codes.js` | add `RATE_LIMITED: { status: 429 }` (rule 1: register first) |
| 4 | `src/middleware/rate-limit.js` (new) | `rateLimit({ redis, logger, name, maxRequests, windowSeconds })` returns `(req,res,next)`. Counts via incr, sets expire on first hit (and if ttl is -1, so a crash between incr and expire can't leave a key that never expires). Over limit: `throw new AppError('RATE_LIMITED', msg, { details: { retryAfterSeconds } })`. Logs via injected `logger.warn`, with no raw API key |
| 5 | `src/middleware/error-handler.js` | in the `isAppError` branch, if `err.details?.retryAfterSeconds` set `Retry-After` (uses `res.set`). Body stays `{error:{code,message}}` |
| 6 | `src/routes/notifications.routes.js` | accept `rateLimit` in deps; `app.post('/notifications/dispatch', rateLimit, handler)` |
| 7 | `src/app.js` | build limiter from `deps.limits ?? config.limits.dispatch` and `redis`/`logger`, pass to `registerNotificationRoutes` (lets tests inject a small limit, as with `apiKeys`) |
| 8 | `tests/middleware/rate-limit.test.js` (new) | fake clock via `createRedisClient({ now })`. Covers: allows up to max, blocks max+1 with `RATE_LIMITED` and correct `retryAfterSeconds`, window reset after expiry, separate keys have separate counters |
| 9 | `tests/routes/notifications.routes.test.js` | add: separate app with `limits: { maxRequests: 2, windowSeconds: 60 }`; 3rd call returns 429, `Retry-After` header present, body code `RATE_LIMITED`; GET not limited; 401 not counted |

Only `config/` is touched for config. No `process.env` is read elsewhere. No edits to README, package.json, .github, docs, migrations.

## Decisions to confirm
1. **Redis failure:** fail open (log `warn`, let the request through) vs fail closed. Recommend fail open, since billing notifications shouldn't stop because the limiter is down.
2. **Fixed window:** a caller can burst up to 200 across a window boundary. Acceptable for this requirement; sliding window would need more Redis ops than the stand-in supports.
3. **Env override:** limit is a constant (like `dedupeTtlSeconds`), not an env var. Say if you want `RATE_LIMIT_DISPATCH_MAX` (that would also touch `.env.example`).
4. **Ticket number** for commit `feat(middleware): rate limit dispatch [BILL-???]` and `docs/plans/<ticket>.md`.

## Verification
`npm test` after each step; `npm test -- tests/middleware`. Optional manual check: `npm start`, then 101 POSTs with `x-api-key: dev-key-billing`; the 101st returns 429 with `Retry-After`.

## Suggested follow-ups (not in scope)
Document the limit in README; `X-RateLimit-*` headers.
