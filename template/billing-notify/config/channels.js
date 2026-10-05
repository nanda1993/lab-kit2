// Per-channel settings. Every channel in src/channels/ has an entry here.
export const channels = Object.freeze({
  email: Object.freeze({
    from: process.env.EMAIL_FROM ?? 'billing@kestrel.example',
    retry: Object.freeze({ attempts: 3, baseDelayMs: 200 }),
  }),
  sms: Object.freeze({
    retry: Object.freeze({ attempts: 4, baseDelayMs: 500 }),
    segmentLength: 160,
    maxSegments: 3,
  }),
  inapp: Object.freeze({
    maxInboxSize: 50,
  }),
});
