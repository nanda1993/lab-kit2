# billing-notify

Kestrel Mobile's billing notifications service. Other services call
`POST /notifications/dispatch`; we render a billing template and deliver it over a channel
(email, in-app, and soon push and SMS). Plain Node 20+, ES modules, no runtime dependencies.

## Commands
- Test: `npm test` (all) · `npm test -- tests/channels` (one folder) · `npm test -- --coverage`
- Run: `npm start` (port 3000, needs `x-api-key: dev-key-billing`)
- A change is done when `npm test` passes. Run it after every step, not just at the end.

## File map
| Change | Goes in |
|---|---|
| New channel | `src/channels/<name>.channel.js`, registered in `src/channels/index.js`, settings in `config/channels.js` |
| New error code | `src/lib/error-codes.js` (code → HTTP status) |
| New config value | `config/` — the only place that reads `process.env` |
| Provider (gateway) client | `src/providers/<name>-provider.js` (sandbox stand-ins; don't change their behaviour) |
| HTTP route | `src/routes/<area>.routes.js` · middleware in `src/middleware/` |
| Schema change | a new `migrations/NNN_<what>.sql` |
| Tests | `tests/` mirrors `src/`: `src/channels/sms.channel.js` → `tests/channels/sms.channel.test.js` |

## Rules
1. Throw `new AppError('CODE', 'message')` from `src/lib/app-error.js`. Never `throw new Error`.
   Register every new code in `src/lib/error-codes.js` first.
2. Convert provider errors at the channel boundary with `fromProviderError(err, '<channel>')`
   (`src/lib/provider-error.js`). Exception: a provider 404 or 410 means the recipient no longer
   exists. Throw `RECIPIENT_GONE` (status 410) so CRM sync can purge the token or number.
3. Retry only through `withRetry()` from `src/lib/retry.js`. No hand-rolled loops, no `setTimeout`.
   Retry numbers come from the ticket; if it gives none, use `attempts: 3, baseDelayMs: 200` and say so.
4. Log through the injected `deps.logger`. Never `console.*`. Log recipients only via
   `maskRecipient()` from `src/lib/mask.js`: emails, phone numbers and device tokens are PII.
5. A channel is a default export `{ name, validate(message), send(message, deps) }`.
   `validate` throws `INVALID_RECIPIENT` before anything is sent.
6. Files go where the file map says, in kebab-case with a role suffix (`.channel.js`, `.routes.js`,
   `.service.js`, `-provider.js`, `.test.js`). Only `config/` reads `process.env`.
7. Tests use `node:test` and `node:assert/strict`, and the fakes in `tests/helpers/fakes.js`
   (`createTestDeps`, fake `sleep`). No real timers, no network.
   Invalid-input tests use values that can never become valid (`carrier-pigeon`, `not-a-token`),
   never a channel, template or code that is on the backlog. (Learned on BILL-157: a test used `sms`
   as its "unknown channel" and broke the day SMS shipped.)
8. Change only what the ticket needs. Don't edit `README.md`, `package.json`, `.github/` or `docs/`
   unless the ticket asks; list anything else you think should change at the end of your summary.
9. Never edit an applied migration in `migrations/`. Add a new numbered file.
10. Commits: `type(scope): summary [BILL-123]`, e.g. `feat(channels): add push channel [BILL-142]`.

## Don't copy
`src/channels/email.channel.js` and `src/channels/inapp.channel.js` predate AppError (BILL-121):
raw errors, a hand-rolled retry loop, unmasked logging. They are being migrated under BILL-171.
Model new channels on the rules above, not on these files.

## Workflow
For anything touching more than two files, write the plan first (files to add or change, one line
each, in `docs/plans/<ticket>.md`) and wait for approval before editing.
