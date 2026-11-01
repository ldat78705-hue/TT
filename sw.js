const CACHE_NAME = 'educenter-pro-cache-v2';
// Cần liệt kê các tệp cốt lõi để ứng dụng có thể khởi động
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/logo.svg',
  '/manifest.json',
  // Các assets được build bởi Vite thường nằm trong thư mục /assets
  // Service worker sẽ tự động cache chúng trong sự kiện 'fetch' ở lần truy cập đầu tiên.
];

// Sự kiện install: cache các tệp App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Đang cache App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
      .catch(error => {
        console.error('Lỗi khi cache app shell:', error);
      })
  );
});

// Sự kiện activate: dọn dẹp các cache cũ
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Xóa cache cũ', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Sự kiện fetch: chiến lược Network-first, sau đó mới đến cache
self.addEventListener('fetch', (event) => {
  // Bỏ qua các request không phải GET hoặc của extension
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        // 1. Cố gắng lấy từ mạng trước
        const networkResponse = await fetch(event.request);

        // Nếu thành công, lưu vào cache và trả về
        if (networkResponse.ok) {
          await cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // 2. Mạng bị lỗi, thử lấy từ cache
        console.log('Service Worker: Lỗi mạng, thử lấy từ cache.', event.request.url);
        const cachedResponse = await cache.match(event.request);

        if (cachedResponse) {
          return cachedResponse;
        }

        // 3. Nếu là yêu cầu điều hướng (navigate) và không có trong cache,
        // trả về index.html làm fallback để React Router xử lý
        if (event.request.mode === 'navigate') {
          console.log('Service Worker: Fallback về /index.html cho điều hướng.');
          const indexFallback = await cache.match('/index.html');
          if (indexFallback) {
            return indexFallback;
          }
        }
        
        console.error('Service Worker: Fetch lỗi, không có trong cache.', error);
        return new Response("Lỗi mạng: Không thể tải tài nguyên.", {
          status: 408,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })()
  );
});