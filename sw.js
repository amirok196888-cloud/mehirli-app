const CACHE='mehirli-v159-trial-60d-20261007';
const ASSETS=['./','./index.html','./landing.css?v=130','./mechirli-hero-profit-v68.webp','./mehirli-hero-v43.jpg','./mehirli-explainer-poster-v62.jpg','./app-design.css?v=156','./app.html','./reset-password.html','./style.css?v=132','./traffic.js?v=151','./job-suggestions.js?v=148','./app.js?v=160','./home-dashboard.js?v=139','./finance.js?v=140','./finance-core.js?v=140','./finance.css?v=119','./sample-quote.html','./quote.html','./quote-preview-v61.jpg','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./share-preview-v20.jpg','./share.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
const STATIC_URLS=new Set(ASSETS.map(asset=>new URL(asset,self.registration.scope).href));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  // Only the explicit, public app shell is eligible for Cache Storage.
  if(!STATIC_URLS.has(e.request.url))return;
  if(e.request.mode==='navigate'){
    const url=new URL(e.request.url);
    const fallback=url.pathname.endsWith('/app.html')?'./app.html':url.pathname.endsWith('/quote.html')?'./quote.html':'./index.html';
    e.respondWith(fetch(e.request).catch(()=>caches.match(fallback)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type==='basic'){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request)));
});
