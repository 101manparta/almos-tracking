import cookieParser from 'cookie-parser';
import express from 'express';
import { errorMiddleware } from './errors/app-error.ts';
import { createApiV1Router } from './routes/api.ts';

export function createBackendApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use('/api/v1', createApiV1Router());
  app.use(errorMiddleware);

  return app;
}
