# BILL-142 plan: push channel

Files to add or change, one line each:

- `src/lib/error-codes.js` (change): register `RECIPIENT_GONE: { status: 410 }`, used when the gateway returns 404/410 (rule 2).
- `config/channels.js` (change): add a `push` entry with `retry: { attempts: 3, baseDelayMs: 200 }`.
- `src/channels/push.channel.js` (new): default export `{ name: 'push', validate, send }`.
  - `validate` throws `INVALID_RECIPIENT` unless `to` matches `/^kst_[A-Za-z0-9]{32}$/`.
  - `send` calls `deps.providers.push.send({ token, title: subject, body })` inside `withRetry()`.
  - Provider errors: 404/410 → `RECIPIENT_GONE` (not retried); other errors → `fromProviderError(err, 'push')` (5xx retryable, other 4xx permanent).
  - Logs only through `deps.logger`, recipient only via `maskRecipient()`.
- `src/channels/index.js` (change): import `push` and register it in `CHANNELS`.
- `tests/channels/push.channel.test.js` (new): uses `createTestDeps` and the fake sleep, with these cases:
  - valid token sends, with title = subject and body = body;
  - malformed tokens are rejected by `validate`;
  - `kst_flaky…` is retried once and succeeds (fake sleep records 200ms);
  - `kst_expired…` throws `RECIPIENT_GONE`, with no retry and no sleep;
  - persistent 5xx exhausts 3 attempts and throws `PROVIDER_UNAVAILABLE`;
  - the token is never logged unmasked.
- `tests/routes/notifications.routes.test.js` (change): add cases for the acceptance criteria. A `bill-ready` push dispatch with a valid token returns 202, and a malformed token returns 400 with nothing sent.

Notes:
- The ticket gives no retry numbers, so I'll use the default of `attempts: 3, baseDelayMs: 200` (rule 3).
- `README.md`, `package.json`, `.github/` and `docs/` (other than this plan) stay untouched.
- Commit: `feat(channels): add push channel [BILL-142]`.
