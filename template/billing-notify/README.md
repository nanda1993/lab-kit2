# billing-notify

Kestrel Mobile's billing notifications service. Other services call it when a bill is
ready, a payment is due or a payment has failed, and it delivers the notice to the
customer over one of its channels.

```bash
npm test        # run the suite
npm start       # serve on :3000 (see config/index.js)
```

```bash
curl -s -X POST localhost:3000/notifications/dispatch \
  -H 'content-type: application/json' -H 'x-api-key: dev-key-billing' \
  -d '{"channel":"email","to":"asha@example.com","template":"bill-ready","data":{"amount":"₹749","dueDate":"12 Oct"}}'
```

No runtime dependencies. Provider clients in `src/providers/` are sandbox stand-ins for
the real gateways.
