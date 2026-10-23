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
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  if (!settings) return null;

  const byDate = new Map((daily ?? []).map((d) => [d.date, d]));
  const t = byDate.get(today);
  const total = t?.total ?? 0;
  const goal = settings.dailyGoal;
  const pct = Math.round((total / goal) * 100);
  const met = total >= goal;
  const last7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6));

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="screen home">
      <header className="home-head">
        <button className="head-menu" onClick={() => setDrawer(true)} aria-label="메뉴">
          <Icon name="list" size={24} />
          <span>준영보카</span>
        </button>
        <button className="head-bell" onClick={() => showToast('새 알림이 없어요')} aria-label="알림">
          <Icon name="bell" size={24} />
        </button>
      </header>
      {toast && <div className="home-toast">{toast}</div>}

      <StreakCard today={today} byDate={byDate} goal={goal} streak={streak ?? 0} />

      <section className="main-card">
        <span className="ribbon">
          <Icon name="trophy" size={20} />
        </span>
        <div className="mode-tabs">
          <span className="mode-tab active" aria-label="어휘 학습">
            <Icon name="bookPerson" size={24} />
          </span>
          <button className="mode-tab" onClick={() => nav('/settings')} aria-label="설정">
            <Icon name="gear" size={22} />
          </button>
        </div>
        <div className="main-mascot">
          <Mascot size={132} mood={met ? 'cheer' : 'happy'} />
        </div>
        <div className="main-row">
          <div className="main-text">
            <Link to="/stats" className="acc-line">
              <Icon name="shield" size={14} /> 복습 정답률 {acc == null ? '-' : `${Math.round(acc * 100)}%`} <Icon name="chevron" size={12} />
            </Link>
            <h2>어휘 학습</h2>
            <button className="goal-line-btn" onClick={() => setGoalOpen(true)}>
              하루 목표 <b>{goal}</b>개 <Icon name="pencil" size={14} />
            </button>
          </div>
          <ProgressRing value={total / goal} label={String(pct)} size={92} stroke={6} />
        </div>
        <button className="today-btn" onClick={() => nav('/quiz')}>
          <Icon name={met ? 'star' : 'book'} size={22} />
          {met ? '추가 학습' : '오늘의 어휘'}
        </button>
      </section>

      <section className="info-card study-info">
        <Link to="/stats" className="info-card-head">
          <h3>
            <Icon name="chart" size={18} className="ic-purple" /> 학습 정보
          </h3>
          <span className="acc-mini">
            <i className="dot review" /> 복습 정답률 <b>{acc == null ? '-' : `${Math.round(acc * 100)}%`}</b>
            <Icon name="chevron" size={14} className="muted-ic" />
          </span>
        </Link>
        <div className="study-info-body">
          <MiniChart days={last7} byDate={byDate} />
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
        <ListRow to="/favorites" icon="heartFill" label="내가 좋아하는 문장" count={counts?.fav} tint="pink" />
        <ListRow to="/wrongs" icon="xcircle" label="내 오답노트" count={counts?.wrongs} tint="mint" />
        <ListRow to="/words" icon="hourglass" label="내가 학습한 어휘" count={counts?.learned} tint="teal" />
      </section>
      <section className="list-card">
        <ListRow to="/dict" icon="search" label="단어 사전" count={counts?.words} tint="blue" />
      </section>
      <p className="home-foot">복습 대기 {counts?.due ?? 0}개 · 레벨 {settings.level ?? '-'}</p>

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
      {drawer && <Drawer level={settings.level} onClose={() => setDrawer(false)} />}
    </div>
  );
}

