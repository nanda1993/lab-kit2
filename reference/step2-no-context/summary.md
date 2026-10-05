# Step 2 — reference run without CLAUDE.md

Prompt: `Add a push notification channel as described in docs/tickets/BILL-142.md`

## The agent's summary

The `push` channel is added and `POST /notifications/dispatch` now accepts it. The full suite passes (29 tests). I haven't committed anything.

- **Token check:** `to` must match `kst_` plus 32 letters or digits. A bad token gets a 400 with `INVALID_RECIPIENT` before anything is sent.
- **Sending:** it goes through `src/providers/push-provider.js`, with the template subject as the push title and the template body as the push body.
- **Retries:** gateway 5xx errors are retried up to 3 attempts with backoff starting at 200 ms. A 410 isn't retried and comes back as `PROVIDER_REJECTED`, which maps to a 502.
- **Logging:** the device token is masked in the "push sent" log line.
- **New code:** `src/channels/push.channel.js` is the new channel, registered in `src/channels/index.js`, with its retry settings in `config/channels.js`.
- **Convention:** I built it on the `AppError`/`withRetry`/`fromProviderError` helpers rather than copying the older email channel's hand-rolled retry loop.
- **Tests:** `tests/channels/push.channel.test.js` is new and covers valid and malformed tokens, delivery, retry on a flaky gateway, no retry on 410, and the masked log. I also added two route tests: a valid token returns 202 and a malformed one returns 400.
- **Small edit:** I added "push" to the service description in `package.json`.

## Convention check on this run

```text

Convention check · 6 file(s) in uncommitted changes

  ~ config/channels.js
  ~ package.json
  ~ src/channels/index.js
  ~ tests/routes/notifications.routes.test.js
  + src/channels/push.channel.js
  + tests/channels/push.channel.test.js

  ✓ R1  Errors are AppError with a registered code, never a raw Error
  ✗ R2  Provider 404/410 raises RECIPIENT_GONE
        src/channels/push.channel.js  a provider 404/410 should raise RECIPIENT_GONE (CRM sync purges dead tokens/numbers)
  ✓ R3  Retries go through withRetry(), no hand-rolled loops or setTimeout
  ✓ R4  Logs go through the injected logger, recipients masked
  ✓ R5  A channel is registered, configured and tested
  ✓ R6  Files where the file map says, kebab-case, process.env only in config/
  ✓ R7  Tests use the shared fakes, no real timers
  ✗ R8  Only what the ticket needs: README, package.json, .github/, docs/ untouched
        package.json  outside the ticket's scope unless the ticket asked for it
  ✓ R9  Applied migrations are never edited
  ✓ R10 Commit messages: type(scope): summary [BILL-123]

  2 finding(s) across 2 rule(s)

```
