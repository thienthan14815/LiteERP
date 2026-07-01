import type { CapacitorConfig } from '@capacitor/cli';

// Web LiteERP (Next.js 14 + NestJS API) cần SSR + rewrites — KHÔNG static export được.
// Vì vậy APK chạy ở chế độ WebView trỏ tới URL production.
// Thay 'https://YOUR_PRODUCTION_URL' bằng domain thật trước khi build release.

const PROD_URL = process.env.LITEERP_WEB_URL || 'https://github.com/bentlygentou/LiteERP.git';
const DEV_URL = process.env.LITEERP_DEV_URL || 'http://10.0.2.2:3000';
const useDev = process.env.LITEERP_USE_DEV === '1';

const serverUrl = useDev ? DEV_URL : PROD_URL;
// Tự động bật cleartext khi server URL là HTTP (vd LAN nội bộ chưa có TLS).
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
