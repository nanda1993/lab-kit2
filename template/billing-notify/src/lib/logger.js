// Structured JSON-lines logger. Inject it (deps.logger); don't import console.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger({ level = 'info', write = line => process.stdout.write(line + '\n') } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const log = lvl => (msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    write(JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...fields }));
  };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
