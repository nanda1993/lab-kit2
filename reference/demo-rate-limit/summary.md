# Slide 32 demo — reference run

## 1 · Plan (Claude Code in plan mode)

I've written the plan and changed nothing in the repo. I saved it at `~/.claude/plans/using-the-conventions-in-federated-harp.md` because plan mode only lets me write there. CLAUDE.md wants it at `docs/plans/<ticket>.md`, so I'll copy it there once you give me a ticket number.

## Approach
Each API key gets a fixed-window counter in Redis. A request does `incr` on `ratelimit:dispatch:<apiKey>`, then `expire` when the key is new. `ttl` gives the `Retry-After` value. The existing Redis client already has `incr`, `expire` and `ttl`.

The limiter runs after `requireApiKey` and is attached only to the dispatch route. Requests with a bad key never reach it, and `GET /notifications/:id` is not limited.

## File-by-file plan
| # | File | Change |
|---|---|---|
| 1 | `config/limits.js` (new) | `limits.dispatch = { maxRequests: 100, windowSeconds: 60 }`, frozen, same shape as `config/channels.js` |
| 2 | `config/index.js` | Import `limits` and add it to `config` |
| 3 | `src/lib/error-codes.js` | Add `RATE_LIMITED: { status: 429 }` |
| 4 | `src/middleware/rate-limit.js` (new) | Counts requests. Over the limit it throws `AppError('RATE_LIMITED', …, { details: { retryAfterSeconds } })`. It logs through `deps.logger` and never logs the raw API key. If `ttl` is -1 after `incr`, it sets the expiry. That stops a crash between `incr` and `expire` from blocking a key forever. |
| 5 | `src/middleware/error-handler.js` | If `err.details.retryAfterSeconds` is set, set the `Retry-After` header. The body shape stays the same. |
| 6 | `src/routes/notifications.routes.js` | Take `rateLimit` as a dependency and use it on `POST /notifications/dispatch` |
| 7 | `src/app.js` | Build the limiter from `deps.limits ?? config.limits.dispatch`, `redis` and `logger`. Tests can then inject a small limit. |
| 8 | `tests/middleware/rate-limit.test.js` (new) | Uses a fake clock. Covers: requests up to the max pass, max+1 is blocked with the right retry value, the window resets, and different keys have separate counts. |
| 9 | `tests/routes/notifications.routes.test.js` | Uses a second app with a limit of 2. The 3rd call gets a 429 with `Retry-After`. GET is not limited and 401s are not counted. |

Only `config/` is touched for config. I won't touch the README, `package.json`, `.github/`, `docs/` or migrations.

## Questions for you
1. **If Redis fails, should requests pass or be rejected?** I recommend letting them pass and logging a warning, so billing notifications don't stop when the limiter is down.
2. **Is a fixed window acceptable?** A caller can burst up to 200 requests across a window boundary. A sliding window would need Redis operations the stand-in doesn't have.
3. **Should the limit be an env var?** I plan a plain constant, like `dedupeTtlSeconds`. An env var would also mean editing `.env.example`.
4. **What is the ticket number?** I need it for the commit message (`feat(middleware): … [BILL-???]`) and for `docs/plans/<ticket>.md`. None of the existing tickets in `docs/tickets/` looks like this one.

I'll run `npm test` after each step. For follow-ups, I'd document the limit in the README and consider `X-RateLimit-*` headers, but neither is in scope.

Reply with a go-ahead, plus any answers to the questions above. If you don't answer, I'll use my recommendations.

## 2 · After the go-ahead

Rate limiting on `POST /notifications/dispatch` is in place, and `npm test` passes (28 tests, up from 21). I haven't committed anything. The work is on the `demo/rate-limit` branch.

I used your answers: fail open if Redis errors (with a `warn` log), a fixed window, and the limit as a constant rather than an env var.

- **Limit:** 100 requests per minute per API key, set in the new `config/limits.js` and added to `config/index.js`.
- **Over the limit:** the response is 429 with a `Retry-After` header and the usual `{ error: { code: 'RATE_LIMITED', … } }` body. I registered `RATE_LIMITED` in `src/lib/error-codes.js`.
- **Limiter:** the new `src/middleware/rate-limit.js` keeps the counters in the existing Redis client, one per API key.
- **Where it applies:** only the dispatch route. Requests with a bad API key are rejected before they reach the limiter, and `GET /notifications/:id` is not limited.
- **Crash safety:** if a counter ever has no expiry, for example after a crash between `incr` and `expire`, the limiter sets one. That stops a key from being blocked forever.
- **Other edits:** the error handler now sets `Retry-After`, and the route and `src/app.js` wire the limiter in. `buildApp` accepts a `limits` override so tests can use a small limit.
- **Tests:** `tests/middleware/rate-limit.test.js` covers the limit boundary, the retry value, window reset, separate keys, the expiry repair and the Redis-failure case. One route test in `tests/routes/notifications.routes.test.js` checks the 429, the header, that 401s aren't counted and that GET isn't limited.
- **Plan copy:** I saved the plan as `docs/plans/BILL-176.md`, as CLAUDE.md asks.

When you commit, the message should be `feat(middleware): rate limit dispatch per API key [BILL-176]`.

I'd suggest these as follow-ups, but they're outside this ticket:
- Document the limit in the README.
- Add `X-RateLimit-*` headers.
- Add an env override for the limit.
