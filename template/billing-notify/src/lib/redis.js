// The service's Redis client. In this sandbox it is an in-memory stand-in with the
// same method names as the ioredis calls we use in production (get, set with EX/NX,
// incr, expire, ttl, del), so code written against it moves across unchanged.
export function createRedisClient({ now = () => Date.now() } = {}) {
  const data = new Map(); // key -> { value, expiresAt }

  const live = key => {
    const entry = data.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= now()) { data.delete(key); return undefined; }
    return entry;
  };

  return {
    async get(key) { return live(key)?.value ?? null; },
    async set(key, value, ...opts) {
      const flags = opts.map(o => (typeof o === 'string' ? o.toUpperCase() : o));
      if (flags.includes('NX') && live(key)) return null;
      const exIdx = flags.indexOf('EX');
      const expiresAt = exIdx > -1 ? now() + Number(flags[exIdx + 1]) * 1000 : null;
      data.set(key, { value: String(value), expiresAt });
      return 'OK';
    },
    async incr(key) {
      const entry = live(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      data.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async expire(key, seconds) {
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = now() + seconds * 1000;
      return 1;
    },
    async ttl(key) {
      const entry = live(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.ceil((entry.expiresAt - now()) / 1000);
    },
    async del(key) { return data.delete(key) ? 1 : 0; },
  };
}

export const redis = createRedisClient();
