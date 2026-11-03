// Service worker: abre rápido e funciona com sinal fraco.
// Ao mudar arquivos do site, aumente a VERSAO para os celulares baixarem a nova versão.
const VERSAO = 'km28-v8';
const BASE = [
  './',
  'index.html',
  '404.html',
  'manifest.webmanifest',
  'assets/css/app.css',
  'assets/fonts/jakarta-var.woff2',
  'assets/img/home/hero.webp',
  'assets/fonts/bebas-neue-400.woff2',
  'assets/icons/selo-96.png',
  'assets/icons/favicon-32.png',
  'assets/icons/icon-192.png',
  'assets/js/vendor/qrcode.js',
  'data/config.js',
  'data/catalogo.json',
  'js/app.js',
  'js/util.js',
  'js/catalogo.js',
  'js/carrinho.js',
  'js/checkout.js',
  'js/whatsapp.js',
  'js/pix.js',
  'js/horario.js',
  'js/render.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function comTempo(promessa, ms) {
  return new Promise((ok, erro) => {
    const t = setTimeout(() => erro(new Error('tempo')), ms);
    promessa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); erro(e); });
  });
}

// rede primeiro (com tempo-limite), cache se falhar
async function redePrimeiro(req, ms = 4000) {
  const cache = await caches.open(VERSAO);
  try {
    const r = await comTempo(fetch(req), ms);
    if (r.ok) cache.put(req, r.clone());
    return r;
  } catch {
    const c = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (c) return c;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  }
}

// cache primeiro, atualiza em segundo plano
async function cachePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  const c = await cache.match(req);
  const rede = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
  return c || (await rede) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // planilha publicada do Google
  if (url.hostname.endsWith('docs.google.com') || url.hostname.endsWith('googleusercontent.com')) {
    e.respondWith(redePrimeiro(req, 6000));
    return;
  }
  if (url.origin !== location.origin) return; // ViaCEP, WhatsApp etc.: direto na rede

  // página, código e dados: rede primeiro (atualização aparece no primeiro recarregamento)
  if (req.mode === 'navigate' || /\.(json|js|css|webmanifest)$/.test(url.pathname)) {
    e.respondWith(redePrimeiro(req));
    return;
  }
  e.respondWith(cachePrimeiro(req));
});
