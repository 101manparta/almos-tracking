import type { Request, Response } from 'express';
import { createBackendApp } from './app.ts';

export const app = createBackendApp();

export default function handler(req: Request, res: Response) {
  const rawUrl = req.url || '/';
  const qIndex = rawUrl.indexOf('?');
  if (qIndex !== -1) {
    const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
    const rewrittenPath = params.get('__path');
    if (rewrittenPath !== null) {
      params.delete('__path');
      const remainingQs = params.toString();
      const normalizedPath = rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath}`;
      req.url = `/api${normalizedPath}${remainingQs ? `?${remainingQs}` : ''}`;
    }
  }
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  }
  return app(req, res);
}
