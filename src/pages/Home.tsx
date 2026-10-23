import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoalModal from '../components/GoalModal';
import Icon, { type IconName } from '../components/Icon';
import Mascot from '../components/Mascot';
import ProgressRing from '../components/ProgressRing';
import { db } from '../db';
import { saveSettings, useSettings } from '../lib/settings';
import { comprehension, computeStreak, countDue, estimateVocab, goalMet, reviewAccuracy, studied } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatDuration, shiftDate, studyDateOf, weekOf } from '../lib/time';
import type { DailyRow } from '../types';

export default function Home() {
  const nav = useNavigate();
  const settings = useSettings();
  const today = studyDateOf();
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const acc = useLiveQuery(() => reviewAccuracy(), []);
  const comp = useLiveQuery(() => comprehension(), []);
  const counts = useLiveQuery(
    async () => ({
      fav: await db.favorites.count(),
      learned: await db.cards.count(),
      wrongs: await db.reviews.filter((r) => (r.wrongs?.length ?? 0) > 0).count(),
      words: await db.words.count(),
      due: await countDue(),
    }),
    [],
  );
  const [goalOpen, setGoalOpen] = useState(false);
  if (!settings) return null;

  const byDate = new Map((daily ?? []).map((d) => [d.date, d]));
  const t = byDate.get(today);
  const total = t?.total ?? 0;
  const goal = settings.dailyGoal;
  const pct = Math.round((total / goal) * 100);
  const met = total >= goal;
  const trophies = (daily ?? []).filter((d) => goalMet(d, goal)).length;
  const last7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6));
  const maxBar = Math.max(5, ...last7.map((d) => byDate.get(d)?.total ?? 0));

  return (
    <div className="screen home">
      <header className="home-head">
        <h1>준영보카</h1>
        <div className="head-stats">
          <span className="head-stat">
            <Icon name="trophy" size={20} className="ic-gold" /> {trophies}
          </span>
          <span className="head-stat">
            <Icon name="star" size={20} className="ic-blue" /> {(daily ?? []).filter(studied).length}
          </span>
        </div>
      </header>

      <Link to="/stats" className="streak-card">
        <div className="streak-top">
          <span className="flame-badge">
            <Icon name="flame" size={20} />
          </span>
          <span className="streak-text">
            연속 학습 <b>{streak ?? 0}</b>일
          </span>
          <Icon name="chevron" size={18} className="muted-ic" />
        </div>
        <div className="week-row">
          {weekOf(today).map((d) => (
            <DayDot key={d} date={d} today={today} row={byDate.get(d)} goal={goal} />
          ))}
        </div>
      </Link>

      <section className="main-card">
        {met && (
          <span className="ribbon">
            <Icon name="trophy" size={18} />
          </span>
        )}
        <div className="main-card-body">
          <div className="main-mascot">
            <Mascot size={118} mood={met ? 'cheer' : 'happy'} />
          </div>
          <div className="main-info">
            <ProgressRing value={total / goal} label={String(pct)} />
            <h2>어휘 학습</h2>
            <button className="goal-select" onClick={() => setGoalOpen(true)}>
              하루 목표: <b>{goal}개</b> <Icon name="caret" size={14} />
            </button>
          </div>
        </div>
        <button className="today-btn" onClick={() => nav('/quiz')}>
          <Icon name={met ? 'star' : 'book'} size={22} />
          {met ? '추가 학습' : '오늘의 어휘'}
        </button>
        <p className="main-sub">
          복습 대기 {counts?.due ?? 0}개 · 레벨 {settings.level ?? '-'}
        </p>
      </section>

      <section className="info-card">
        <div className="info-card-head">
          <h3>학습 정보</h3>
          <Link to="/stats" className="more">
            <Icon name="chevron" size={16} />
          </Link>
        </div>
        <div className="info-grid">
          <ul className="legend">
            <li>
              <i className="dot new" /> 새로 배운 단어: {Math.max(0, (t?.newWords ?? 0) - (t?.knownNew ?? 0))}
            </li>
            <li>
              <i className="dot known" /> 이미 아는 단어: {t?.knownNew ?? 0}
            </li>
            <li>
              <i className="dot review" /> 복습 단어: {t?.reviews ?? 0}
            </li>
            <li className="time">⏱ {formatDuration(t?.timeMs ?? 0)}</li>
          </ul>
          <div className="mini-bars" aria-label="최근 7일 학습량">
            {last7.map((d) => {
              const r = byDate.get(d);
              const n = Math.max(0, (r?.newWords ?? 0) - (r?.knownNew ?? 0));
              const k = r?.knownNew ?? 0;
              const v = r?.reviews ?? 0;
              const h = (x: number) => `${(x / maxBar) * 100}%`;
              return (
                <div key={d} className={`mini-bar ${d === today ? 'today' : ''}`}>
                  <span className="seg review" style={{ height: h(v) }} />
                  <span className="seg known" style={{ height: h(k) }} />
                  <span className="seg new" style={{ height: h(n) }} />
                </div>
              );
            })}
          </div>
          <div className="acc-box">
            <span className="acc-label">
              <i className="dot review" /> 복습 정답률
            </span>
            <span className="acc-value">{acc == null ? '-' : Math.round(acc * 100)}%</span>
          </div>
        </div>
      </section>

      <Link to="/stats" className="vocab-row">
        <span className="vocab-label">나의 어휘력</span>
        <span className="vocab-value">
          약 <b>{estimateVocab(settings.level ?? 10, comp ?? null).toLocaleString()}</b>개
        </span>
        <Icon name="chevron" size={16} className="muted-ic" />
      </Link>

      <section className="list-card">
        <ListRow to="/favorites" icon="heart" label="내가 좋아하는 문장" count={counts?.fav} tint="pink" />
        <ListRow to="/wrongs" icon="note" label="내 오답노트" count={counts?.wrongs} tint="red" />
        <ListRow to="/words" icon="book" label="내가 학습한 어휘" count={counts?.learned} tint="purple" />
        <ListRow to="/dict" icon="search" label="단어 사전" count={counts?.words} tint="blue" />
      </section>

      {goalOpen && (
        <GoalModal
          current={goal}
          onClose={() => setGoalOpen(false)}
          onSave={(n) => {
            void saveSettings({ dailyGoal: n });
            setGoalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DayDot({ date, today, row, goal }: { date: string; today: string; row: DailyRow | undefined; goal: number }) {
  const label = WEEKDAYS_KO[dayOfWeek(date)];
  const future = date > today;
  const isGoal = goalMet(row, goal);
  const isStudied = studied(row);
  return (
    <span className={`day-dot ${date === today ? 'today' : ''} ${future ? 'future' : ''}`}>
      {isGoal ? (
        <span className="stamp gold">
          <Icon name="trophy" size={14} />
        </span>
      ) : isStudied ? (
        <span className="stamp star">
          <Icon name="star" size={14} />
        </span>
      ) : (
        <span className="stamp">{label}</span>
      )}
    </span>
  );
}

function ListRow({ to, icon, label, count, tint }: { to: string; icon: IconName; label: string; count?: number; tint: string }) {
  return (
    <Link to={to} className="list-row">
      <span className={`list-icon ${tint}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="list-label">{label}</span>
      {count != null && <span className="count-pill">{count}</span>}
      <Icon name="chevron" size={16} className="muted-ic" />
    </Link>
  );
}
