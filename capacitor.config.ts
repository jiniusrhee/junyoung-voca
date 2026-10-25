import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.junyoung.voca',
  appName: '준영보카',
  webDir: 'dist',
  android: {
    // 앱 내 WebView 가 https://localhost 로 서빙 → 서비스 워커·IndexedDB 그대로 동작
    allowMixedContent: false,
    backgroundColor: '#17181c',
  },
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#17181c', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#17181c' },
  },
};

export default config;
