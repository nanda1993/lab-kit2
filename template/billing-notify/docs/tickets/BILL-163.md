# BILL-163 · Quiet hours for push and SMS

**Requested by:** Customer experience · **Priority:** P3

TRAI guidance and our own complaints data say customers don't want billing pings at night.

## What we need
- Push and SMS notices requested between 21:00 and 08:00 IST are not sent immediately.
  They are stored with status `deferred` and a `sendAfter` time of 08:00 IST next morning.
- Email and in-app are not affected.
- `payment-failed` notices ignore quiet hours (service may be suspended).
- The quiet-hours window lives in config.

## Acceptance
- A push request at 22:30 IST returns 202 with `status: "deferred"` and the right `sendAfter`.
- The same request at 10:00 IST is sent as normal.
- A `payment-failed` SMS at 23:00 IST is sent immediately.
