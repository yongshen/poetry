/**
 * 诗泉 · 背诗 —— 本地静态服务 + API 反向代理
 *
 * 用法：node server.mjs
 * 打开：http://localhost:5173
 *
 * 作用：把 /api/** 与 /health 转发到 https://poetry.palemoky.com，
 *      前端同源请求，彻底规避浏览器跨域限制。
 */
import http from 'node:http';
import https from 'node:https';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const UPSTREAM = 'poetry.palemoky.com';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function staticHandler(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  // 防目录穿越
  const filePath = path.normalize(path.join(__dirname, rel));
  if (!filePath.startsWith(__dirname)) return Promise.resolve(null);
  return fs.readFile(filePath).then((buf) => {
    const ext = path.extname(filePath).toLowerCase();
    return { code: 200, type: MIME[ext] || 'application/octet-stream', body: buf };
  }).catch(() => null);
}

function proxyHandler(reqUrl, method, headers) {
  return new Promise((resolve) => {
    const target = new URL(reqUrl, `https://${UPSTREAM}`);
    const req = https.request({
      host: UPSTREAM,
      path: target.pathname + target.search,
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': headers['user-agent'] || 'shiquan-app'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          code: res.statusCode,
          type: (res.headers['content-type'] || 'application/json') + '; charset=utf-8',
          body
        });
      });
    });
    req.on('error', () => {
      resolve({ code: 502, type: 'application/json; charset=utf-8', body: Buffer.from(JSON.stringify({ ok: false, error: 'upstream unreachable' })) });
    });
    req.setTimeout(20000, () => {
      req.destroy();
      resolve({ code: 504, type: 'application/json; charset=utf-8', body: Buffer.from(JSON.stringify({ ok: false, error: 'upstream timeout' })) });
    });
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url || '/';
  try {
    let result;
    if (urlPath.startsWith('/api/') || urlPath === '/health' || urlPath.startsWith('/health?')) {
      result = await proxyHandler(urlPath, req.method, req.headers);
    } else {
      result = await staticHandler(urlPath);
      if (!result) {
        result = { code: 404, type: 'text/plain; charset=utf-8', body: Buffer.from('404 Not Found') };
      }
    }
    res.writeHead(result.code, {
      'Content-Type': result.type,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': urlPath.startsWith('/api') ? 'no-store' : 'no-cache'
    });
    res.end(result.body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  诗泉 · 背诗  本地服务已启动');
  console.log('  打开浏览器访问： http://localhost:' + PORT);
  console.log('  API 代理目标：   https://' + UPSTREAM);
  console.log('');
});
