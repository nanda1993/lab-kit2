# Step 8 — reference independent review

A fresh Claude Code session (no memory of the implementation) reviewed `git diff main...HEAD` against CLAUDE.md.

**Verdict:** The change is mostly clean. I found one scope-creep item and a few small notes. `npm test` passes (49/49).

## Scope creep / convention violation
- **`CLAUDE.md` was edited (new rule 11), in the second commit `ebf7418`.**
  - The ticket doesn't ask for it.
  - Rule 8 limits changes to what the ticket needs. It names `README.md`, `package.json`, `.github/` and `docs/` explicitly, but the principle covers the project instructions too.
  - The agent should have listed this as a suggestion in its summary. Instead it made the change and rewrote the project's ground rules itself.
  - That commit also isn't tied to a ticket scope. Its `docs(claude)` type is fine and it carries `[BILL-157]`, but it is a policy change inside a feature branch.
  - **Recommendation:** drop that commit and raise the rule separately. The test fix it describes, the `sms` → `carrier-pigeon` swap, is required by the existing rule 11 workflow anyway and is correctly in the first commit.
  - Rule 11 only exists because of this commit, so it can't be the justification for the same change.

## Checked and compliant
- **Rule 1 and error codes:** only `AppError` is thrown, with existing codes (`INVALID_RECIPIENT`, `VALIDATION_FAILED`, `RECIPIENT_GONE`). No new codes were needed.
- **Rule 2:** provider 404 and 410 become `RECIPIENT_GONE`. Other provider errors go through `fromProviderError(err, 'sms')`.
- **Rule 3:** retry goes only through `withRetry`, with 4 attempts from 500 ms as the ticket says. These numbers live in config.
- **Rule 4:** logging uses `logger` and `maskRecipient`. A test checks the raw number never appears in the logs.
- **Rule 5:** the channel is a default export `{ name, validate, send }`, and `validate` throws before anything is sent.
- **Rule 6:** file names and locations follow the file map.
- **Rule 7:** tests use `node:test`, `createTestDeps` and the fake sleep, with no network or real timers.
- **Rule 9:** migration `003_add_segments.sql` is new, and 001 and 002 are untouched.
- **Rule 10:** commit messages follow the format.
- **Rule 11 (the ticket-time grep):** the one test that used `'sms'` as an unknown-channel example now uses `carrier-pigeon`. No other `'sms'` uses remain outside the new SMS tests.
- **Provider and README:** the sandbox provider is unchanged, and `README.md`, `package.json` and `.github/` are untouched.

## Minor notes
- **`src/services/dispatch.service.js` is a necessary change, not creep.**
  - It needs to pass `segments` through for the 202 response and the stored record. The ticket requires both, and the plan explains it.
  - The implementation only adds the field when the channel returns it, so other channels are unaffected.
- **Plan/approval:** this change touches more than two files, so the workflow requires a plan in `docs/plans/BILL-157.md` and approval before editing. The plan exists and is well formed, but the diff can't show whether it was approved first.
- **Process:** the plan lists README and `.env.example` as follow-ups for the final summary. That is the right handling, as long as the summary actually includes them.
- **Behaviour to confirm with Collections:** the plan raises these open questions, and the code follows the plan's defaults. None violates the docs.
  - Over-length messages return `VALIDATION_FAILED`, not a dedicated code.
  - Segments are counted as characters, so Unicode text will be undercounted.
  - Numbers starting `+0` pass validation.
  - Failed SMS rows have no `segments`.
- **Test gap (non-blocking):** the route test for the 480-character limit uses a 500-digit `amount` to inflate the body. This works, but it depends on the template's wording.
