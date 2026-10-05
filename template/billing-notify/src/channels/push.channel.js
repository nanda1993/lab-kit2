import { AppError } from '../lib/app-error.js';
import { fromProviderError } from '../lib/provider-error.js';
import { withRetry } from '../lib/retry.js';
import { maskRecipient } from '../lib/mask.js';
import { config } from '../../config/index.js';

const DEVICE_TOKEN = /^kst_[A-Za-z0-9]{32}$/;

export default {
  name: 'push',

  validate(message) {
    if (typeof message.to !== 'string' || !DEVICE_TOKEN.test(message.to)) {
      throw new AppError('INVALID_RECIPIENT', 'Push channel needs a device token in "to": "kst_" followed by 32 letters or digits');
    }
  },

  async send(message, { providers, logger, sleep }) {
    const res = await withRetry(async () => {
      try {
        return await providers.push.send({ token: message.to, title: message.subject, body: message.body });
      } catch (err) {
        // 404/410: the app was uninstalled. Not retryable; CRM sync purges the token.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          throw new AppError('RECIPIENT_GONE', 'Device token is no longer registered', { cause: err });
        }
        throw fromProviderError(err, 'push');
      }
    }, config.channels.push.retry, { logger, sleep, label: 'push send' });
    logger.info('push sent', { to: maskRecipient(message.to), providerRef: res.providerRef });
    return { providerRef: res.providerRef };
  },
};
