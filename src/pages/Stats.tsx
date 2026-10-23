import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import Icon from '../components/Icon';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { bestStreak, comprehension, computeStreak, countKnownWords, estimateVocab, goalMet, studied } from '../lib/stats';
import { formatClock, formatDate, shiftDate, shortDate, studyDateOf } from '../lib/time';

export default function Stats() {
  const settings = useSettings();
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const known = useLiveQuery(() => countKnownWords(), []);
  const comp = useLiveQuery(() => comprehension(), []);
  const learned = useLiveQuery(() => db.cards.count(), []);
  const [range, setRange] = useState<7 | 30>(7);
  const [tab, setTab] = useState<'period' | 'study' | 'vocab'>('study');
  const [month, setMonth] = useState(() => {
    const [y, m] = studyDateOf().split('-').map(Number);
    return { y, m };
  });

  if (!settings || !daily) {
    return (
      <div className="screen">
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }

  const goal = settings.dailyGoal;
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const today = studyDateOf();
  const trophies = daily.filter((d) => goalMet(d, goal)).length;
  const totalQ = daily.reduce((s, d) => s + d.total, 0);
  const totalTime = daily.reduce((s, d) => s + d.timeMs, 0);
  const todayTime = byDate.get(today)?.timeMs ?? 0;

  const days = Array.from({ length: range }, (_, i) => shiftDate(today, i - (range - 1)));
  const max = Math.max(goal, ...days.map((d) => byDate.get(d)?.total ?? 0));
  const sum = (k: 'newWords' | 'reviews' | 'knownNew') => days.reduce((s, d) => s + (byDate.get(d)?.[k] ?? 0), 0);

  // 달력
  const first = new Date(month.y, month.m - 1, 1, 12);
  const lead = first.getDay();
  const daysInMonth = new Date(month.y, month.m, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(formatDate(new Date(month.y, month.m - 1, d, 12)));
  const moveMonth = (delta: number) =>
    setMonth(({ y, m }) => {
      const nm = m + delta;
      return nm < 1 ? { y: y - 1, m: 12 } : nm > 12 ? { y: y + 1, m: 1 } : { y, m: nm };
    });

  return (
    <div className="screen stats">
      <nav className="stats-tabs">
        <button className={tab === 'period' ? 'active' : ''} onClick={() => setTab('period')}>
          기간별
        </button>
        <button className={tab === 'study' ? 'active' : ''} onClick={() => setTab('study')}>
          학습별
        </button>
        <button className={tab === 'vocab' ? 'active' : ''} onClick={() => setTab('vocab')}>
          어휘력
        </button>
      </nav>

      {tab === 'study' && (
        <>
      <div className="study-chips">
        <span className="chip-btn active">어휘</span>
      </div>
      <h2 className="stats-h2">어휘 학습</h2>
      <section className="info-card">
        <div className="kv-row">
          <span>
            <Icon name="trophy" size={18} className="ic-gold" /> 어휘 트로피
          </span>
          <b>{trophies.toLocaleString()}</b>
        </div>
        <div className="kv-row">
          <span>
            <Icon name="star" size={18} className="ic-blue" /> 총 학습 문제
          </span>
          <b>{totalQ.toLocaleString()}</b>
        </div>
        <div className="kv-row">
          <span>
            <Icon name="book" size={18} className="ic-purple" /> 학습한 단어
          </span>
          <b>{(learned ?? 0).toLocaleString()}</b>
        </div>
        <div className="divider" />
        <div className="kv-row">
          <span>오늘 학습 시간</span>
          <b>{formatClock(todayTime)}</b>
        </div>
        <div className="kv-row">
          <span>총 학습 시간</span>
          <b>{formatClock(totalTime)}</b>
        </div>
      </section>

      <section className="info-card">
        <div className="info-card-head">
          <h3>학습 정보</h3>
          <div className="segmented small">
            <button className={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>
              7일
            </button>
            <button className={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>
              30일
            </button>
          </div>
        </div>
        <ul className="legend inline">
          <li>
            <i className="dot new" /> 새로 배운 단어 {Math.max(0, sum('newWords') - sum('knownNew'))}
          </li>
          <li>
            <i className="dot known" /> 이미 아는 단어 {sum('knownNew')}
          </li>
          <li>
            <i className="dot review" /> 복습 {sum('reviews')}
          </li>
        </ul>
        <div className={`bars ${range === 30 ? 'dense' : ''}`}>
          {days.map((d) => {
            const r = byDate.get(d);
            const n = Math.max(0, (r?.newWords ?? 0) - (r?.knownNew ?? 0));
            const k = r?.knownNew ?? 0;
            const v = r?.reviews ?? 0;
            const h = (x: number) => `${(x / max) * 100}%`;
            return (
              <div key={d} className="bar-col">
                <div className="bar-stack">
                  <span className="seg review" style={{ height: h(v) }} />
                  <span className="seg known" style={{ height: h(k) }} />
                  <span className="seg new" style={{ height: h(n) }} />
                </div>
                {range === 7 && <span className="bar-x">{shortDate(d)}</span>}
              </div>
            );
          })}
          <div className="goal-line" style={{ bottom: `calc(${(goal / max) * 100}% * 0.86 + 18px)` }} />
        </div>
      </section>

        </>
      )}

      {tab === 'period' && (
      <section className="info-card streak-box">
        <div className="streak-summary">
          <div>
            <span className="muted small">연속 학습일</span>
            <p className="streak-big">
              <Icon name="flame" size={26} className="ic-orange" /> {streak ?? 0}
            </p>
          </div>
          <div className="streak-best">
            <span className="muted small">최고 기록</span>
            <p>
              <b>{bestStreak(daily)}</b>일
            </p>
          </div>
        </div>
        <div className="cal-head">
          <button className="icon-btn small" onClick={() => moveMonth(-1)} aria-label="이전 달">
            <Icon name="back" size={16} />
          </button>
          <span>
            {month.y}년 {month.m}월
          </span>
          <button className="icon-btn small" onClick={() => moveMonth(1)} aria-label="다음 달">
            <Icon name="chevron" size={16} />
          </button>
        </div>
        <div className="cal-grid">
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <span key={w} className="cal-w">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const r = byDate.get(d);
            return (
              <span key={d} className={`cal-cell ${d === today ? 'today' : ''}`}>
                {goalMet(r, goal) ? (
                  <span className="stamp gold">
                    <Icon name="trophy" size={14} />
                  </span>
                ) : studied(r) ? (
                  <span className="stamp star">
                    <Icon name="star" size={14} />
                  </span>
                ) : (
                  <span className="cal-num">{Number(d.slice(8))}</span>
                )}
              </span>
            );
          })}
        </div>
      </section>

      )}

      {tab === 'vocab' && (
      <section className="vocab-card">
        <p className="vocab-card-title">나의 어휘력</p>
        <div className="trophy-big">
          <Icon name="trophy" size={56} />
        </div>
        <div className="vocab-stat">
          <span>내가 알고 있는 어휘 (추정)</span>
          <b>약 {estimateVocab(settings.level ?? 10, comp ?? null).toLocaleString()} 개</b>
        </div>
        <div className="vocab-stat">
          <span>나의 어휘 이해도</span>
          <b>{comp == null ? '-' : `${(comp * 100).toFixed(1)} %`}</b>
        </div>
        <div className="vocab-stat">
          <span>현재 레벨 · 확실히 아는 단어</span>
          <b>
            레벨 {settings.level ?? '-'} · {known ?? 0}개
          </b>
        </div>
        <p className="vocab-foot">추정치는 현재 레벨과 최근 새 단어를 처음부터 알았던 비율로 계산해요.</p>
      </section>
      )}
    </div>
  );
}
