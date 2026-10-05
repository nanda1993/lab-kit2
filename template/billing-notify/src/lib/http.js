// A small Express-style router on node:http, so the service has no dependencies.
// Same shapes as Express: app.use(mw), app.post(path, ...handlers),
// handlers are (req, res, next), and error handlers are (err, req, res, next).
import { AppError } from './app-error.js';

function compile(path) {
  const keys = [];
  const pattern = path.replace(/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  const re = new RegExp(`^${pattern}/?$`);
  return url => {
    const m = re.exec(url);
    if (!m) return null;
    return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  };
}

function decorate(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.set = (name, value) => { res.setHeader(name, String(value)); return res; };
  res.json = body => {
    if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Request body is not valid JSON');
  }
}

export function createApp() {
  const layers = []; // { method, match, handlers, isError }

  const add = (method, path, handlers) => {
    for (const h of handlers) {
      layers.push({ method, match: path ? compile(path) : () => ({}), handler: h, isError: h.length === 4 });
    }
  };

  const app = {
    use: (...handlers) => { add(null, null, handlers); return app; },
    get: (path, ...handlers) => { add('GET', path, handlers); return app; },
    post: (path, ...handlers) => { add('POST', path, handlers); return app; },

    async handle(req, res) {
      decorate(res);
      const [url] = req.url.split('?');
      req.path = url;
      let idx = 0;

      const next = async err => {
        while (idx < layers.length) {
          const layer = layers[idx++];
          if (layer.method && layer.method !== req.method) continue;
          const params = layer.match(url);
          if (!params) continue;
          if (Boolean(err) !== layer.isError) continue;
          req.params = params;
          try {
            if (err) await layer.handler(err, req, res, next);
            else await layer.handler(req, res, next);
          } catch (thrown) {
            return next(thrown);
          }
          return;
        }
        if (!res.writableEnded) {
          const fallback = err ?? new AppError('NOT_FOUND', `No route for ${req.method} ${url}`);
          res.status(fallback.status ?? 500).json({ error: { code: fallback.code ?? 'INTERNAL', message: fallback.message } });
        }
      };

      try {
        req.body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req) : {};
      } catch (err) {
        return next(err);
      }
      return next();
    },
  };
  return app;
}
