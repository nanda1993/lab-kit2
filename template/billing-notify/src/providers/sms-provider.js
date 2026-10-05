// Sandbox stand-in for the SMS aggregator SDK. Numbers are E.164 (+ then 8–15 digits).
//   number ending "0000" → 400 (permanent: not a mobile number)
//   number ending "7777" → 503 on the first two attempts, then succeeds
// One SMS segment is 160 characters; the aggregator bills per segment.
export function createSmsProvider() {
  const seen = new Map();
  let counter = 0;
  return {
    async send({ to, text }) {
      const attempts = (seen.get(to) ?? 0) + 1;
      seen.set(to, attempts);
      if (to.endsWith('0000')) throw Object.assign(new Error('number is not SMS-capable'), { statusCode: 400 });
      if (to.endsWith('7777') && attempts <= 2) throw Object.assign(new Error('aggregator overloaded'), { statusCode: 503 });
      counter += 1;
      return { providerRef: `sm_${counter}`, segments: Math.ceil(text.length / 160) };
    },
  };
}
