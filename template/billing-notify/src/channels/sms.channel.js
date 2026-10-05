import { AppError } from '../lib/app-error.js';
import { fromProviderError } from '../lib/provider-error.js';
import { withRetry } from '../lib/retry.js';
import { maskRecipient } from '../lib/mask.js';
import { config } from '../../config/index.js';

const E164 = /^\+\d{8,15}$/;

export default {
  name: 'sms',

  validate(message) {
    if (typeof message.to !== 'string' || !E164.test(message.to)) {
      throw new AppError('INVALID_RECIPIENT', 'SMS channel needs an E.164 number in "to": "+" followed by 8 to 15 digits');
    }
    const { segmentLength, maxSegments } = config.channels.sms;
    const maxLength = segmentLength * maxSegments;
    if (typeof message.body !== 'string' || message.body.length > maxLength) {
      throw new AppError('VALIDATION_FAILED', `SMS body is limited to ${maxLength} characters (${maxSegments} segments)`);
    }
  },

  async send(message, { providers, logger, sleep }) {
    const res = await withRetry(async () => {
      try {
        return await providers.sms.send({ to: message.to, text: message.body });
      } catch (err) {
        // 404/410: the number no longer exists. Not retryable; CRM sync purges it.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          throw new AppError('RECIPIENT_GONE', 'Phone number is no longer reachable', { cause: err });
        }
        throw fromProviderError(err, 'sms');
      }
    }, config.channels.sms.retry, { logger, sleep, label: 'sms send' });
    logger.info('sms sent', { to: maskRecipient(message.to), providerRef: res.providerRef, segments: res.segments });
    return { providerRef: res.providerRef, segments: res.segments };
  },
};
