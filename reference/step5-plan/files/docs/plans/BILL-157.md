# BILL-157 plan: SMS channel with retry

Files to add or change, one line each:

- `config/channels.js` (change): add an `sms` entry with `retry: { attempts: 4, baseDelayMs: 500 }` (from the ticket), `segmentLength: 160` and `maxSegments: 3`, so the 480-character limit lives in config rather than as a magic number.
- `src/channels/sms.channel.js` (new): default export `{ name: 'sms', validate, send }`.
  - `validate` throws `INVALID_RECIPIENT` unless `to` matches `/^\+\d{8,15}$/` (E.164 as the ticket defines it).
  - `validate` also throws `VALIDATION_FAILED` (existing code, HTTP 400) if `body` is longer than `segmentLength * maxSegments` (480) characters. It runs before anything is sent, and before the dedupe key is claimed, since the dispatch service calls `validate` first.
  - `send` calls `deps.providers.sms.send({ to, text: body })` inside `withRetry()` using `config.channels.sms.retry`. The text is the body only; the subject is ignored.
  - Provider errors: 404/410 → `RECIPIENT_GONE` (rule 2; permanent, not retried). Other errors → `fromProviderError(err, 'sms')`, so 5xx is retried and other 4xx (e.g. the landline 400) is permanent and attempted once.
  - Returns `{ providerRef, segments }`, taking `segments` from the provider response because that is what the aggregator bills.
  - Logs only through `deps.logger`, with the number only via `maskRecipient()`.
- `src/channels/index.js` (change): import `sms` and register it in `CHANNELS`.
- `src/services/dispatch.service.js` (change): the service currently keeps only `providerRef` from `channel.send`. Pass `segments` through when the channel returns it, in `store.update(...)` and in the returned object, so the 202 response and the stored record both include `segments`. Other channels return no `segments` and their output is unchanged. `store.js` needs no change because `update` already merges arbitrary fields.
- `migrations/003_add_segments.sql` (new): `ALTER TABLE notification_log ADD COLUMN segments INTEGER;`. It is nullable because only SMS rows have a value. Migrations 001 and 002 are applied and stay untouched (rule 9).
- No change to `src/lib/error-codes.js`, because `INVALID_RECIPIENT`, `VALIDATION_FAILED` and `RECIPIENT_GONE` already exist. No change to `src/providers/sms-provider.js`, which is a sandbox stand-in.

## Tests to add

`tests/channels/sms.channel.test.js` (new), using `createTestDeps` and the fake sleep:
- `validate` accepts well-formed E.164 numbers, and rejects `nope`, a missing `+`, 7 digits, 16 digits and `undefined` with `INVALID_RECIPIENT` (400).
- `validate` accepts a body of exactly 480 characters and rejects 481 with `VALIDATION_FAILED` (400).
- `send` passes `text` = body and no subject to the provider.
- A `…7777` number (503 twice) is delivered on attempt 3, and the fake sleep records `[500, 1000]`.
- A `…0000` number throws `PROVIDER_REJECTED`, the provider is called once, and there are no sleeps.
- A stubbed 404 and a stubbed 410 throw `RECIPIENT_GONE` with no retry.
- A persistent 5xx exhausts 4 attempts, throws `PROVIDER_UNAVAILABLE`, and sleeps `[500, 1000, 2000]` (`withRetry` doubles the delay each time).
- `send` returns `segments` (1 for a short body, 2 for a body of 161–320 characters).
- The raw phone number never appears in `deps.logger.lines`.

`tests/routes/notifications.routes.test.js` (change): add cases for the acceptance criteria.
- An SMS `payment-failed` dispatch to a valid number returns 202 with `segments` in the body, and `GET /notifications/:id` shows `segments` on the stored record.
- A `…7777` number returns 202 (delivered on attempt 3).
- A `…0000` number is attempted once, and the response is the error-handler's 502 for `PROVIDER_REJECTED`.
- A body over 480 characters returns 400 with nothing sent. This needs a template whose data pushes the rendered body past 480 characters, for example a very long `data.amount`.
- A non-SMS dispatch (email or push) has no `segments` in its response.

## Open questions

1. **Over-length error code.** The ticket says only "400". I plan to reuse `VALIDATION_FAILED` rather than add a new code such as `MESSAGE_TOO_LONG`. A new code is a one-line addition if Collections wants clients to tell it apart.
2. **Unicode text.** The ticket counts characters, and the sandbox provider also uses `text.length / 160`. Real aggregators drop to 70 characters per segment for non-GSM text such as emoji or some accented characters, which would make the cost-tracking numbers wrong. I plan to follow the ticket and count characters. Please confirm that is acceptable.
3. **Which segment count to trust.** I use the provider's returned `segments` for the log. Our pre-send check uses `length / 160`. They agree for GSM text.
4. **Leading digit.** The ticket pattern is `+` then 8 to 15 digits, so `+0…` would pass. Real E.164 country codes never start with 0. I plan to follow the ticket as written.
5. **Failure rows.** A failed SMS row has no `segments`, because the provider returns none on failure. Finance may want a locally computed count there too. I plan to leave it out unless asked.

## Notes

- Retry numbers (4 attempts, 500 ms) come from the ticket, so the rule 3 default does not apply.
- `README.md`, `package.json`, `.github/` and `docs/` (other than this plan) stay untouched. Possible follow-ups for the final summary: add `sms` to the channel list in `README.md`, and add SMS to any `.env.example` or docs that list channels.
- Commit: `feat(channels): add sms channel with retry and segment logging [BILL-157]`.
- Run `npm test` after each step.
