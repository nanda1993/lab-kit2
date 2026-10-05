import { AppError } from '../lib/app-error.js';

// Every caller sends x-api-key. The key is kept on req.apiKey for later middleware.
export function requireApiKey(validKeys) {
  const keys = new Set(validKeys);
  return (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (!key || !keys.has(key)) throw new AppError('UNAUTHORIZED', 'Missing or invalid x-api-key header');
    req.apiKey = key;
    return next();
  };
}
