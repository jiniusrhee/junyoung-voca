import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import StreakPopup from './components/StreakPopup';
import { syncContent } from './lib/content';
import { useSettings } from './lib/settings';
import { applySoundSettings } from './lib/sfx';
import StudyReminder from './components/StudyReminder';
import { useApplyTheme } from './lib/theme';
import AllLearning from './pages/AllLearning';
import ExprHome, { ExprCourses, ExprDict, ExprNotebook } from './pages/ExprHome';
import ExprQuiz from './pages/ExprQuiz';
import TalkHome, { TalkLevel, TalkRecent, TalkSaved } from './pages/TalkHome';
import TalkPlay from './pages/TalkPlay';
import GrammarDict, { GrammarLesson } from './pages/GrammarDict';
import GrammarQuiz from './pages/GrammarQuiz';
import Guide from './pages/Guide';
import LearnedList from './pages/LearnedList';
import LearnedMenu, { LearnedWords } from './pages/Learned';
import ModeNotebook, { ModeLearnedMenu } from './pages/ModeNotebook';
import GBookmarks, { GBookmarkDetail } from './pages/GBookmarks';
import ListeningQuiz from './pages/ListeningQuiz';
import Pairs, { PairQuiz } from './pages/Pairs';
import Wordbook, { WordbookDetail } from './pages/Wordbook';
import Dictionary from './pages/Dictionary';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import ModeSettings from './pages/ModeSettings';
import Settings from './pages/Settings';
import Stats from './pages/Stats';
import Streak from './pages/Streak';
import Welcome from './pages/Welcome';
import Measure from './pages/Measure';
import WordDetail from './pages/WordDetail';
import Words from './pages/Words';
import WrongNotes from './pages/WrongNotes';

const TABS = ['/', '/stats', '/all'];

function ExprDictRoute() {
  const { key } = useParams();
  return <ExprDict keyParam={key} />;
}

function Shell() {
  const settings = useSettings();
  const loc = useLocation();
  useApplyTheme(settings?.theme);
  useEffect(() => {
    if (settings) applySoundSettings(settings);
  }, [settings]);
  if (!settings) return <div className="screen center muted">불러오는 중…</div>;
  const needsOnboarding = settings.level == null;
  const showNav = TABS.includes(loc.pathname) && !(loc.pathname === '/' && needsOnboarding);
  return (
    <div className={`app ${showNav ? 'with-nav' : ''}`}>
      <StudyReminder />
      <Routes>
        <Route path="/" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/test" element={<Quiz mode="test" />} />
        <Route path="/measure" element={<Measure />} />
        <Route path="/quiz" element={needsOnboarding ? <Navigate to="/welcome" replace /> : <Quiz mode="study" />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/streak" element={<Streak />} />
        <Route path="/all" element={<AllLearning />} />
        <Route path="/grammar" element={<GrammarQuiz />} />
        <Route path="/listening" element={<ListeningQuiz />} />
        <Route path="/grammar-dict" element={<GrammarDict />} />
        <Route path="/grammar-dict/:id" element={<GrammarLesson />} />
        <Route path="/expr" element={<ExprHome />} />
        <Route path="/expr/courses" element={<ExprCourses />} />
        <Route path="/expr/notebook" element={<ExprNotebook />} />
        <Route path="/expr/quiz" element={<ExprQuiz />} />
        <Route path="/expr-dict" element={<ExprDictRoute />} />
        <Route path="/expr-dict/:key" element={<ExprDictRoute />} />
        <Route path="/talk" element={<TalkHome />} />
        <Route path="/talk/level" element={<TalkLevel />} />
        <Route path="/talk/recent" element={<TalkRecent />} />
        <Route path="/talk/saved" element={<TalkSaved />} />
        <Route path="/talk/:story/:ep" element={<TalkPlay />} />
        <Route path="/pairs" element={<Pairs />} />
        <Route path="/pairs/:stage/:mode" element={<PairQuiz />} />
        <Route path="/learned/grammar" element={<ModeLearnedMenu />} />
        <Route path="/learned/:mode/:kind" element={<ModeNotebook />} />
        <Route path="/learned/:mode" element={<LearnedList kind="learned" />} />
        <Route path="/bookmarks/grammar" element={<GBookmarks />} />
        <Route path="/bookmarks/grammar/:id" element={<GBookmarkDetail />} />
        <Route path="/bookmarks/:mode" element={<LearnedList kind="bookmarks" />} />
        <Route path="/wordbook" element={<Wordbook />} />
        <Route path="/wordbook/:id" element={<WordbookDetail />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/dict" element={<Dictionary />} />
        <Route path="/words" element={<LearnedMenu />} />
        <Route path="/words/all" element={<Words />} />
        <Route path="/learned-words/:kind" element={<LearnedWords />} />
        <Route path="/words/:id" element={<WordDetail />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/wrongs" element={<WrongNotes />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/mode/:mode" element={<ModeSettings />} />
        <Route path="/settings/:section" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
      {!needsOnboarding && <StreakPopup />}
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
