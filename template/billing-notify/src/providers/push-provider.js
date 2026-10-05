// Sandbox stand-in for the mobile push gateway SDK (used by the Kestrel app).
// Device tokens look like "kst_" followed by 32 letters or digits.
//   token starting "kst_expired" → 410 (permanent: the app was uninstalled)
//   token starting "kst_flaky"   → 503 on the first attempt, then succeeds
export function createPushProvider() {
  const seen = new Map();
  let counter = 0;
  return {
    async send({ token, title, body }) {
      const attempts = (seen.get(token) ?? 0) + 1;
      seen.set(token, attempts);
      if (token.startsWith('kst_expired')) throw Object.assign(new Error('device token no longer registered'), { statusCode: 410 });
      if (token.startsWith('kst_flaky') && attempts === 1) throw Object.assign(new Error('push gateway unavailable'), { statusCode: 503 });
      counter += 1;
      return { providerRef: `pu_${counter}`, delivered: true, titleLength: title.length, bodyLength: body.length };
    },
  };
}
