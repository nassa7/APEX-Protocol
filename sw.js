'use strict';

var CACHE_NAME = 'apex-v5-cache-v1';
var ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/js/errors.js',
  '/js/config.js',
  '/js/utils.js',
  '/js/state.js',
  '/js/auth.js',
  '/js/ui.js',
  '/js/training.js',
  '/js/dashboard.js',
  '/js/export.js',
  '/js/ai.js',
  '/js/charts.js',
  '/js/gamification.js',
  '/js/init.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache successful responses for same-origin or CDN assets
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        // Offline fallback — return cached index.html for navigation requests
        if (e.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
