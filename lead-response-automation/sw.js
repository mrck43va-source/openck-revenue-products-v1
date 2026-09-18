const CACHE='lra-demo-v2';
const PREFIX='lra-demo-';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./workflow-engine.mjs','./sandbox.settings.json','./privacy.html','./terms.html','./support.html','./manifest.webmanifest','./icon-180.png','./pwa-register.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