function StreakCard({ today, byDate, goal, streak }: { today: string; byDate: Map<string, DailyRow>; goal: number; streak: number }) {
  const week = weekOf(today);
  const alive = studied(byDate.get(today)) || studied(byDate.get(shiftDate(today, -1)));
  const inRun = (d: string) => d <= today && (studied(byDate.get(d)) || (d === today && alive));
  return (
    <Link to="/stats" className="streak-card">
      <span className="flame-big">
        <Icon name="flame" size={34} />
      </span>
      <div className="streak-main">
        <p className="streak-text">
          연속 학습 <b>{streak}</b>일
        </p>
        <div className="week-row">
          {week.map((d, i) => {
            const on = inRun(d);
            const prev = i > 0 && inRun(week[i - 1]);
            const nextOn = i < 6 && inRun(week[i + 1]);
            const row = byDate.get(d);
            const cls = ['day', on ? 'on' : '', on && !prev ? 'start' : '', on && !nextOn ? 'end' : '', d === today ? 'today' : '', d > today ? 'future' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <span key={d} className={cls}>
                {goalMet(row, goal) ? (
                  <span className="stamp gold">
                    <Icon name="trophy" size={14} />
                  </span>
                ) : studied(row) ? (
                  <span className="stamp star">
                    <Icon name="star" size={14} />
                  </span>
                ) : (
                  <span className="stamp">{WEEKDAYS_KO[dayOfWeek(d)]}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <Icon name="chevron" size={18} className="muted-ic" />
    </Link>
  );
}

function MiniChart({ days, byDate }: { days: string[]; byDate: Map<string, DailyRow> }) {
  const W = 168;
  const H = 74;
  const max = Math.max(5, ...days.map((d) => byDate.get(d)?.total ?? 0));
  const bw = 7;
  const step = W / days.length;
  const pts = days
    .map((d, i) => {
      const r = byDate.get(d);
      if (!r || !r.total) return null;
      return { x: i * step + step / 2, y: 6 + (1 - r.correct / r.total) * (H * 0.45) };
    })
    .filter((p): p is { x: number; y: number } => p !== null);
  return (
    <svg className="mini-chart" viewBox={`0 0 ${W} ${H}`} aria-label="최근 7일 학습량">
      {days.map((d, i) => {
        const r = byDate.get(d);
        const n = Math.max(0, (r?.newWords ?? 0) - (r?.knownNew ?? 0));
        const k = r?.knownNew ?? 0;
        const v = r?.reviews ?? 0;
        const sc = (x: number) => (x / max) * (H - 30);
        const x = i * step + step / 2 - bw / 2;
        let y = H - 4;
        const segs = [
          { h: sc(v), c: 'var(--c-review)' },
          { h: sc(k), c: 'var(--c-known)' },
          { h: sc(n), c: 'var(--c-new)' },
        ];
        return (
          <g key={d}>
            {segs.map((s, j) => {
              y -= s.h;
              return s.h > 0 ? <rect key={j} x={x} y={y} width={bw} height={s.h} fill={s.c} /> : null;
            })}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={H - 4} y2={H - 4} stroke="#eceef3" strokeWidth={1} />
      {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#8a7cf0" strokeWidth={1.5} />}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="#8a7cf0" />
      ))}
    </svg>
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

function Drawer({ level, onClose }: { level: number | null; onClose: () => void }) {
  const items: { to: string; icon: IconName; label: string }[] = [
    { to: '/stats', icon: 'chart', label: '학습 기록' },
    { to: '/dict', icon: 'search', label: '단어 사전' },
    { to: '/wrongs', icon: 'note', label: '내 오답노트' },
    { to: '/favorites', icon: 'heart', label: '내가 좋아하는 문장' },
    { to: '/words', icon: 'hourglass', label: '내가 학습한 어휘' },
    { to: '/settings', icon: 'gear', label: '설정' },
  ];
  return (
    <div className="drawer-dim" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <Mascot size={64} />
          <div>
            <p className="drawer-name">준영보카</p>
            <p className="muted small">현재 레벨 {level ?? '-'}</p>
          </div>
        </div>
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="drawer-item" onClick={onClose}>
            <Icon name={it.icon} size={20} className="ic-purple" />
            {it.label}
          </Link>
        ))}
      </aside>
    </div>
  );
}
