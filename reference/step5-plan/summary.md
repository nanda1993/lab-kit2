# Step 5 — reference Planner run

## The agent's reply

I've written the BILL-157 plan to `docs/plans/BILL-157.md` and edited no other file. This touches more than two files, so per CLAUDE.md I'll wait for your approval before editing any code.

**Files to change**
- `config/channels.js` gets an `sms` entry with retry of 4 attempts and a 500 ms base delay, both from the ticket. It also holds the 160-character segment size and the 3-segment limit.
- `src/channels/sms.channel.js` is new.
  - `validate` rejects numbers that aren't `+` followed by 8 to 15 digits (`INVALID_RECIPIENT`).
  - `validate` also rejects bodies over 480 characters (`VALIDATION_FAILED`, 400), before anything is sent.
  - `send` wraps the provider call in `withRetry()`. A 404 or 410 becomes `RECIPIENT_GONE`. Other 4xx errors are permanent and attempted once. A 5xx is retried.
  - `send` returns `{ providerRef, segments }`.
- `src/channels/index.js` registers the new channel.
- `src/services/dispatch.service.js` needs a change you might not expect. It currently keeps only `providerRef` from the channel. It will now also pass `segments` into the stored record and the 202 response.
- `migrations/003_add_segments.sql` is new and adds a nullable `segments` column. Migrations 001 and 002 stay untouched.

**Tests**
- A new `tests/channels/sms.channel.test.js` covers these cases:
  - recipient validation;
  - the 480 versus 481 character boundary;
  - delivery on attempt 3 for a `…7777` number;
  - a `…0000` number attempted once;
  - 404 and 410 becoming `RECIPIENT_GONE`;
  - four attempts exhausted, with sleeps of `[500, 1000, 2000]`;
  - `segments` returned;
  - no unmasked number in the logs.
- `tests/routes/notifications.routes.test.js` gets cases for each acceptance criterion, plus a check that non-SMS channels don't return `segments`.

**Open questions** (full list in the plan)
1. Should the over-length error reuse `VALIDATION_FAILED`, or get its own code?
2. Real aggregators count non-GSM text such as emoji at 70 characters per segment, so cost numbers could be off. I'd follow the ticket and count characters. Is that acceptable?
3. Should failed SMS rows also record a segment count? I'd leave it out unless asked.
4. A number like `+0…` passes the ticket's pattern, even though real country codes never start with 0. I'd follow the ticket as written.

I'd also suggest listing `sms` in `README.md` as a follow-up, but I won't touch it unless you ask.

The full plan is in `files/docs/plans/BILL-157.md`.
