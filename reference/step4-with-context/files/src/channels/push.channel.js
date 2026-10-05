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
      throw new AppError('INVALID_RECIPIENT', 'push recipient must be a device token: "kst_" followed by 32 letters or digits');
    }
  },

  async send(message, { providers, logger, sleep }) {
    const { to, subject, body } = message;
    const result = await withRetry(async () => {
      try {
        return await providers.push.send({ token: to, title: subject, body });
      } catch (err) {
        // The app was uninstalled: CRM sync purges the token. Permanent, so never retried.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          throw new AppError('RECIPIENT_GONE', 'push device token is no longer registered', { cause: err });
        }
        throw fromProviderError(err, 'push');
      }
    }, config.channels.push.retry, { logger, sleep, label: 'push.send' });
    logger.info('push sent', { to: maskRecipient(to), providerRef: result.providerRef });
    return { providerRef: result.providerRef };
  },
};
