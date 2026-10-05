// Request limits per API key. Constants, not env vars.
export const limits = Object.freeze({
  dispatch: Object.freeze({ maxRequests: 100, windowSeconds: 60 }),
});
