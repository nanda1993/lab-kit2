import { AppError } from '../lib/app-error.js';

export function registerNotificationRoutes(app, { dispatchService, rateLimit }) {
  app.post('/notifications/dispatch', rateLimit, async (req, res) => {
    const result = await dispatchService.dispatch(req.body);
    res.status(202).json(result);
  });

  app.get('/notifications/:id', async (req, res) => {
    const row = dispatchService.get(req.params.id);
    if (!row) throw new AppError('NOT_FOUND', `No notification ${req.params.id}`);
    res.json(row);
  });
}
