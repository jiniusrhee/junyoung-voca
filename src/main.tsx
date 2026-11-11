import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './styles/quiz.css';
import './styles/home.css';
import './styles/all.css';
import './styles/stats.css';
import './styles/settings.css';
import './styles/update.css';
import './styles/lists.css';
import './styles/pages.css';
import { installNativeBack } from './lib/nativeBack';
import { reassertBars, setStatusBar } from './lib/statusBar';

// 안드로이드 앱: 상태바를 WebView 위에 겹치지 않게, 어두운 배경
import('@capacitor/core').then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  void import('@capacitor/status-bar').then(({ StatusBar }) => {
    void StatusBar.setOverlaysWebView({ overlay: false });
    setStatusBar('#121212', true);
  });
  // 스플래시가 걷히며 막대 색이 테마 값으로 되돌아가므로 켠 직후 몇 번, 그리고 앱으로 돌아올 때마다 다시 칠한다
  for (const ms of [300, 900, 2000, 4000]) window.setTimeout(reassertBars, ms);
  void import('@capacitor/app').then(({ App }) => void App.addListener('resume', reassertBars));
});

void installNativeBack();

createRoot(document.getElementById('root')!).render(<App />);
