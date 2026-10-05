import { config } from '../../config/index.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export default {
  name: 'email',

  validate(message) {
    if (typeof message.to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to)) {
      throw Object.assign(new Error('Email channel needs a valid email address in "to"'), { statusCode: 400, code: 'INVALID_RECIPIENT' });
    }
  },

  async send(message, { providers, logger, sleep = wait }) {
    const { from, retry } = config.channels.email;
    let lastErr;
    for (let attempt = 1; attempt <= retry.attempts; attempt++) {
      try {
        const res = await providers.email.send({ from, to: message.to, subject: message.subject, body: message.body });
        logger.info('email sent', { to: message.to, providerRef: res.providerRef });
        return { providerRef: res.providerRef };
      } catch (err) {
        lastErr = err;
        if (err.statusCode && err.statusCode < 500) break;
        if (attempt < retry.attempts) await sleep(retry.baseDelayMs * attempt);
      }
    }
    throw Object.assign(new Error('email send failed: ' + lastErr.message), { statusCode: 502, code: 'PROVIDER_UNAVAILABLE' });
  },
};
