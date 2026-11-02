import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon' };

// 守卫的比较基准：dist 的绝对路径（cwd 相对解析一次，后续请求都用它）
const DIST = resolve('dist');

createServer((req, res) => {
  // 非法百分号转义（/%zz、路径里裸一个 %）会让 decodeURIComponent 抛 URIError。
  // 不接住的话异常从 Server.emit → parserOnIncoming 冒到顶层，dev server 直接退出，
  // 所以这里必须自己回 400，而不是让请求无响应并把进程带走。
  let url;
  try {
    url = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<h1>400</h1>');
  }
  // 目录穿越守卫：把候选解析成绝对路径，再要求它等于 dist 或落在 dist + path.sep 之下。
  // 旧的 `startsWith(normalize('dist'))` 是纯字符串前缀比较：/../distevil/x 归一化后
  // 得到 distevil\x，照样「以 dist 开头」，同级目录里任意文件都会被放行。
  // 用 '.' + url 而不是直接 resolve(DIST, url)，因为 url 以 / 开头时
  // resolve 会把它当根路径丢弃 dist 基准。
  let file = resolve(DIST, '.' + (url === '/' ? '/index.html' : url));
  if (file !== DIST && !file.startsWith(DIST + sep)) { res.writeHead(403); return res.end('forbidden'); }
  if (extname(file) === '') file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
  res.writeHead(200, { 'content-type': (TYPES[extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
  res.end(readFileSync(file));
}).listen(4173, () => console.log('http://localhost:4173'));
