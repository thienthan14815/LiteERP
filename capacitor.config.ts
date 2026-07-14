import type { CapacitorConfig } from '@capacitor/cli';

// Kiến trúc standalone: NestJS chạy NGAY trên máy (embedded Node) và phục vụ
// cả frontend static-export lẫn API tại 127.0.0.1:<PORT>. WebView vì vậy trỏ
// về loopback on-device — KHÔNG phải một URL từ xa.
//
//   - PROD (mặc định): http://127.0.0.1:3001 — server on-device.
//   - DEV: máy thật LAN hoặc emulator host (10.0.2.2) khi debug với PC.
// Override qua env khi build:
//   LITEERP_WEB_URL   — URL WebView sẽ load (mặc định loopback on-device).
//   LITEERP_DEV_URL   — URL khi LITEERP_USE_DEV=1.
//   LITEERP_USE_DEV=1 — dùng DEV_URL + bật webview debugging.
const ON_DEVICE_URL = 'http://127.0.0.1:3001';
const PROD_URL = process.env.LITEERP_WEB_URL || ON_DEVICE_URL;
const DEV_URL = process.env.LITEERP_DEV_URL || 'http://10.0.2.2:3000';
const useDev = process.env.LITEERP_USE_DEV === '1';

const serverUrl = useDev ? DEV_URL : PROD_URL;
// Loopback/LAN chạy HTTP thuần (không TLS) nên cần cleartext.
const needsCleartext = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'com.liteerp.app',
  appName: 'LiteERP',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: needsCleartext,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: needsCleartext,
    captureInput: true,
    webContentsDebuggingEnabled: useDev,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
