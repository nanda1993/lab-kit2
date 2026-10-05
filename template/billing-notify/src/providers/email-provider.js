// Sandbox stand-in for the email gateway SDK. Errors look like the real SDK's:
// a plain Error with a numeric statusCode.
//   address containing "bounce" → 400 (permanent)
//   address containing "flaky"  → 503 on the first attempt, then succeeds
export function createEmailProvider() {
  const seen = new Map();
  let counter = 0;
  return {
    async send({ from, to, subject, body }) {
      const attempts = (seen.get(to) ?? 0) + 1;
      seen.set(to, attempts);
      if (to.includes('bounce')) throw Object.assign(new Error('mailbox does not exist'), { statusCode: 400 });
      if (to.includes('flaky') && attempts === 1) throw Object.assign(new Error('gateway timeout'), { statusCode: 503 });
      counter += 1;
      return { providerRef: `em_${counter}`, accepted: true, from, subjectLength: subject.length, bodyLength: body.length };
    },
  };
}
