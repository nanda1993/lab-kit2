import { AppError } from '../lib/app-error.js';
import { getChannel } from '../channels/index.js';
import { renderTemplate } from './templates.js';
import { maskRecipient } from '../lib/mask.js';
import { config } from '../../config/index.js';

// Validates a dispatch request, renders the template, de-duplicates on dedupeKey
// (Redis SET NX) and hands the message to the channel.
export function createDispatchService({ providers, logger, redis, store, sleep }) {
  return {
    async dispatch({ channel: channelName, to, template, data, accountId, dedupeKey } = {}) {
      if (!channelName || !to || !template) {
        throw new AppError('VALIDATION_FAILED', 'channel, to and template are required');
      }
      const channel = getChannel(channelName);
      const rendered = renderTemplate(template, data);
      const message = { to, subject: rendered.subject, body: rendered.body, template, accountId };
      channel.validate(message);

      if (dedupeKey) {
        const fresh = await redis.set(`dedupe:${dedupeKey}`, '1', 'EX', config.dedupeTtlSeconds, 'NX');
        if (!fresh) throw new AppError('DUPLICATE_DISPATCH', `Notification "${dedupeKey}" was already sent`);
      }

      logger.info('dispatch accepted', { channel: channelName, template, to: maskRecipient(to) });
      const row = store.insert({ channel: channelName, template, accountId: accountId ?? null, status: 'sending' });
      try {
        const { providerRef } = await channel.send(message, { providers, logger, sleep });
        store.update(row.id, { status: 'sent', providerRef });
        return { id: row.id, status: 'sent', providerRef };
      } catch (err) {
        store.update(row.id, { status: 'failed', errorCode: err.code ?? 'INTERNAL' });
        throw err;
      }
    },

    get(id) {
      return store.get(id);
    },
  };
}
