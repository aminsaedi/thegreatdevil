---
layout: null
---
/* Service Worker — efficient cache lifetimes for static assets */

var CACHE_VERSION = 'tgd-v2';
var STATIC_CACHE  = CACHE_VERSION + '-static';
var IMAGE_CACHE   = CACHE_VERSION + '-images';

/* Static assets to pre-cache on install */
var PRECACHE_ASSETS = [
  '/assets/style.css',
  '/assets/fonts/Vazirmatn-arabic.woff2',
  '/assets/fonts/Vazirmatn-latin-ext.woff2',
  '/assets/fonts/Vazirmatn-latin.woff2',
  '/assets/favicon.svg'
];

/* Install: pre-cache known static assets */
self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function () {
        /* Pre-cache may fail in restricted environments; SW still installs */
      });
    })
  );
});

/* Activate: remove caches from old versions */
self.addEventListener('activate', function (event) {
  var currentCaches = [STATIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (name) { return currentCaches.indexOf(name) === -1; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Fetch: cache-first for static assets, network-first for pages */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* Only intercept same-origin GET requests */
  if (url.origin !== location.origin || req.method !== 'GET') return;

  /* Cache-first strategy for immutable static assets (CSS, fonts, images, icons) */
  if (/\.(css|woff2?|ttf|eot|svg|png|jpg|jpeg|webp|gif|ico)(\?|$)/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (response) {
          if (response && response.status === 200) {
            var isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(url.pathname);
            var cacheName = isImage ? IMAGE_CACHE : STATIC_CACHE;
            var clone = response.clone();
            caches.open(cacheName).then(function (cache) {
              cache.put(req, clone);
            });
          }
          return response;
        }).catch(function () {
          /* Network unavailable — resource will be missing this load */
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
      })
    );
    return;
  }

  /* Network-first for HTML navigation — fall back to cache if offline */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || fetch(req);
        });
      })
    );
  }
});
