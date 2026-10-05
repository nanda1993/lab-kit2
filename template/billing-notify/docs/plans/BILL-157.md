# BILL-157 plan: SMS channel with retry

`sms` channel: `to` is an E.164 number (`+` then 8 to 15 digits). Sends through `providers.sms.send({ to, text })`, text = template body only. Retries 5xx up to 4 attempts from 500 ms; permanent failures are attempted once. Bodies over 480 characters are rejected with 400 before sending. Segments are recorded on the notification log.

## Files to add or change

- `config/channels.js` (change): add `sms` with `retry: { attempts: 4, baseDelayMs: 500 }` (from the ticket, so the CLAUDE.md rule 3 default does not apply), `segmentLength: 160` and `maxSegments: 3`, so the 480-character limit lives in config instead of being a magic number.
- `src/channels/sms.channel.js` (new): default export `{ name: 'sms', validate, send }`, per rule 5.
  - `validate` throws `INVALID_RECIPIENT` unless `to` matches `/^\+\d{8,15}$/`.
  - `validate` also throws `VALIDATION_FAILED` (existing code, 400) when `body` is longer than `segmentLength * maxSegments`. The dispatch service calls `validate` before claiming the dedupe key, so an over-length message does not burn the key.
  - `send` calls `providers.sms.send({ to, text: body })` inside `withRetry()` with `config.channels.sms.retry`. The subject is ignored.
  - Provider 404/410 throws `RECIPIENT_GONE` (rule 2, not retried). Anything else goes through `fromProviderError(err, 'sms')`: 5xx is retried, other 4xx (the landline 400) is permanent.
  - Returns `{ providerRef, segments }`, with `segments` taken from the provider response because that is what the aggregator bills.
  - Logs only through `deps.logger`; the number appears only via `maskRecipient()`.
- `src/channels/index.js` (change): import `sms` and register it in `CHANNELS`, so `getChannel('sms')` resolves.
- `src/services/dispatch.service.js` (change): today only `providerRef` survives `channel.send`. Pass `segments` through when the channel returns it, in both `store.update(...)` and the returned object, so the 202 response and the stored record include it. Other channels return no `segments`, so their output is unchanged. `src/lib/store.js` needs no change because `update` merges arbitrary fields.
- `migrations/003_add_segments.sql` (new): `ALTER TABLE notification_log ADD COLUMN segments INTEGER;`. Nullable because only SMS rows have a value. 001 and 002 are applied and stay untouched (rule 9).
- `tests/channels/sms.channel.test.js` (new) and `tests/routes/notifications.routes.test.js` (change): see below.

Not touched: `src/lib/error-codes.js` (`INVALID_RECIPIENT`, `VALIDATION_FAILED` and `RECIPIENT_GONE` already exist), `src/providers/sms-provider.js` (sandbox stand-in), `email`/`inapp` channels (legacy, don't copy), README, package.json, .github, other docs.

## Tests to add

`tests/channels/sms.channel.test.js` (new), using `createTestDeps` and the fake sleep:
- `validate` accepts well-formed E.164 numbers. It rejects `nope`, a missing `+`, 7 digits, 16 digits and `undefined` with `INVALID_RECIPIENT` (400).
- `validate` accepts a body of exactly 480 characters and rejects 481 with `VALIDATION_FAILED` (400).
- `send` passes `text` = body and no subject to the provider.
- A `…7777` number (503 twice) is delivered on attempt 3, and the fake sleep records `[500, 1000]`.
- A `…0000` number throws `PROVIDER_REJECTED`, the provider is called once, and there are no sleeps.
- A stubbed 404 and a stubbed 410 throw `RECIPIENT_GONE` with no retry.
- A persistent 5xx exhausts 4 attempts, throws `PROVIDER_UNAVAILABLE`, and sleeps `[500, 1000, 2000]`.
- `send` returns `segments` (1 for a short body, 2 for 161 to 320 characters).
- The raw phone number never appears in `deps.logger.lines`.

`tests/routes/notifications.routes.test.js` (change), covering the acceptance criteria:
- An SMS `payment-failed` dispatch to a valid number returns 202 with `segments`, and `GET /notifications/:id` shows `segments` on the stored record.
- A `…7777` number returns 202 (delivered on attempt 3).
- A `…0000` number is attempted once and returns the error handler's 502 for `PROVIDER_REJECTED`.
- A body over 480 characters returns 400 with nothing sent (use a very long `data.amount` so the rendered body passes 480).
- An email or push dispatch has no `segments` in its response.

## Open questions

1. **Over-length error code.** The ticket says only "400". I plan to reuse `VALIDATION_FAILED`. A dedicated code such as `MESSAGE_TOO_LONG` is a one-line addition if Collections wants clients to tell it apart.
2. **Unicode text.** The ticket counts characters, and the sandbox provider also uses `length / 160`. Real aggregators drop to 70 characters per segment for non-GSM text (emoji, some accented characters), which would make cost-tracking numbers wrong. I plan to count characters as the ticket says. Is that acceptable?
3. **Which segment count to trust.** I record the provider's returned `segments`; the pre-send check uses `length / 160`. They agree for GSM text.
4. **Leading digit.** The ticket pattern allows `+0…`, though real country codes never start with 0. I plan to follow the ticket as written.
5. **Failed rows.** A failed SMS row has no `segments`, since the provider returns none on failure. Finance may want a locally computed count there. I plan to leave it out unless asked.
6. **Commit and PR scope.** The working tree already holds uncommitted BILL-142 (push) changes, which came along with the new branch. Should they be committed separately or stashed before BILL-157 work starts, so this branch contains only SMS changes?

## Notes

- Run `npm test` after each step.
- Commit: `feat(channels): add sms channel with retry and segment logging [BILL-157]`.
- Possible follow-ups, not in scope: add `sms` to the channel list in `README.md`.
