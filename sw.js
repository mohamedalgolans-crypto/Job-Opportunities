// Service Worker - نسخة آمنة (v2)
// لا يعترض طلبات Firebase Auth
// GitHub Pages Compatible

const CACHE_NAME = 'fa-app-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ✅ لا تعترض هذه الطلبات المهمة
  if (
    url.includes('firebase') ||
    url.includes('googleapis') ||
    url.includes('gstatic') ||
    url.includes('google.com') ||
    url.includes('accounts.google') ||
    url.includes('identitytoolkit') ||
    url.includes('firebaseapp.com') ||
    event.request.method !== 'GET'
  ) {
    return; // اترك المتصفح يتعامل معها مباشرة
  }

  // للطلبات العادية فقط
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
