import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/quiz.css';
import './styles/home.css';
import './styles/all.css';
import './styles/stats.css';
import './styles/settings.css';
import { installNativeBack } from './lib/nativeBack';

// 안드로이드 앱: 상태바를 WebView 위에 겹치지 않게, 어두운 배경
import('@capacitor/core').then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  void import('@capacitor/status-bar').then(({ StatusBar }) => {
    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setBackgroundColor({ color: '#17181c' });
  });
});

void installNativeBack();

createRoot(document.getElementById('root')!).render(<App />);
