# BILL-142 · Add a push notification channel

**Requested by:** Digital channels team · **Priority:** P2

Customers who use the Kestrel app want billing notices as push notifications instead of
email.

## What we need
- A new channel called `push` that `POST /notifications/dispatch` accepts.
- `to` is the customer's device token: `kst_` followed by 32 letters or digits.
- Send through the push gateway client in `src/providers/push-provider.js`.
  The push title is the template's subject and the push body is the template's body.
- The gateway sometimes returns 5xx during bill runs; those sends should be retried.
  A 410 means the app was uninstalled, so don't retry it.

## Acceptance
- Dispatching a `bill-ready` notice with `"channel": "push"` and a valid token returns 202.
- A malformed token is rejected with 400 before anything is sent.
- Tests cover the above.
