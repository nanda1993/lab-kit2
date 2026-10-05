# Step 4 — reference run with CLAUDE.md

Same prompt as Step 2. With CLAUDE.md in place the agent wrote a plan and stopped for approval (CLAUDE.md's Workflow section). After `Plan approved. Go ahead.` it implemented it.

## 1 · The agent's first reply (plan, no code yet)

This change touches more than two files, so `CLAUDE.md` says I need your approval before I edit any code. I've written the plan to `docs/plans/BILL-142.md` and haven't changed anything else.

**Planned changes**
- **`src/lib/error-codes.js`:** register `RECIPIENT_GONE` with status 410. This is for gateway 404/410 responses, per rule 2.
- **`config/channels.js`:** add a `push` entry with the retry settings.
- **`src/channels/push.channel.js` (new):**
  - `validate` throws `INVALID_RECIPIENT` unless the token matches `^kst_[A-Za-z0-9]{32}$`.
  - `send` calls the push provider with title set to the template subject and body set to the template body, wrapped in `withRetry()`.
  - Gateway 404/410 becomes `RECIPIENT_GONE` and is not retried. Other provider errors go through `fromProviderError`, so 5xx is retried and other 4xx is not.
  - Logging goes through `deps.logger` with `maskRecipient()`.
- **`src/channels/index.js`:** register the `push` channel.
- **`tests/channels/push.channel.test.js` (new):** covers these cases:
  - a valid send;
  - malformed tokens;
  - `kst_flaky` retried once and then succeeding;
  - `kst_expired` giving `RECIPIENT_GONE` with no retry;
  - 5xx exhausting all attempts;
  - the token never appearing unmasked in logs.
- **`tests/routes/notifications.routes.test.js`:** add the two acceptance cases, a valid dispatch returning 202 and a malformed token returning 400 with nothing sent.

**Retry numbers:** the ticket gives none, so I'll use the default of `attempts: 3, baseDelayMs: 200`, as rule 3 says.

Should I go ahead with this plan?

## 2 · After approval

The push channel is in and `npm test` passes (33 tests). I haven't committed anything.

- **Channel:** `src/channels/push.channel.js` accepts `to` as `kst_` plus 32 letters or digits. A malformed token gets a 400 (`INVALID_RECIPIENT`) before anything is sent. The title is the template subject and the body is the template body.
- **Errors:** I added `RECIPIENT_GONE` (410) to `src/lib/error-codes.js`. A gateway 404 or 410 returns it and is not retried. Other gateway 4xx errors are rejected without a retry. 5xx errors are retried through `withRetry()`.
- **Retry numbers:** the ticket gave none, so I used the default of 3 attempts with a 200ms base delay. They're in `config/channels.js`.
- **Registration and logging:** the channel is registered in `src/channels/index.js`. It logs through `deps.logger` and only masked tokens.
- **Tests:** `tests/channels/push.channel.test.js` covers the channel cases from the plan, plus a gateway 404 and other 4xx errors. `tests/routes/notifications.routes.test.js` has the 202 and 400 acceptance cases. It also has a route-level 410 check.

My first run had one failure, from a mistake in my own test token. I fixed that and reran.

Nothing else in the repo needs changing, so there's no extra list this time. `docs/plans/BILL-142.md` is untracked and will go in with the commit unless you want it left out. Do you want me to commit with `feat(channels): add push channel [BILL-142]`?

## Convention check on this run

```text

Convention check · 7 file(s) in changes since bbfe4ed

  ~ config/channels.js
  + docs/plans/BILL-142.md
  ~ src/channels/index.js
  + src/channels/push.channel.js
  ~ src/lib/error-codes.js
  + tests/channels/push.channel.test.js
  ~ tests/routes/notifications.routes.test.js

  ✓ R1  Errors are AppError with a registered code, never a raw Error
  ✓ R2  Provider 404/410 raises RECIPIENT_GONE
  ✓ R3  Retries go through withRetry(), no hand-rolled loops or setTimeout
  ✓ R4  Logs go through the injected logger, recipients masked
  ✓ R5  A channel is registered, configured and tested
  ✓ R6  Files where the file map says, kebab-case, process.env only in config/
  ✓ R7  Tests use the shared fakes, no real timers
  ✓ R8  Only what the ticket needs: README, package.json, .github/, docs/ untouched
  ✓ R9  Applied migrations are never edited

  No findings.
```
