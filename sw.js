/* global self, caches */
var CACHE = 'weather-v1';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon.svg',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var local = ASSETS.filter(function (u) { return u.indexOf('http') !== 0; });
      return cache.addAll(
        local.map(function (u) {
          return new Request(u, { cache: 'reload' });
        })
      ).then(function () {
        return fetch(ASSETS[ASSETS.length - 1], { cache: 'reload' }).then(function (res) {
          if (res.ok) return cache.put(ASSETS[ASSETS.length - 1], res);
        });
      }).catch(function () {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        });
      })
    );
    return;
  }
  event.respondWith(fetch(req));
});
