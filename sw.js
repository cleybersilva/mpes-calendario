/* Service worker: tudo do site em rede primeiro (versões novas aparecem na hora); cache só para uso offline */
const VERSION = 'mpes-v20';
const SHELL = ['./', 'index.html', 'css/styles.css?v=19', 'js/ics.js?v=7', 'js/app.js?v=15', 'manifest.webmanifest',
  'assets/logo-cesar.png', 'assets/icon-192.png', 'assets/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // fontes do Google: cache em segundo plano
    if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
      e.respondWith(caches.open(VERSION).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }));
    }
    return;
  }
  if (url.pathname.endsWith('/data.json')) {
    // rede primeiro: dados sempre atualizados; cache só quando offline
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return r;
    }).catch(() => caches.match(url.pathname)));
    return;
  }
  // página, CSS e JS: REDE PRIMEIRO (cada publicação aparece no próximo carregamento);
  // o cache só é usado sem internet ou se a rede demorar mais de 4 s
  const isPage = req.mode === 'navigate';
  const net = fetch(isPage ? new Request(url.href, { cache:'no-cache', credentials:'same-origin' }) : req, isPage ? undefined : { cache:'no-cache' })
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(isPage ? 'index.html' : req, copy)); } return r; });
  const fallback = () => caches.match(isPage ? 'index.html' : req).then(hit => hit || (isPage ? caches.match('./') : undefined));
  e.respondWith(Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('lento')), 4000))])
    .catch(() => fallback().then(hit => hit || net)));
});
