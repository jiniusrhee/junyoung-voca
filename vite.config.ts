import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import pkg from './package.json';

/** 네이티브(APK) 빌드는 루트에서 서빙되므로 base 가 '/' (CAP_BUILD=1 npm run build) */
const BASE = process.env.CAP_BUILD ? '/' : '/junyoung-voca/';

export default defineConfig({
  base: BASE,
  // 버전 코드 = major*10000 + minor*100 + patch (android/app/build.gradle, scripts/release-apk.sh 와 같은 공식). 앱 자동 업데이트가 릴리스의 versionCode 와 비교한다
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_VERSION_CODE__: JSON.stringify(pkg.version.split('.').map(Number).reduce((acc: number, n: number, i: number) => acc + n * [10000, 100, 1][i], 0)) },
  plugins: [
    react(),
    VitePWA({
      // 앱(APK)은 자산을 내장하므로 서비스 워커가 필요 없다
      disable: !!process.env.CAP_BUILD,
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: '준영보카',
        short_name: '준영보카',
        description: '나만의 영어 단어 학습 앱',
        lang: 'ko',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f5f9',
        theme_color: '#7c5cf5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'voca-data',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // 화면을 통째로 띄우는 테스트는 GitHub 의 느린 러너에서 기본 5초를 넘겨 가끔 실패했다 (2026-11-13 배포 실패 메일)
    testTimeout: 60_000,
  },
});
