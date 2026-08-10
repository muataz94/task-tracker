import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve('frontend');
const port = 4174;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  let filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (statSync(filePath).isDirectory()) filePath = resolve(filePath, 'index.html');
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Task Tracker test server listening on ${port}`);
});
