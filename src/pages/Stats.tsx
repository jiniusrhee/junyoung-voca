import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { db } from '../db';
import { MASTERY_KO, MASTERY_ORDER, masteryOf, type Mastery } from '../lib/scheduler';
import { useSettings } from '../lib/settings';
import { comprehension, estimateVocab, goalMet, reviewAccuracy } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatClock, shiftDate, studyDateOf } from '../lib/time';
import type { DailyRow } from '../types';

type Tab = 'period' | 'study' | 'vocab';

export default function Stats() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'period';
  const setTab = (t: Tab) => setParams(t === 'period' ? {} : { tab: t }, { replace: true });
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const acc = useLiveQuery(() => reviewAccuracy(), []);
  if (!settings || !daily) return <div className="screen" />;

  const byDate = new Map(daily.map((d) => [d.date, d]));
  const today = studyDateOf();

  return (
    <div className="screen stats">
      <header className="home-head">
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <Icon name="list" size={26} />
          <span>{settings.nickname}</span>
        </button>
        <span className="head-bell">
          <Icon name="bell" size={26} />
        </span>
      </header>
      <nav className="stats-tabs">
        {(
          [
            ['period', '기간별'],
            ['study', '학습별'],
            ['vocab', '어휘력'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      {tab === 'period' && <PeriodTab byDate={byDate} daily={daily} today={today} acc={acc ?? null} />}
      {tab === 'study' && <StudyModes daily={daily} today={today} goals={{ vocab: settings.dailyGoal, grammar: settings.grammarGoal, listening: settings.listeningGoal }} />}
      {tab === 'vocab' && <VocabTab level={settings.level ?? 10} />}
    </div>
  );
}

/* ---------------- 기간별 ---------------- */

function PeriodTab({ byDate, daily, today, acc }: { byDate: Map<string, DailyRow>; daily: DailyRow[]; today: string; acc: number | null }) {
  const t = byDate.get(today);
  const reviews = t?.reviews ?? 0;
  const fresh = t?.newWords ?? 0;
  const sum = Math.max(1, fresh + reviews);
  const dow = dayOfWeek(today);
  const sameDow = daily.filter((d) => dayOfWeek(d.date) === dow && d.total > 0);
  const avgMin = sameDow.length ? Math.round(sameDow.reduce((s, d) => s + d.timeMs, 0) / sameDow.length / 60000) : 0;
  const avgQ = sameDow.length ? Math.round(sameDow.reduce((s, d) => s + d.total, 0) / sameDow.length) : 0;

  return (
    <>
      <h2 className="stats-h2">오늘의 학습 정보</h2>
      <div className="tile-row">
        <div className="s-tile">
          <span className="s-tile-icon clock">
            <Icon name="clock" size={30} />
          </span>
          <div>
            <span>총 학습 시간</span>
            <b>{formatClock(t?.timeMs ?? 0)}</b>
          </div>
        </div>
        <div className="s-tile">
          <span className="s-tile-icon pencil">
            <Icon name="pencil" size={22} />
          </span>
          <div>
            <span>총 학습 문제</span>
            <b>{t?.total ?? 0}</b>
          </div>
        </div>
      </div>
      <div className="s-card mode-sum">
        <span className="ms-icon">
          <Icon name="bookPerson" size={24} />
        </span>
        <div className="ms-body">
          <div className="ms-head">
            <b>어휘</b>
            <span className="ms-acc">
              <Icon name="shield" size={13} /> 복습 정답률 {acc == null ? '-' : `${Math.round(acc * 100)}%`} <Icon name="chevron" size={12} />
            </span>
          </div>
          <div className="ms-bar">
            <span className="new" style={{ width: `${(fresh / sum) * 100}%` }} />
            <span className="rev" style={{ width: `${(reviews / sum) * 100}%` }} />
          </div>
          <p className="ms-legend">
            새 문제 <b className="y">{fresh}</b> 복습 문제 <b className="b">{reviews}</b>
          </p>
        </div>
      </div>
      <div className="s-card habit">
        <span className="habit-icon">
          <Icon name="chart" size={22} />
        </span>
        <div>
          <b>보통 {WEEKDAYS_KO[dow]}요일에는?</b>
          <p>
            {sameDow.length ? (
              <>
                평균 <em>{avgMin}분</em> 동안 <em>{avgQ}문제</em>를 학습해요.
              </>
            ) : (
              '아직 이 요일의 학습 기록이 없어요.'
            )}
          </p>
        </div>
      </div>

      <div className="stats-sep" />
      <h2 className="stats-h2">기간별 학습 정보</h2>
      <Heatmap byDate={byDate} today={today} />
      <TimeChart byDate={byDate} today={today} />
    </>
  );
}

function Heatmap({ byDate, today }: { byDate: Map<string, DailyRow>; today: string }) {
  // 최근 52주를 26주씩 두 줄로 (일요일 시작)
  const end = shiftDate(today, 6 - dayOfWeek(today));
  const start = shiftDate(end, -(52 * 7) + 1);
  const max = Math.max(1, ...[...byDate.values()].map((d) => d.total));
  const level = (n: number) => (n <= 0 ? 0 : n < max * 0.25 ? 1 : n < max * 0.5 ? 2 : n < max * 0.75 ? 3 : 4);
  const blocks = [0, 1].map((b) =>
    Array.from({ length: 26 }, (_, w) => Array.from({ length: 7 }, (_, d) => shiftDate(start, (b * 26 + w) * 7 + d))),
  );
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return (
    <div className="s-card heat">
      <div className="heat-head">
        <b>연간 학습</b>
        <span className="muted small">최근</span>
      </div>
      <div className="heat-legend">
        Less <i className="h1" /> <i className="h2" /> <i className="h3" /> <i className="h4" /> More
      </div>
      {blocks.map((weeks, bi) => (
        <div key={bi} className="heat-block">
          <div className="heat-months">
            {weeks.map((wk, i) => {
              const first = wk.find((d) => d.endsWith('-01') || (i === 0 && d === wk[0]));
              return <span key={i}>{first && first.endsWith('-01') ? MONTHS[Number(first.slice(5, 7)) - 1] : ''}</span>;
            })}
          </div>
          <div className="heat-grid">
            {weeks.map((wk, i) => (
              <div key={i} className="heat-col">
                {wk.map((d) => (
                  <i key={d} className={`hc l${d > today ? 'x' : level(byDate.get(d)?.total ?? 0)}`} title={d} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimeChart({ byDate, today }: { byDate: Map<string, DailyRow>; today: string }) {
  const [range, setRange] = useState<'week' | 'month' | 'year' | 'all'>('week');
  let points: { label: string; ms: number }[] = [];
  if (range === 'week' || range === 'month') {
    const n = range === 'week' ? 7 : 30;
    points = Array.from({ length: n }, (_, i) => {
      const d = shiftDate(today, i - (n - 1));
      return { label: d, ms: byDate.get(d)?.timeMs ?? 0 };
    });
  } else {
    const months = new Map<string, number>();
    for (const [d, r] of byDate) months.set(d.slice(0, 7), (months.get(d.slice(0, 7)) ?? 0) + r.timeMs);
    const keys = [...months.keys()].sort();
    const want = range === 'year' ? 12 : Math.max(keys.length, 1);
    const last = today.slice(0, 7);
    const list: string[] = [];
    let [y, m] = last.split('-').map(Number);
    for (let i = 0; i < want; i++) {
      list.unshift(`${y}-${String(m).padStart(2, '0')}`);
      m -= 1;
      if (m === 0) {
        m = 12;
        y -= 1;
      }
    }
    points = list.map((k) => ({ label: k, ms: months.get(k) ?? 0 }));
  }
  const avg = points.reduce((s, p) => s + p.ms, 0) / Math.max(1, points.length);
  const W = 300;
  const H = 120;
  const max = Math.max(60_000, ...points.map((p) => p.ms));
  const xy = points.map((p, i) => [8 + (i * (W - 16)) / Math.max(1, points.length - 1), H - 10 - (p.ms / max) * (H - 24)] as const);
  const avgText = `${Math.floor(avg / 60000)}분 ${Math.round((avg % 60000) / 1000)}초`;
  const unit = range === 'week' ? '최근 한 주, 하루' : range === 'month' ? '최근 한 달, 하루' : '한 달';

  return (
    <div className="s-card timechart">
      <div className="seg-full">
        {(
          [
            ['week', '주'],
            ['month', '월'],
            ['year', '년'],
            ['all', '전체'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={range === k ? 'active' : ''} onClick={() => setRange(k)}>
            {l}
          </button>
        ))}
      </div>
      <b className="tc-title">학습 시간</b>
      <p className="tc-desc">
        {unit} 평균 학습 시간은 <em>{avgText}</em>예요.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="tc-svg" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} className="tc-grid" />
        ))}
        {xy.length > 1 && <polyline points={xy.map((p) => p.join(',')).join(' ')} className="tc-line" />}
      </svg>
      <div className="tc-range">
        <span>{points[0]?.label.replace(/-/g, '.')}</span>
        <span className="em">{points[points.length - 1]?.label.replace(/-/g, '.')}</span>
      </div>
    </div>
  );
}

/* ---------------- 학습별 ---------------- */

type SMode = 'vocab' | 'grammar' | 'listening';
const SMODE_LABEL: Record<SMode, string> = { vocab: '어휘', grammar: '문법', listening: '리스닝' };

/** 어휘 외 모드의 하루 기록을 어휘와 같은 모양으로 */
function viewOf(d: DailyRow, mode: SMode, goal: number): DailyRow {
  if (mode === 'vocab') return d;
  const m = d.byMode?.[mode];
  return { date: d.date, total: m?.total ?? 0, newWords: m?.newItems ?? 0, reviews: m?.reviews ?? 0, correct: m?.correct ?? 0, timeMs: m?.timeMs ?? 0, knownNew: 0, goal };
}

function StudyModes({ daily, today, goals }: { daily: DailyRow[]; today: string; goals: Record<SMode, number> }) {
  const [mode, setMode] = useState<SMode>('vocab');
  const rows = daily.map((d) => viewOf(d, mode, goals[mode]));
  const byDate = new Map(rows.map((d) => [d.date, d]));
  return (
    <>
      <div className="study-chips">
        {(Object.keys(SMODE_LABEL) as SMode[]).map((m) => (
          <button key={m} className={`chip-btn ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
            {SMODE_LABEL[m]}
          </button>
        ))}
      </div>
      <StudyTab key={mode} mode={mode} byDate={byDate} daily={rows} today={today} goal={goals[mode]} />
    </>
  );
}

function StudyTab({ mode, byDate, daily, today, goal }: { mode: SMode; byDate: Map<string, DailyRow>; daily: DailyRow[]; today: string; goal: number }) {
  const label = SMODE_LABEL[mode];
  const unit = mode === 'vocab' ? '단어' : '문장';
  const [offset, setOffset] = useState(0);
  const trophies = daily.filter((d) => goalMet(d, goal)).length;
  const totalQ = daily.reduce((s, d) => s + d.total, 0);
  const totalTime = daily.reduce((s, d) => s + d.timeMs, 0);
  const end = shiftDate(today, -offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(end, i - 6));
  const rows = days.map((d) => byDate.get(d));
  const max = Math.max(5, ...rows.map((r) => r?.total ?? 0));
  const tot = (k: 'newWords' | 'reviews' | 'knownNew') => rows.reduce((s, r) => s + (r?.[k] ?? 0), 0);
  const newLearned = Math.max(0, tot('newWords') - tot('knownNew'));
  const reviewRows = rows.filter((r): r is DailyRow => !!r && r.total > 0);
  const accAll = reviewRows.length ? Math.round((reviewRows.reduce((s, r) => s + r.correct, 0) / reviewRows.reduce((s, r) => s + r.total, 0)) * 100) : null;
  const H = 150;

  return (
    <>
      <h2 className="stats-h2">{label} 학습</h2>
      <div className="s-card kv">
        <div className="kv-row">
          <span>
            <Icon name="trophy" size={20} className="ic-gold" /> {label} 트로피 <i className="qmark">?</i>
          </span>
          <b>{trophies.toLocaleString()}</b>
        </div>
        <div className="kv-row">
          <span>
            <Icon name="star" size={20} className="ic-blue" /> 총 학습 문제
          </span>
          <b>{totalQ.toLocaleString()}</b>
        </div>
      </div>
      <div className="s-card kv">
        <div className="kv-row">
          <span>
            <i className="clock-dot pink" /> 오늘 학습 시간
          </span>
          <b>{formatClock(byDate.get(today)?.timeMs ?? 0)}</b>
        </div>
        <div className="kv-row">
          <span>
            <i className="clock-dot blue" /> 총 학습 시간
          </span>
          <b>{formatClock(totalTime)}</b>
        </div>
      </div>
      <div className="s-card weekly">
        <div className="weekly-head">
          <b>학습 정보</b>
          <span className="week-nav">
            <button onClick={() => setOffset((o) => o + 1)} aria-label="이전 주">
              <Icon name="back" size={14} />
            </button>
            7일
            <button onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label="다음 주">
              <Icon name="chevron" size={14} />
            </button>
          </span>
        </div>
        <svg viewBox={`0 0 300 ${H + 20}`} className="weekly-svg">
          {rows.map((r, i) => {
            const x = 8 + i * 42;
            const sc = (n: number) => (n / max) * H;
            const n = Math.max(0, (r?.newWords ?? 0) - (r?.knownNew ?? 0));
            const k = r?.knownNew ?? 0;
            const v = r?.reviews ?? 0;
            let y = H;
            const segs = [
              { h: sc(v), c: 'var(--st-review)' },
              { h: sc(k), c: 'var(--st-known)' },
              { h: sc(n), c: 'var(--st-new)' },
            ];
            return (
              <g key={i}>
                {segs.map((s, j) => {
                  y -= s.h;
                  return s.h > 0 ? <rect key={j} x={x} y={y} width={32} height={s.h} rx={3} fill={s.c} /> : null;
                })}
                <text x={x + 16} y={H + 15} className="wk-x" textAnchor="middle">
                  {days[i] === today ? '오늘' : WEEKDAYS_KO[dayOfWeek(days[i])]}
                </text>
              </g>
            );
          })}
          <polyline
            className="wk-line"
            points={rows
              .map((r, i) => (r && r.total ? `${24 + i * 42},${8 + (1 - r.correct / r.total) * 60}` : null))
              .filter(Boolean)
              .join(' ')}
          />
          {rows.map((r, i) => (r && r.total ? <circle key={i} cx={24 + i * 42} cy={8 + (1 - r.correct / r.total) * 60} r={4} className="wk-dot" /> : null))}
        </svg>
        <div className="weekly-sum">
          <div className="ws-total">
            <span>Total</span>
            <b>{tot('newWords') + tot('reviews')}</b>
          </div>
          <ul>
            <li>
              <i className="sw new" /> 새로 배운 {unit} <b>{newLearned}</b>
            </li>
            <li>
              <i className="sw known" /> 이미 아는 단어 <b>{tot('knownNew')}</b>
            </li>
            <li>
              <i className="sw review" /> 복습 {unit} <b>{tot('reviews')}</b>
            </li>
            <li>
              <i className="sw ring" /> 복습 정답률 <i className="qmark">?</i> <b>{accAll == null ? '-' : `${accAll}%`}</b>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------------- 어휘력 ---------------- */

function VocabTab({ level }: { level: number }) {
  const nav = useNavigate();
  const comp = useLiveQuery(() => comprehension(), []);
  const testDate = useLiveQuery(async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
  const data = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const words = await db.words.bulkGet(cards.map((c) => c.wordId));
    const byLevel = Array.from({ length: 30 }, () => 0);
    const mastery: Record<Mastery, number> = { strong: 0, solid: 0, fresh: 0, shaky: 0 };
    cards.forEach((c, i) => {
      const w = words[i];
      if (w) byLevel[w.level - 1] += 1;
      mastery[masteryOf(c)] += 1;
    });
    return { byLevel, mastery, total: cards.length };
  }, []);
  const maxL = Math.max(1, ...(data?.byLevel ?? [1]));
  const dateText = testDate ? `${testDate.slice(0, 4)}년 ${Number(testDate.slice(5, 7))}월 ${Number(testDate.slice(8))}일 측정` : '측정 전';

  return (
    <>
      <section className="gold-card">
        <div className="gold-head">
          <b>나의 어휘력</b>
          <span>{dateText}</span>
        </div>
        <div className="gold-trophy">
          <Icon name="trophy" size={84} />
        </div>
        <div className="gold-inner">
          <span>내가 알고 있는 어휘</span>
          <b className="laurel">{estimateVocab(level, comp ?? null).toLocaleString()} 개</b>
          <span>나의 어휘 이해도</span>
          <b className="laurel">{comp == null ? '-' : `${(comp * 100).toFixed(2)} %`}</b>
          <span>현재 레벨</span>
          <b className="laurel">레벨 {level}</b>
        </div>
      </section>
      <button className="measure-btn" onClick={() => nav('/test')}>
        어휘력 측정하기
      </button>

      <div className="s-card">
        <b className="card-title">레벨별 학습 단어</b>
        <div className="level-bars">
          {(data?.byLevel ?? []).map((n, i) => (
            <span key={i} style={{ height: `${(n / maxL) * 100}%` }} className={n ? '' : 'zero'} />
          ))}
        </div>
        <div className="level-axis">
          <span>레벨1</span>
          <span>레벨30</span>
        </div>
      </div>

      <div className="s-card mastery">
        <b className="card-title">어휘 숙련도별 학습 현황</b>
        <div className="mastery-date">{studyDateOf().replace(/-/g, '.')}</div>
        <div className="mastery-bar">
          {MASTERY_ORDER.map((m) => (
            <span key={m} className={`mb-${m}`} style={{ flex: data?.mastery[m] ?? 0 }} />
          ))}
        </div>
        <ul className="mastery-list">
          {MASTERY_ORDER.map((m) => (
            <li key={m}>
              <i className={`mb-${m}`} /> {MASTERY_KO[m]} : <b>{(data?.mastery[m] ?? 0).toLocaleString()}</b>
            </li>
          ))}
        </ul>
        <div className="mastery-total">
          <span>
            총 학습 단어 <i className="qmark">?</i>
          </span>
          <b>
            {(data?.total ?? 0).toLocaleString()} <small>개</small>
          </b>
        </div>
      </div>
    </>
  );
}
