# CLAUDE.md

billing-notify: Kestrel Mobile's billing notification service (Node >=20, ESM, no runtime dependencies). See `README.md`.

## 1. Error handling

**Throw `AppError` with a registered code. Never build error JSON or pick an HTTP status by hand.**

- `AppError(code, message, { retryable, cause, details })` is the one error type the service throws (`src/lib/app-error.js`). The HTTP status comes from the code.
- Codes are UPPER_SNAKE and live in `src/lib/error-codes.js`. Add the code there first. An unregistered code throws a `TypeError` (asserted in `tests/lib/app-error.test.js`).
- Routes and services throw and do not catch. `src/middleware/error-handler.js` is the only place errors become responses. The shape is `{ "error": { "code", "message" } }`. See `src/routes/notifications.routes.js`: `throw new AppError('NOT_FOUND', ...)`, with no `res.status(404).json(...)`.
- Convert provider SDK errors at the channel boundary with `fromProviderError(err, channel)` (`src/lib/provider-error.js`). 5xx or no status becomes `PROVIDER_UNAVAILABLE` (`retryable: true`). 4xx becomes `PROVIDER_REJECTED` (permanent). Always pass `cause`.
- Retries: wrap provider calls in `withRetry(fn, config.channels.<name>.retry, { logger, sleep })` (`src/lib/retry.js`). It retries only errors with `retryable: true`. Take attempts and backoff from `config/`, not literals.
- Logging: use the injected `logger` (`src/lib/logger.js`: "Inject it (deps.logger); don't import console"). Recipients are PII, so log them only through `maskRecipient()` (`src/lib/mask.js`). `src/services/dispatch.service.js` does `to: maskRecipient(to)`.

**Legacy code does not follow this.** `src/channels/email.channel.js` throws `Object.assign(new Error(...), { statusCode, code })` and has a hand-rolled retry loop. `src/channels/inapp.channel.js` throws a plain `Error` (which becomes a 500) and calls `console.log` with the full ID. `error-handler.js` keeps a `statusCode` fallback branch only for these. Don't copy these patterns. `docs/tickets/BILL-171.md` tracks migrating in-app. Commit `425d432` says the AppError/withRetry/maskRecipient helpers are "for new code". If you touch a legacy channel, say so before converting it, because email tests assert `{ statusCode: 502 }` (`tests/channels/email.channel.test.js`).

## 2. File and module naming

All files are lowercase kebab-case ESM `.js`. The suffix says the role.

| Directory | Pattern | Examples |
|---|---|---|
| `src/channels/` | `<name>.channel.js`, default export `{ name, validate, send }`, registered in `src/channels/index.js` | `email.channel.js`, `inapp.channel.js` |
| `src/routes/` | `<resource>.routes.js`, exports `register…Routes(app, deps)` | `notifications.routes.js` |
| `src/services/` | `<name>.service.js`, exports a `create…Service(deps)` factory | `dispatch.service.js` (`templates.js` is the one exception) |
| `src/providers/` | `<channel>-provider.js`, exports `create…Provider()` | `email-provider.js`, `sms-provider.js` |
| `src/lib/`, `src/middleware/` | plain kebab-case noun | `app-error.js`, `error-codes.js`, `api-key.js` |

- Dependencies (providers, logger, redis, store, sleep) are injected through factory arguments or `deps`. Don't import singletons.
- Tests mirror the source path: `src/lib/retry.js` is tested by `tests/lib/retry.test.js`, and `src/channels/email.channel.js` by `tests/channels/email.channel.test.js`. Test doubles live in `tests/helpers/fakes.js`.
- SQL migrations are `NNN_snake_case.sql` (`migrations/002_add_account_id.sql`).

## 3. Running tests

```bash
npm test                      # whole suite
npm test -- tests/channels    # one folder or file
npm test -- --coverage        # with coverage report
```

- `npm test` runs `scripts/test.js`, which uses Node's built-in runner (`node:test` + `node:assert/strict`). There is no Jest or Mocha.
- Don't run `node --test <folder>` directly. The script expands folders into files because folder discovery broke in Node 22 (see the comment in `scripts/test.js`).
- Test files are `*.test.js`. The script sets `LOG_LEVEL=silent`. CI (`.github/workflows/ci.yml`) runs `npm test` on Node 20.
- Build deps with `createTestDeps()` from `tests/helpers/fakes.js`. It gives a recording logger and a fake `sleep` whose `.calls` array you assert on (`assert.deepEqual(deps.sleep.calls, [200])`), so tests never wait on real timers.
- Assert errors by `code`, for example `assert.throws(..., { code: 'INVALID_RECIPIENT' })`. Route tests start a real server on port 0 (`tests/routes/notifications.routes.test.js`).
- Sandbox provider behaviour is keyed on the address: "bounce" gives a permanent 400, and "flaky" gives a 503 on the first try, then succeeds (`src/providers/email-provider.js`).

## 4. Commit messages

Format: `type(scope): imperative summary [BILL-nnn]`, one line, with the ticket in square brackets at the end. This is from `git log`:

```
feat(dispatch): de-duplicate dispatches on dedupeKey via Redis [BILL-134]
feat(errors): add AppError, error-code registry, withRetry and maskRecipient for new code [BILL-121]
feat(channels): add email channel with retry [BILL-112]
docs(tickets): add channel backlog BILL-142, BILL-157, BILL-163, BILL-171 [BILL-140]
chore(repo): scaffold billing-notify service [BILL-101]
```

- Types seen so far are `feat`, `docs` and `chore`. The scope is the area changed (`channels`, `dispatch`, `errors`, `tickets`, `repo`).
- Tickets are in `docs/tickets/BILL-nnn.md`. Use the ticket you're working on, and don't invent a number.
