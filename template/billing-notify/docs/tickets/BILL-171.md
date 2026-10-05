# BILL-171 · Bring the in-app channel up to current conventions

**Requested by:** Platform team · **Priority:** P3 (tech debt)

`src/channels/inapp.channel.js` predates AppError. An invalid customer ID currently comes
back as a 500 instead of a 400, it logs the customer ID in full, and it ignores
`config.channels.inapp.maxInboxSize`.

## What we need
- Invalid customer IDs raise `INVALID_RECIPIENT` (400).
- Logging goes through the injected logger with the recipient masked.
- The inbox limit comes from config.
- No behaviour change beyond the above.

## Acceptance
- Dispatching in-app to `"to": "104233"` returns 400 `INVALID_RECIPIENT`.
- Existing in-app tests still pass, plus a new one for the 400.
