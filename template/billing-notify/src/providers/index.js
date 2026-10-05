import { createEmailProvider } from './email-provider.js';
import { createPushProvider } from './push-provider.js';
import { createSmsProvider } from './sms-provider.js';

export function createProviders() {
  return {
    email: createEmailProvider(),
    push: createPushProvider(),
    sms: createSmsProvider(),
  };
}
