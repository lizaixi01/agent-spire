import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// A loopback-only static server; the player package has no npm dependencies.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const port = Number(process.argv[2] ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Port must be an integer between 1 and 65535.');
}
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') { response.end(); return; }
    const stream = createReadStream(file);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end();
  }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Agent Spire: http://127.0.0.1:${port}/ (Ctrl+C to stop)`);
});
