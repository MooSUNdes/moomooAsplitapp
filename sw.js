// 分帳小幫手 Service Worker
// 提供:離線可開、快取加速、版本更新偵測

const CACHE_NAME = 'splitapp-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './icon.png'
];

// 安裝:預先快取核心檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

// 啟用:清掉舊版本快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 攔截:HTML 走 network-first(總是抓最新),靜態檔走 cache-first(快)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理同源請求,Firebase/Tailwind CDN 等不快取
  if (url.origin !== location.origin) return;

  // HTML 導覽:優先抓網路,失敗才用快取(離線)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./', clone)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match('./', { ignoreSearch: true })
            .then(r => r || caches.match('./index.html', { ignoreSearch: true }))
        )
    );
    return;
  }

  // 靜態檔案:優先用快取,沒有才抓網路
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
      }
      return res;
    }))
  );
});

// 監聽主畫面的「跳過等待」訊息(更新按鈕觸發)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
