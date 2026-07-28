
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Đăng ký Service Worker — KHÔNG auto-reload khi có bản mới.
// Thay vào đó, update SW silently, áp dụng ở lần mở tiếp theo.
void registerSW({
  onNeedRefresh() {
    // New version available — chỉ log, KHÔNG reload tự động.
    // SW mới sẽ được dùng ở lần truy cập tiếp theo.
    console.log('[PWA] New version available. Will activate on next visit.');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.');
  },
  // Tự động check update mỗi 60 phút (thay vì mặc định 1 giờ reload ngay)
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // 60 minutes
    }
  }
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);