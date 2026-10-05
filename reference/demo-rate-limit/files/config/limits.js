// Per-route rate limits. Counted per API key over a fixed window.
export const limits = Object.freeze({
  dispatch: Object.freeze({ maxRequests: 100, windowSeconds: 60 }),
});
