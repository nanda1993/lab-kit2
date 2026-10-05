// Per-channel settings. Every channel in src/channels/ has an entry here.
export const channels = Object.freeze({
  email: Object.freeze({
    from: process.env.EMAIL_FROM ?? 'billing@kestrel.example',
    retry: Object.freeze({ attempts: 3, baseDelayMs: 200 }),
  }),
  inapp: Object.freeze({
    maxInboxSize: 50,
  }),
});
