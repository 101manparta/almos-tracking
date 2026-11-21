import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { closePool } from './src/db/index.ts';
import { attachProductionSpa, createBackendApp } from './src/server/app.ts';

async function startServer() {
  const app = createBackendApp();
  const port = Number(process.env.PORT || 3000);
  const distDir = path.resolve(process.cwd(), 'dist');

  if (process.env.NODE_ENV === 'production') {
    if (!fs.existsSync(distDir)) {
      throw new Error(`Production frontend build directory not found: ${distDir}`);
    }
    attachProductionSpa(app, distDir);
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`ALMOS Laundry Tracking Server listening on http://0.0.0.0:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down HTTP server gracefully...`);
    server.close(async () => {
      await closePool().catch((err) => console.error('Error closing SQL pool:', err));
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
