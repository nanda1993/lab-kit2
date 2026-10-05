# BILL-176: Rate limiting on POST /notifications/dispatch

Fixed-window counter per API key in the existing Redis client: `incr` on `ratelimit:dispatch:<apiKey>`,
`expire` when the key is new, `ttl` for `Retry-After`. Runs after `requireApiKey`, only on the dispatch route.
Redis errors fail open (logged at `warn`). The limit is a constant in `config/limits.js`, not an env var.

| # | File | Change |
|---|---|---|
| 1 | `config/limits.js` (new) | `limits.dispatch = { maxRequests: 100, windowSeconds: 60 }`, frozen |
| 2 | `config/index.js` | add `limits` to `config` |
| 3 | `src/lib/error-codes.js` | add `RATE_LIMITED: { status: 429 }` |
| 4 | `src/middleware/rate-limit.js` (new) | limiter; throws `RATE_LIMITED` with `details.retryAfterSeconds`; repairs a missing expiry; never logs the raw key |
| 5 | `src/middleware/error-handler.js` | set `Retry-After` from `err.details.retryAfterSeconds` |
| 6 | `src/routes/notifications.routes.js` | take `rateLimit` dep, use it on the dispatch route |
| 7 | `src/app.js` | build limiter from `deps.limits ?? config.limits.dispatch` |
| 8 | `tests/middleware/rate-limit.test.js` (new) | unit tests with a fake clock |
| 9 | `tests/routes/notifications.routes.test.js` | route tests with a limit of 2 |

Not touched: README, package.json, .github, migrations, .env.example.
