# BILL-157 · Add an SMS channel with retry

**Requested by:** Collections · **Priority:** P1 (needed for the November payment-failed run)

Customers without the app or an email address on file only get notices by SMS.

## What we need
- A new channel called `sms`. `to` is an E.164 mobile number (`+` then 8 to 15 digits).
- Send through the aggregator client in `src/providers/sms-provider.js`.
  The SMS text is the template's body only (SMS has no subject).
- One SMS segment is 160 characters. Reject anything longer than 3 segments (480
  characters) with a 400 before sending.
- The aggregator is flaky during bill runs: the first two attempts can fail with 5xx.
  Retry transient failures up to **4 attempts**, backing off from **500 ms**.
  Permanent failures (4xx, e.g. a landline) must not be retried.
- Finance wants the number of segments recorded on each SMS in the notification log,
  for cost tracking. The log table doesn't have a column for it yet.

## Acceptance
- An SMS dispatch returns 202, and the response and stored record include `segments`.
- A number that fails twice and then succeeds is delivered on attempt 3.
- A permanent failure is attempted once only.
- A message over 480 characters is rejected with 400.
