import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import { syncContent } from './lib/content';
import { useSettings } from './lib/settings';
import Dictionary from './pages/Dictionary';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import Welcome from './pages/Welcome';
import WordDetail from './pages/WordDetail';
import Words from './pages/Words';
import WrongNotes from './pages/WrongNotes';

const TABS = ['/', '/stats', '/dict', '/settings'];

function Shell() {
  const settings = useSettings();
  const loc = useLocation();
  if (!settings) return <div className="screen center muted">불러오는 중…</div>;
  const needsOnboarding = settings.level == null;
  const showNav = TABS.includes(loc.pathname) && !(loc.pathname === '/' && needsOnboarding);
  return (
    <div className={`app ${showNav ? 'with-nav' : ''}`}>
      <Routes>
        <Route path="/" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/test" element={<Quiz mode="test" />} />
        <Route path="/quiz" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Quiz mode="study" />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/dict" element={<Dictionary />} />
        <Route path="/words" element={<Words />} />
        <Route path="/words/:id" element={<WordDetail />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/wrongs" element={<WrongNotes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
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
