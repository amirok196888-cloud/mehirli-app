const CACHE='mehirli-v117';
const ASSETS=['./','./index.html','./landing.css?v=74','./mechirli-hero-profit-v68.webp','./mehirli-hero-v43.jpg','./mehirli-explainer-poster-v62.jpg','./app.html','./reset-password.html','./style.css?v=113','./traffic.js?v=113','./app.js?v=117','./finance.js?v=117','./finance-core.js?v=117','./finance.css?v=117','./sample-quote.html','./quote.html','./quote-preview-v61.jpg','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-192.png','./share-preview-v20.jpg','./share.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  // Never persist authenticated API responses, signed documents or OCR data in Cache Storage.
  if(new URL(e.request.url).origin!==self.location.origin)return;
  if(e.request.destination==='video') return;
  if(e.request.mode==='navigate'){
    const url=new URL(e.request.url);
    const fallback=url.pathname.endsWith('/app.html')?'./app.html':url.pathname.endsWith('/quote.html')?'./quote.html':'./index.html';
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(fallback,copy));return r;}).catch(()=>caches.match(fallback)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request)));
});
