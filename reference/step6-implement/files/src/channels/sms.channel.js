import { AppError } from '../lib/app-error.js';
import { fromProviderError } from '../lib/provider-error.js';
import { withRetry } from '../lib/retry.js';
import { maskRecipient } from '../lib/mask.js';
import { config } from '../../config/index.js';

const E164_MOBILE = /^\+\d{8,15}$/;

export default {
  name: 'sms',

  validate(message) {
    if (typeof message.to !== 'string' || !E164_MOBILE.test(message.to)) {
      throw new AppError('INVALID_RECIPIENT', 'sms recipient must be an E.164 number: "+" followed by 8 to 15 digits');
    }
    const { segmentLength, maxSegments } = config.channels.sms;
    const maxLength = segmentLength * maxSegments;
    if (typeof message.body === 'string' && message.body.length > maxLength) {
      throw new AppError('VALIDATION_FAILED', `sms body is ${message.body.length} characters; the limit is ${maxLength} (${maxSegments} segments)`);
    }
  },

  async send(message, { providers, logger, sleep }) {
    const { to, body } = message;
    const result = await withRetry(async () => {
      try {
        return await providers.sms.send({ to, text: body });
      } catch (err) {
        // The number is no longer in service: CRM sync purges it. Permanent, so never retried.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          throw new AppError('RECIPIENT_GONE', 'sms number is no longer in service', { cause: err });
        }
        throw fromProviderError(err, 'sms');
      }
    }, config.channels.sms.retry, { logger, sleep, label: 'sms.send' });
    logger.info('sms sent', { to: maskRecipient(to), providerRef: result.providerRef, segments: result.segments });
    return { providerRef: result.providerRef, segments: result.segments };
  },
};
