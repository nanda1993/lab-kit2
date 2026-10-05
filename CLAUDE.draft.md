# billing-notify

Kestrel Mobile's billing notifications service. Other services call `POST /notifications/dispatch`;
we render a billing template and deliver it over a channel. Plain Node 20+, ES modules, no runtime
dependencies.

Every rule below names the file it was derived from. Paths are relative to the billing-notify repo root.

## 1. Error handling

1. **Throw `AppError`, never a raw `Error`.** `new AppError(code, message, { retryable, cause, details })`
   from `src/lib/app-error.js`. It is "the one error type the service throws" (`app-error.js:3`), and every
   layer uses it: `src/routes/notifications.routes.js:11` (`NOT_FOUND`), `src/middleware/api-key.js:8`
   (`UNAUTHORIZED`), `src/services/dispatch.service.js:13,22`, `src/channels/index.js:13`.
   Exception: the sandbox stand-ins in `src/providers/` throw plain `Error` + `statusCode` on purpose,
   to look like the real SDKs (`src/providers/email-provider.js:12`).
2. **Register the code first.** Add `CODE: { status }` to `src/lib/error-codes.js` ("Add a code here before
   using it", line 2). Codes are `UPPER_SNAKE`. The HTTP status comes from the code, so callers never pick
   one (`app-error.js:3-4`). An unregistered code throws a `TypeError`
   (`app-error.js:9`, tested in `tests/lib/app-error.test.js`, "refuses codes that are not registered").
3. **Only the error handler builds error responses.** Routes and services throw; `errorHandler` in
   `src/middleware/error-handler.js` ("the single place that turns errors into HTTP responses", line 3)
   writes `{ "error": { "code", "message" } }` (`AppError.toResponse()`, tested in
   `tests/lib/app-error.test.js`). Extra data goes in `details`, never into the body. The handler turns
   it into headers: `rate-limit.js:26-27` passes `details: { retryAfterSeconds }` and
   `error-handler.js:10` sets `Retry-After` from it.
4. **Convert provider errors at the channel boundary** with `fromProviderError(err, '<channel>')`
   (`src/lib/provider-error.js:3-6`): 4xx becomes `PROVIDER_REJECTED` (permanent), 5xx or no status
   becomes `PROVIDER_UNAVAILABLE` (`retryable: true`). The rest of the service only ever sees `AppError`.
5. **Retry only through `withRetry(fn, { attempts, baseDelayMs }, { logger, sleep, label })`**
   (`src/lib/retry.js`). It retries only errors with `retryable: true` and backs off
   `baseDelayMs * 2 ** (attempt - 1)` (`retry.js:15-17`); permanent errors are thrown straight away
   (`tests/lib/retry.test.js`, "does not retry a permanent error"). Retry numbers live in config, e.g.
   `config/channels.js:5` (`attempts: 3, baseDelayMs: 200`).
6. **Invalid input is a 400 raised from the channel's `validate()`**, before anything is sent
   (`src/services/dispatch.service.js` calls `channel.validate(message)` before `channel.send`).
   Use `INVALID_RECIPIENT` for a bad `to` (`tests/lib/app-error.test.js` pins it to 400; BILL-171 in
   `docs/tickets/BILL-171.md` asks for the same on the in-app channel).
7. **Don't copy the legacy channels.** `src/channels/email.channel.js` and `src/channels/inapp.channel.js`
   predate `AppError`: raw `Error` (`inapp.channel.js:9`), `Object.assign(new Error(...), { statusCode, code })`
   (`email.channel.js:10,28`), a hand-rolled retry loop (`email.channel.js:17-25`), `console.log` and
   unmasked recipients (`inapp.channel.js:18`). `errorHandler` still has an `err.statusCode` branch
   (`error-handler.js:13`) only so they keep working. Migration is tracked in `docs/tickets/BILL-171.md`.

## 2. File and module naming

All files are kebab-case. A role suffix marks the kinds of file below. Every relative import ends in `.js`.

| Kind | Path pattern | Export shape | Examples |
|---|---|---|---|
| Channel | `src/channels/<name>.channel.js` | default export `{ name, validate(message), send(message, deps) }`, registered in the `CHANNELS` map in `src/channels/index.js` | `email.channel.js`, `inapp.channel.js` |
| Route | `src/routes/<area>.routes.js` | `register<Area>Routes(app, deps)` | `notifications.routes.js` |
| Service | `src/services/<name>.service.js` | `create<Name>Service(deps)` | `dispatch.service.js` |
| Provider | `src/providers/<name>-provider.js` (hyphen, not dot) | `create<Name>Provider()`, collected by `createProviders()` in `src/providers/index.js` | `email-provider.js`, `push-provider.js` |
| Middleware | `src/middleware/<what>.js`, no suffix | factory returning `(req, res, next)`, or `(err, req, res, next)` for the error handler | `api-key.js` → `requireApiKey`, `rate-limit.js` → `rateLimit`, `error-handler.js` → `errorHandler` |
| Lib | `src/lib/<what>.js`, no suffix | `create<Thing>()` factories and helpers | `app-error.js`, `error-codes.js`, `provider-error.js`, `redis.js` → `createRedisClient`, `logger.js` → `createLogger`, `store.js` → `createStore` |
| Config | `config/<area>.js`, a frozen object re-exported by `config/index.js` | `Object.freeze({...})` | `channels.js`, `limits.js` |
| Migration | `migrations/NNN_<what>.sql`, never edit an applied one | n/a | `001_create_notification_log.sql` (header: "Never edit an applied migration; add a new one") |
| Ticket / plan | `docs/tickets/BILL-NNN.md`, `docs/plans/BILL-NNN.md` | n/a | `docs/tickets/BILL-142.md`, `docs/plans/BILL-176.md` |

- **Tests mirror `src/`**, one `<file>.test.js` per module: `src/channels/email.channel.js` →
  `tests/channels/email.channel.test.js`; `src/lib/app-error.js` → `tests/lib/app-error.test.js`;
  `src/middleware/rate-limit.js` → `tests/middleware/rate-limit.test.js`; route tests in
  `tests/routes/notifications.routes.test.js`. Shared test doubles are in `tests/helpers/fakes.js`.
- **Test titles are sentences about behaviour**, subject first: `'AppError takes its HTTP status from the
  error code'` (`tests/lib/app-error.test.js`), `'send() does not retry ...'` (`tests/channels/email.channel.test.js`).
- **Only `config/` reads `process.env`**: `config/index.js:1` says so, and a grep of `src/` and `tests/`
  finds no other reader. Everything else imports `config`.
- `src/services/templates.js` has no `.service.js` suffix. It is the one file that doesn't follow the pattern.

## 3. Running tests

- `npm test` runs `node scripts/test.js` (`package.json`). It runs every `*.test.js` under `tests/` with the
  built-in `node:test` runner and sets `LOG_LEVEL=silent` (`scripts/test.js:27`).
  - one folder: `npm test -- tests/lib`
  - one file: `npm test -- tests/lib/retry.test.js`
  - coverage: `npm test -- --coverage`
- Don't call `node --test <folder>` directly. Since Node 22 it no longer discovers tests inside a folder, which is
  why `scripts/test.js` expands folders itself (`scripts/test.js:6-7`).
- Needs Node >= 20 (`package.json` `engines`). CI runs `npm test` on Node 20 for every push and pull request
  (`.github/workflows/ci.yml`). A change is done when `npm test` passes.
- Test style, as in every file under `tests/`: `node:test` and `node:assert/strict`; build dependencies with
  `createTestDeps()`, `createFakeSleep()` and `createTestLogger()` from `tests/helpers/fakes.js`. No real timers:
  use the fake sleep, and a fake clock through `createRedisClient({ now })`
  (`tests/middleware/rate-limit.test.js:9`, `tests/lib/redis.test.js:7`). HTTP tests start the app on an
  ephemeral port with `server.listen(0)` (`tests/routes/notifications.routes.test.js:13`).
- Run the service: `npm start` (port 3000; requests need `x-api-key: dev-key-billing`, from the default in
  `config/index.js` and the curl in `README.md`).

## 4. Commit messages

`type(scope): summary [BILL-123]`

- `type` is one of `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`.
- `scope` is lowercase letters, digits and hyphens, e.g. `channels`, `middleware`, `repo`.
- `[BILL-<number>]` ends the subject line and is the ticket from `docs/tickets/`.
- Examples: `docs(repo): add CLAUDE.md and agent permissions [BILL-170]` (`tools/catch-up.js:54`),
  `feat(channels): add push channel [BILL-142]`.
- The format is enforced by `tools/check-conventions.js` (rule R10, the regex at line 103):
  `^(feat|fix|chore|docs|test|refactor|perf)\([a-z0-9-]+\): .+ \[BILL-\d+\]$`.
