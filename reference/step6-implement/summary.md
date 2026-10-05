# Step 6 — reference Implementer run

Prompt: approve the plan, implement it, run `npm test` after each file, stop before touching anything outside the plan.

## The agent's reply

BILL-157 is implemented and `npm test` passes (49 tests, 0 failures). I haven't committed anything, so the changes are in the working tree. I ran `npm test` after each file and it passed every time except once, which I explain below.

**What changed**
- `config/channels.js`: `sms` entry with retry of 4 attempts and a 500 ms base delay, plus a segment length of 160 and a limit of 3 segments.
- `src/channels/sms.channel.js` (new): validates the E.164 number and the 480-character limit. It sends the body only, through `withRetry()`. A 404 or 410 becomes `RECIPIENT_GONE`, and other provider errors go through `fromProviderError`. It returns `providerRef` and `segments`.
- `src/channels/index.js`: registers `sms`.
- `src/services/dispatch.service.js`: passes `segments` into the stored record and the response when a channel returns it. Other channels' output is unchanged.
- `migrations/003_add_segments.sql` (new): nullable `segments INTEGER` column.
- `tests/channels/sms.channel.test.js` (new): 10 tests covering every case in the plan.
- `tests/routes/notifications.routes.test.js`: 6 new route cases. They cover the acceptance criteria, a malformed SMS number, and non-SMS channels returning no `segments`.

**One failure along the way**
- An existing route test used `sms` as its example of an unsupported channel. Registering `sms` made it fail, so I changed that one test to use `carrier-pigeon` instead.
- The routes test file was already in the plan, so I made the edit rather than stopping.
- I also kept the test deps in a module-level variable in that file, so the new tests can check whether the provider was called.

I made no changes outside the plan. For the open questions I used the proposed answers. The over-length error reuses `VALIDATION_FAILED`, and I count characters rather than non-GSM encoding. I also kept the ticket's number pattern as written and left failed rows without a segment count.

**Suggested follow-up, not done:** list `sms` as a channel in `README.md`.

## Note on these reference files

In the real run the agent hit the failing route test and fixed it itself. The files here put that test back the way it was before the fix, so anyone who uses `catch-up.js step6` sees the failure the Tester caught and fixes it in Step 7.
