let cachedHandler = null;

export default async function vercelEntry(req, res) {
  try {
    if (!cachedHandler) {
      const mod = await import('./_vercel-app.mjs');
      cachedHandler = mod.default;
    }
    await new Promise((resolve) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      cachedHandler(req, res);
    });
  } catch (err) {
    console.error('[Vercel API Fatal]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: {
            code: 'SERVERLESS_INIT_ERROR',
            message: err instanceof Error ? err.message : String(err),
          },
        })
      );
    }
  }
}
