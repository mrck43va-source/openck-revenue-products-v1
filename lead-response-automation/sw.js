const CACHE='lra-demo-v1';
const ASSETS=['./','./index.html','./styles.css','./app.mjs','./workflow-engine.mjs','./sandbox.settings.json','./privacy.html','./terms.html','./support.html','./manifest.webmanifest','./icon-180.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
