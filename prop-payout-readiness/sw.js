const CACHE='prop-payout-readiness-v2';
const PREFIX='prop-payout-readiness-';
const ASSETS=['./','./index.html','./app.js','./pwa-register.js','./manifest.webmanifest','./icon-180.png','../styles.css'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
