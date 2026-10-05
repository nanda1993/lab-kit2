import { AppError } from '../lib/app-error.js';
import email from './email.channel.js';
import inapp from './inapp.channel.js';
import push from './push.channel.js';
import sms from './sms.channel.js';

// Channel registry. A channel is { name, validate(message), send(message, deps) }.
const CHANNELS = Object.freeze({
  [email.name]: email,
  [inapp.name]: inapp,
  [push.name]: push,
  [sms.name]: sms,
});

export function getChannel(name) {
  const channel = CHANNELS[name];
  if (!channel) throw new AppError('UNKNOWN_CHANNEL', `Unknown channel "${name}"`);
  return channel;
}

export const channelNames = () => Object.keys(CHANNELS);
