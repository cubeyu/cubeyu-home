import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // 目录穿越守卫：resolve 后必须仍在 dist/ 内
  let file = normalize(join('dist', url === '/' ? '/index.html' : url));
  if (!file.startsWith(normalize('dist'))) { res.writeHead(403); return res.end('forbidden'); }
  if (extname(file) === '') file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
  res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
  res.end(readFileSync(file));
}).listen(4173, () => console.log('http://localhost:4173'));
