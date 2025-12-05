/**
 * Production server entry point
 * Used when deploying to production (e.g., via Student Portal Deployment API)
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const port = parseInt(process.env.PORT || '8000', 10);
// In production, always use production mode (use built files)
// Only use dev mode if explicitly set and NODE_ENV is not production
const dev = process.env.NODE_ENV !== 'production' && !process.env.PORT;
const app = next({ dev, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', () => {
    console.log(`> Ready on http://0.0.0.0:${port}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

