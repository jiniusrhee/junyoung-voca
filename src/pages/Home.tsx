import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import ProgressRing from '../components/ProgressRing';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { computeStreak, countAvailableNew, countDue, countKnownWords } from '../lib/stats';
import { studyDateOf } from '../lib/time';

export default function Home() {
  const nav = useNavigate();
  const settings = useSettings();
  const today = studyDateOf();
  const daily = useLiveQuery(() => db.daily.get(today), [today]);
  const due = useLiveQuery(() => countDue(), []);
  const fresh = useLiveQuery(() => countAvailableNew(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const known = useLiveQuery(() => countKnownWords(), []);
  const wordCount = useLiveQuery(() => db.words.count(), []);
  if (!settings) return null;

  const total = daily?.total ?? 0;
  const goal = settings.dailyGoal;
  const met = total >= goal;

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>준영보카</h1>
        <Link to="/settings" className="badge">
          Lv.{settings.level}
        </Link>
      </header>

      <section className="card hero">
        <ProgressRing value={Math.min(1, total / goal)} size={140} label={`${total}`} sub={`/ ${goal}`} />
        <div className="hero-text">
          {met ? (
            <p className="trophy">🏆 오늘 목표 달성!</p>
          ) : (
            <p>
              오늘 <strong>{goal - total}</strong>문제 더 풀면 목표 달성
            </p>
          )}
          <p className="muted small">
            🔥 연속 {streak ?? 0}일 · 아는 단어 {known ?? 0}개
          </p>
        </div>
      </section>

      <button className="btn primary big" onClick={() => nav('/quiz')}>
        오늘의 학습
      </button>
      <p className="muted small center-text">
        복습 대기 {due ?? 0}개 · 새 단어 {fresh ?? 0}개 남음 · 전체 {wordCount ?? 0}단어
      </p>
    </div>
  );
}
