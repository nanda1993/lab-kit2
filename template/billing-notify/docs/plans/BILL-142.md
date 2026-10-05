# BILL-142: Add a push notification channel

`push` channel: `to` is a device token (`kst_` + 32 letters/digits). Sends through `providers.push.send({ token, title, body })`,
title = template subject, body = template body. 5xx are retried via `withRetry()`; a provider 404/410 is not retried.

| # | File | Change |
|---|---|---|
| 1 | `src/lib/error-codes.js` | add `RECIPIENT_GONE: { status: 410 }` (rule 2: provider 404/410 means the recipient no longer exists) |
| 2 | `config/channels.js` | add `push.retry = { attempts: 3, baseDelayMs: 200 }`. The ticket gives no retry numbers, so these are the CLAUDE.md defaults (rule 3) |
| 3 | `src/channels/push.channel.js` (new) | default export `{ name, validate, send }`. `validate` throws `AppError('INVALID_RECIPIENT')` unless `to` matches `/^kst_[A-Za-z0-9]{32}$/`. `send` calls the provider inside `withRetry()`, converts errors with `fromProviderError(err, 'push')` except 404/410 which throw `RECIPIENT_GONE`. Logs via `deps.logger` with `maskRecipient(to)` |
| 4 | `src/channels/index.js` | register `push` |
| 5 | `tests/channels/push.channel.test.js` (new) | valid and malformed tokens; delivery; flaky token retried once (fake sleep 200); expired token gives `RECIPIENT_GONE`, not retried; exhausted 5xx; 4xx not retried; no raw token in logs |
| 6 | `tests/routes/notifications.routes.test.js` | valid push returns 202; malformed token returns 400 `INVALID_RECIPIENT`; expired token returns 410 `RECIPIENT_GONE` |

Not touched: `src/providers/*` (sandbox stand-ins), `email`/`inapp` channels (legacy, don't copy), README, package.json, .github, migrations.
Suggested follow-up, not in scope: document `push` in the README.
