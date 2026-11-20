/* ============================================================================
   عامل خدمة مستقل لمشروع «جليس | مجلس الأعضاء» المساند
   - نطاقه محصور في مجلد المشروع (/jalees-members/) فقط.
   - عند انقطاع الشبكة يعود إلى صفحة المجلس نفسه، ولا يعرض الموقع الأساسي أبداً.
   ============================================================================ */
'use strict';

const CACHE = 'jalees-members-v13';
const CORE = [
  './index.html',
  './member.html',
  './design.css?v=14',
  './script.js?v=14',
  './data/members.js?v=14',
  './manifest.json?v=14',
  './assets/logo-icon.png',
  './assets/logo-light.png',
  './assets/logo.png',
];

// نطاق هذا المشروع فقط
const SCOPE = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(
        CORE.map((url) => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.indexOf('jalees-members') === 0 && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // بيانات المحتوى يجب أن تبقى طازجة دائماً (تُحدَّث من الشيت)
  if (url.pathname.indexOf(SCOPE + 'data/content/') === 0) return;

  // لا نتدخّل في أي طلب خارج نطاق المشروع المساند
  if (!url.pathname.startsWith(SCOPE)) return;

  // طلبات التنقّل: الشبكة أولاً، ثم الكاش، ثم صفحة المجلس (وليس الموقع الأساسي)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const home = await caches.match('./index.html');
          if (home) return home;
          return new Response(
            '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
            '<body style="font-family:sans-serif;text-align:center;padding:48px;background:#F8F5EE;color:#1E3A2B">' +
            '<h2>مجلس جليس غير متاح دون اتصال</h2>' +
            '<p>يرجى الاتصال بالإنترنت ثم إعادة المحاولة.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // بقية الأصول: الكاش أولاً ثم الشبكة
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() => cached);
    })
  );
});
