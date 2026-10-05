# BILL-142: Add a push notification channel

`push` channel: `to` is a device token (`kst_` + 32 letters/digits), sent via `providers.push.send({ token, title, body })`
with title = template subject and body = template body. 5xx are retried through `withRetry()`; a 410 is not retried.

| # | File | Change |
|---|---|---|
| 1 | `src/lib/error-codes.js` | add `RECIPIENT_GONE: { status: 410 }` (rule 2: provider 404/410 means the recipient no longer exists) |
| 2 | `config/channels.js` | add `push: { retry: { attempts: 3, baseDelayMs: 200 } }` (ticket gives no retry numbers, so the CLAUDE.md default) |
| 3 | `src/channels/push.channel.js` (new) | default export `{ name: 'push', validate, send }`. `validate` throws `AppError('INVALID_RECIPIENT')` unless `to` matches `/^kst_[A-Za-z0-9]{32}$/`. `send` wraps the provider call in `withRetry()`; errors go through `fromProviderError(err, 'push')`, except 404/410 which throw `RECIPIENT_GONE`. Logs via `deps.logger` with `maskRecipient(to)` |
| 4 | `src/channels/index.js` | import and register `push` |
| 5 | `tests/channels/push.channel.test.js` (new) | validate accepts a valid token and rejects malformed ones; send delivers (`pu_` ref); `kst_flaky…` succeeds on attempt 2 with one fake sleep of 200; `kst_expired…` throws `RECIPIENT_GONE` and is not retried; token never appears unmasked in logs |
| 6 | `tests/routes/notifications.routes.test.js` | `bill-ready` over `push` with a valid token returns 202; malformed token returns 400 `INVALID_RECIPIENT` and nothing is sent |

Not touched: `src/providers/*` (sandbox stand-ins), `email`/`inapp` channels (legacy, not a model), README, package.json, .github, migrations.
Follow-ups (not in scope): document `push` in the README.
