/* 诗泉 · 背诗 —— Service Worker
 * 策略：
 *  - 应用外壳（html/css/js/图标）网络优先，失败时回退缓存，成功后更新缓存
 *  - /api/** 与 /health 一律不拦截（交服务器代理或直连）
 */
const CACHE = 'shiquan-v1';
const SHELL = [
  './',
  './index.html',
  './assets/style.css',
  './assets/api.js',
  './assets/store.js',
  './assets/practice.js',
  './assets/app.js',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 不拦截 API（走服务器代理或直连），避免缓存脏数据
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return;

  // 跨域资源（如 CORS 代理）不缓存
  if (url.origin !== location.origin) return;

  // 页面导航：网络优先，离线回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静态资源：网络优先，回退缓存，成功后更新缓存
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
