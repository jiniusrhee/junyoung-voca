import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { syncContent } from './lib/content';
import { useSettings } from './lib/settings';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import Welcome from './pages/Welcome';
import WordDetail from './pages/WordDetail';
import Words from './pages/Words';

function Shell() {
  const settings = useSettings();
  const loc = useLocation();
  if (!settings) return <div className="screen center muted">불러오는 중…</div>;
  const needsOnboarding = settings.level == null;
  const fullScreen = ['/quiz', '/test', '/welcome'].some((p) => loc.pathname.startsWith(p));
  return (
    <div className={`app ${fullScreen ? 'no-nav' : ''}`}>
      <Routes>
        <Route path="/" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/test" element={<Quiz mode="test" />} />
        <Route path="/quiz" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Quiz mode="study" />} />
        <Route path="/words" element={<Words />} />
        <Route path="/words/:id" element={<WordDetail />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!fullScreen && <BottomNav />}
    </div>
  );
}

export default function App() {
  useEffect(() => {
    syncContent().catch((e) => console.warn('단어 데이터 동기화 실패', e));
  }, []);
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
