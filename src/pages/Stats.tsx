import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { db } from '../db';
import { MASTERY_KO, MASTERY_ORDER, masteryOf, type Mastery } from '../lib/scheduler';
import { getSettings, useSettings } from '../lib/settings';
import { getImported } from '../lib/imported';
import { comprehension, dayTime, dayTotal, displayVocab, goalMet, reviewAccuracy, vocabDateText, percentileOf, latestMeasure } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatClock, shiftDate, studyDateOf } from '../lib/time';
import type { DailyRow, ImportedProgress, StudyMode, ReviewRow } from '../types';

type Tab = 'period' | 'study' | 'vocab';

export default function Stats() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'period';
  const setTab = (t: Tab) => setParams(t === 'period' ? {} : { tab: t }, { replace: true });
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const acc = useLiveQuery(() => reviewAccuracy(), []);
  const imp = useLiveQuery(() => getImported(), []);
  if (!settings || !daily) return <div className="screen" />;

  const byDate = new Map(daily.map((d) => [d.date, d]));
  const today = studyDateOf();

  return (
    <div className="screen stats">
      <div className="stats-top">
        <header className="home-head">
          <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
            {/* 말해보카 실측: 가로 15, 줄 두께 2, 줄 간격 5.67 (CSS px) */}
            <svg className="st-menu" width="15" height="13.33" viewBox="0 0 15 13.33" aria-hidden="true">
              <rect x="0" y="0" width="15" height="2" rx="1" />
              <rect x="0" y="5.67" width="15" height="2" rx="1" />
              <rect x="0" y="11.33" width="15" height="2" rx="1" />
            </svg>
            <span>{settings.nickname}</span>
          </button>
          <button className="head-bell" onClick={() => nav('/inbox')} aria-label="알림함">
            <svg className="st-bell" width="18.67" height="19.33" viewBox="0 0 28 29" aria-hidden="true">
              <path d="M14 1.5a2.1 2.1 0 0 1 2.1 2.1v1.1A8.4 8.4 0 0 1 22.4 13v6.4l2.7 3.4c.6.8.1 2-.9 2H3.8c-1 0-1.5-1.2-.9-2l2.7-3.4V13a8.4 8.4 0 0 1 6.3-8.3V3.6A2.1 2.1 0 0 1 14 1.5z" />
              <path d="M10.3 26.2h7.4a3.7 3.7 0 0 1-7.4 0z" />
            </svg>
          </button>
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
      </div>
      {tab === 'period' && <PeriodTab byDate={byDate} daily={daily} today={today} acc={acc ?? null} />}
      {tab === 'study' && (
        <StudyModes daily={daily} today={today} imp={imp ?? null} goals={{ vocab: settings.dailyGoal, grammar: settings.grammarGoal, expr: settings.exprGoal, talk: settings.talkGoal, listening: settings.listeningGoal }} />
      )}
      {tab === 'vocab' && <VocabTab level={settings.level ?? 10} imp={imp ?? null} />}
    </div>
  );
}

/* ---------------- 기간별 ---------------- */

function PeriodTab({ byDate, daily, today, acc }: { byDate: Map<string, DailyRow>; daily: DailyRow[]; today: string; acc: number | null }) {
  const t = byDate.get(today);
  const modeAcc = useLiveQuery(async () => ({
    grammar: await reviewAccuracy(7, new Date(), 'grammar'),
    expr: await reviewAccuracy(7, new Date(), 'expr'),
    talk: await reviewAccuracy(7, new Date(), 'talk'),
    listening: null,
  }), []);
  const listenBest = useLiveQuery(async () => ((await db.kv.get('listeningBest'))?.value as number | undefined) ?? (await getSettings()).listeningLevel ?? undefined, []);
  const reviews = t?.reviews ?? 0;
  const fresh = t?.newWords ?? 0;
  const dow = dayOfWeek(today);
  const sameDow = daily.filter((d) => dayOfWeek(d.date) === dow && dayTotal(d) > 0);
  const avgMin = sameDow.length ? Math.round(sameDow.reduce((s, d) => s + dayTime(d), 0) / sameDow.length / 60000) : 0;
  const avgQ = sameDow.length ? Math.round(sameDow.reduce((s, d) => s + dayTotal(d), 0) / sameDow.length) : 0;
  const others = (['grammar', 'expr', 'talk', 'listening'] as const).filter((m) => (t?.byMode?.[m]?.total ?? 0) > 0);

  return (
    <>
      <h2 className="stats-h2">오늘의 학습 정보</h2>
      <div className="tile-row">
        <div className="s-tile">
          <span className="s-tile-icon clock">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <circle cx="11" cy="11" r="11" fill="#bdd3e3" />
              <circle cx="11" cy="11" r="7.4" fill="#fff" />
              <path d="M11 6.6V11.2l3.2 1.9" fill="none" stroke="#3d4b5b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <span>총 학습 시간</span>
            <b>{formatClock(dayTime(t))}</b>
          </div>
        </div>
        <div className="s-tile">
          <span className="s-tile-icon pencil">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
              <g transform="rotate(45 11 11)">
                <rect x="8.3" y="0.6" width="5.4" height="3.4" rx="1.2" fill="#f0a3a8" />
                <rect x="8.3" y="3.2" width="5.4" height="1.6" fill="#cfd2d6" />
                <rect x="8.3" y="4.6" width="5.4" height="10.6" fill="#e9bd63" />
                <path d="M8.3 15.2h5.4L11 21.4z" fill="#ead3b0" />
                <path d="M10.1 19.1L11 21.4l.9-2.3z" fill="#3a3a3a" />
              </g>
            </svg>
          </span>
          <div>
            <span>총 학습 문제</span>
            <b>{dayTotal(t)}</b>
          </div>
        </div>
      </div>
      <div className="s-card mode-list">
        {(['vocab', ...others] as const).map((m) => {
          const md = m === 'vocab' ? { newItems: fresh, reviews, total: t?.total ?? 0 } : t!.byMode![m]!;
          const sm = Math.max(1, md.newItems + md.reviews);
          const accText = m === 'vocab' ? acc : m === 'listening' ? null : modeAcc?.[m];
          return (
            <div key={m} className={`mode-sum m-${m}`}>
              <span className="ms-icon">
                <Icon name={m === 'vocab' ? 'bookPerson' : MODE_ICON[m]} size={18} />
              </span>
              <div className="ms-body">
                <div className="ms-head">
                  <b>{SMODE_LABEL[m]}</b>
                  <span className="ms-acc">
                    {m === 'listening' ? (
                      <>
                        <Icon name="trophy" size={11} /> 최고 레벨 {listenBest ?? '-'}
                      </>
                    ) : (
                      <>
                        <svg className="st-badge" width="9.33" height="9.33" viewBox="0 0 10 10" aria-hidden="true">
                          <circle cx="5" cy="5" r="5" fill="currentColor" />
                          <path d="M2.9 5.2l1.5 1.5 2.9-3.3" fill="none" stroke="#242629" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        복습 정답률 {accText == null ? '-' : `${Math.round(accText * 100)}%`}
                      </>
                    )}
                    <svg className="st-chev" width="5.33" height="9.33" viewBox="0 0 5.33 9.33" aria-hidden="true">
                      <path d="M.8.8l3.7 3.87L.8 8.53" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <div className="ms-bar">
                  <span className="new" style={{ width: `${(md.newItems / sm) * 100}%` }} />
                  <span className="rev" style={{ width: `${(md.reviews / sm) * 100}%` }} />
                </div>
                <p className="ms-legend">
                  {m === 'talk' ? '일반 문제' : '새 문제'} <b className="y">{md.newItems || '-'}</b> 복습 문제 <b className="b">{md.reviews || '-'}</b>
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="s-card habit">
        <span className="habit-icon">
          {/* 달력 아이콘 (직접 그림): 27 x 24.33 CSS px */}
          <svg width="27" height="24.33" viewBox="0 0 27 24.33" aria-hidden="true">
            <rect x="0" y="3.5" width="27" height="20.83" rx="3.4" fill="#5f5d80" />
            <path d="M0 6.9A3.4 3.4 0 0 1 3.4 3.5h20.2A3.4 3.4 0 0 1 27 6.9v3.4H0z" fill="#8a86b7" />
            <rect x="5.4" y="0" width="2.7" height="6.6" rx="1.35" fill="#b6b1e8" />
            <rect x="18.9" y="0" width="2.7" height="6.6" rx="1.35" fill="#b6b1e8" />
            <path d="M8.4 16l3.4 3.2 6.8-6.7" fill="none" stroke="#cdc7f6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
      <AmountChart byDate={byDate} today={today} />
    </>
  );
}

function Heatmap({ byDate, today }: { byDate: Map<string, DailyRow>; today: string }) {
  // 최근 52주를 26주씩 두 블록으로. 말해보카처럼 각 열은 월요일에서 시작해 일요일로 끝난다
  const end = shiftDate(today, (7 - dayOfWeek(today)) % 7);
  const start = shiftDate(end, -(52 * 7) + 1);
  const max = Math.max(1, ...[...byDate.values()].map((d) => dayTotal(d)));
  const level = (n: number) => (n <= 0 ? 0 : n < max * 0.25 ? 1 : n < max * 0.5 ? 2 : n < max * 0.75 ? 3 : 4);
  const blocks = [0, 1].map((b) =>
    Array.from({ length: 26 }, (_, w) => Array.from({ length: 7 }, (_, d) => shiftDate(start, (b * 26 + w) * 7 + d))),
  );
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="s-card heat">
      <div className="heat-head">
        <b>연간 학습</b>
        <span className="heat-pager">
          <svg className="st-tri" width="6" height="9.33" viewBox="0 0 6 9.33" aria-hidden="true">
            <path d="M6 0v9.33L0 4.67z" fill="currentColor" />
          </svg>
          <b>최근</b>
          <svg className="st-tri" width="6" height="9.33" viewBox="0 0 6 9.33" aria-hidden="true">
            <path d="M0 0v9.33l6-4.66z" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div className="heat-legend">
        <span className="less">Less</span>
        <i className="h1" />
        <i className="h2" />
        <i className="h3" />
        <i className="h4" />
        <span className="more">More</span>
      </div>
      {blocks.map((weeks, bi) => (
        <div key={bi} className="heat-block">
          <div className="heat-days">
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
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
                  <i key={d} className={`hc l${d > today ? 'x' : level(dayTotal(byDate.get(d)))}`} title={d} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Range = 'week' | 'month' | 'year' | 'all';
const RANGES: [Range, string][] = [
  ['week', '주'],
  ['month', '월'],
  ['year', '년'],
  ['all', '전체'],
];

/** 기간별 묶음: 주·월은 하루 단위, 년·전체는 달 단위 */
function periodKeys(range: Range, today: string, byDate: Map<string, DailyRow>): { label: string; dates: string[] }[] {
  if (range === 'week' || range === 'month') {
    const n = range === 'week' ? 7 : 30;
    return Array.from({ length: n }, (_, i) => {
      const d = shiftDate(today, i - (n - 1));
      return { label: d, dates: [d] };
    });
  }
  const months = new Map<string, string[]>();
  for (const d of byDate.keys()) months.set(d.slice(0, 7), [...(months.get(d.slice(0, 7)) ?? []), d]);
  const want = range === 'year' ? 12 : Math.max(months.size, 1);
  const list: string[] = [];
  let [y, m] = today.slice(0, 7).split('-').map(Number);
  for (let i = 0; i < want; i++) {
    list.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return list.map((k) => ({ label: k, dates: months.get(k) ?? [] }));
}

const RANGE_UNIT: Record<Range, string> = { week: '최근 한 주, 하루', month: '최근 한 달, 하루', year: '한 달', all: '한 달' };

function RangeSeg({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="seg-full">
      {RANGES.map(([k, l]) => (
        <button key={k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function TimeChart({ byDate, today }: { byDate: Map<string, DailyRow>; today: string }) {
  const [range, setRange] = useState<Range>('week');
  const points = periodKeys(range, today, byDate).map((p) => ({ label: p.label, ms: p.dates.reduce((s, d) => s + dayTime(byDate.get(d)), 0) }));
  const avg = points.reduce((s, p) => s + p.ms, 0) / Math.max(1, points.length);
  // 말해보카 실측: 그래프 상자 274 x 98.33 (CSS px), 세로 6칸·가로 4칸 격자, 첫·끝 점은 양쪽 테두리 위
  const W = 274;
  const H = 98.33;
  const max = Math.max(60_000, ...points.map((p) => p.ms));
  const xy = points.map((p, i) => [0.5 + (i * (W - 1)) / Math.max(1, points.length - 1), H - 0.5 - (p.ms / max) * (H - 10.5)] as const);
  const avgText = `${Math.floor(avg / 60000)}분 ${Math.round((avg % 60000) / 1000)}초`;

  return (
    <div className="s-card timechart">
      <RangeSeg value={range} onChange={setRange} />
      <b className="tc-title">학습 시간</b>
      <p className="tc-desc">
        {RANGE_UNIT[range]} 평균 학습 시간은 <em>{avgText}</em>예요.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="tc-svg" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={`v${i}`} x1={0.5 + (i * (W - 1)) / 6} x2={0.5 + (i * (W - 1)) / 6} y1={0} y2={H} className="tc-grid" />
        ))}
        {[0, 1, 2, 3, 4].map((j) => (
          <line key={`h${j}`} x1={0} x2={W} y1={0.5 + (j * (H - 1)) / 4} y2={0.5 + (j * (H - 1)) / 4} className="tc-grid" />
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

const AMOUNT_MODES: { key: SMode; label: string; color: string }[] = [
  { key: 'vocab', label: '어휘', color: '#9d81e8' },
  { key: 'grammar', label: '문법', color: '#74acd1' },
  { key: 'expr', label: '표현', color: '#df7f96' },
  { key: 'talk', label: '실전 회화', color: '#9fb864' },
  { key: 'listening', label: '리스닝', color: '#e59a5c' },
];

/** 학습량: 기간별 문제 수 막대 (모드별 색으로 쌓음) */
function AmountChart({ byDate, today }: { byDate: Map<string, DailyRow>; today: string }) {
  const [range, setRange] = useState<Range>('week');
  const points = periodKeys(range, today, byDate).map((p) => {
    const by = AMOUNT_MODES.map((m) => p.dates.reduce((s, d) => s + dayTotal(byDate.get(d), m.key), 0));
    return { label: p.label, by, total: by.reduce((s, n) => s + n, 0) };
  });
  const avg = Math.round(points.reduce((s, p) => s + p.total, 0) / Math.max(1, points.length));
  const max = Math.max(1, ...points.map((p) => p.total));
  const many = points.length > 7;
  const xLabel = (label: string) => (label === today ? '오늘' : range === 'week' ? WEEKDAYS_KO[dayOfWeek(label)] : '');

  return (
    <div className="s-card amount">
      <RangeSeg value={range} onChange={setRange} />
      <b className="tc-title">학습량</b>
      <p className="tc-desc">
        {RANGE_UNIT[range]} 평균 <em>{avg}개</em>의 문제를 풀었어요.
      </p>
      <ul className="am-legend">
        {AMOUNT_MODES.map((m) => (
          <li key={m.key}>
            <i style={{ background: m.color }} />
            {m.label}
          </li>
        ))}
      </ul>
      <div className={`am-bars ${many ? 'many' : ''}`}>
        {points.map((p) => (
          <div key={p.label} className="am-col">
            <div className="am-bar" style={{ height: `${(p.total / max) * 100}%` }}>
              {p.by.map((n, i) => (n > 0 ? <span key={AMOUNT_MODES[i].key} style={{ flex: n, background: AMOUNT_MODES[i].color }} /> : null))}
            </div>
          </div>
        ))}
      </div>
      {many ? (
        <div className="tc-range am-range">
          <span>{points[0]?.label.replace(/-/g, '.')}</span>
          <span className="em">{points[points.length - 1]?.label.replace(/-/g, '.')}</span>
        </div>
      ) : (
        <div className="am-x">
          {points.map((p) => (
            <span key={p.label} className={p.label === today ? 'today' : ''}>
              {xLabel(p.label)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- 학습별 ---------------- */

type SMode = Exclude<StudyMode, 'pairs'>;
const SMODE_LABEL: Record<SMode, string> = { vocab: '어휘', grammar: '문법', expr: '표현', talk: '실전 회화', listening: '리스닝' };
const MODE_ICON = { grammar: 'gbook', expr: 'chat', talk: 'talk', listening: 'headphones' } as const;

/** 어휘 외 모드의 하루 기록을 어휘와 같은 모양으로 */
function viewOf(d: DailyRow, mode: SMode, goal: number): DailyRow {
  if (mode === 'vocab') return d;
  const m = d.byMode?.[mode];
  return { date: d.date, total: m?.total ?? 0, newWords: m?.newItems ?? 0, reviews: m?.reviews ?? 0, correct: m?.correct ?? 0, timeMs: m?.timeMs ?? 0, knownNew: 0, goal };
}

function StudyModes({ daily, today, goals, imp }: { daily: DailyRow[]; today: string; goals: Record<SMode, number>; imp: ImportedProgress | null }) {
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
      <StudyTab key={mode} mode={mode} byDate={byDate} daily={rows} today={today} goal={goals[mode]} extra={imp?.stats?.[mode]} />
    </>
  );
}

type ResultKey = 'perfect' | 'second' | 'good' | 'nice';

function StudyTab({ mode, byDate, daily, today, goal, extra }: { mode: SMode; byDate: Map<string, DailyRow>; daily: DailyRow[]; today: string; goal: number; extra?: { trophies?: number; questions?: number; timeMs?: number } }) {
  const label = SMODE_LABEL[mode];
  const unit = mode === 'vocab' ? '단어' : mode === 'expr' ? '표현' : '문장';
  const [offset, setOffset] = useState(0);
  const trophies = daily.filter((d) => goalMet(d, goal)).length + (extra?.trophies ?? 0);
  const totalQ = daily.reduce((s, d) => s + d.total, 0) + (extra?.questions ?? 0);
  const totalTime = daily.reduce((s, d) => s + d.timeMs, 0) + (extra?.timeMs ?? 0);
  const end = shiftDate(today, -offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => shiftDate(end, i - 6));
  const rows = days.map((d) => byDate.get(d));
  const max = Math.max(5, ...rows.map((r) => r?.total ?? 0));
  const tot = (k: 'newWords' | 'reviews' | 'knownNew') => rows.reduce((s, r) => s + (r?.[k] ?? 0), 0);
  const newLearned = Math.max(0, tot('newWords') - tot('knownNew'));
  const reviewRows = rows.filter((r): r is DailyRow => !!r && r.total > 0);
  const accAll = reviewRows.length ? Math.round((reviewRows.reduce((s, r) => s + r.correct, 0) / reviewRows.reduce((s, r) => s + r.total, 0)) * 100) : null;
  const H = 150;
  /** 실전 회화·리스닝: 결과(Perfect/Excellent·Great/Good/Nice Try)별 막대 (말해보카) */
  const resultMode = mode === 'talk' || mode === 'listening';
  const resStat = useLiveQuery(async () => {
    if (!resultMode) return null;
    const logs = await db.reviews.where('studyDate').between(days[0], days[6], true, true).filter((r) => r.studyMode === mode).toArray();
    const cls = (r: ReviewRow): ResultKey => (r.showedAnswer ? 'nice' : r.firstTry ? 'perfect' : mode === 'listening' ? (r.hints === 1 ? 'second' : 'good') : r.wrongAttempts === 0 ? 'second' : 'good');
    const byDay = new Map<string, Record<ResultKey, number>>();
    for (const r of logs) {
      const m = byDay.get(r.studyDate) ?? { perfect: 0, second: 0, good: 0, nice: 0 };
      m[cls(r)] += 1;
      byDay.set(r.studyDate, m);
    }
    return byDay;
  }, [mode, days[0]]);
  const listenBest = useLiveQuery(async () => (mode === 'listening' ? ((await db.kv.get('listeningBest'))?.value as number | undefined) : undefined), [mode]);
  const KEYS: ResultKey[] = ['perfect', 'second', 'good', 'nice'];
  const resTot = (k: ResultKey) => days.reduce((n, d) => n + (resStat?.get(d)?.[k] ?? 0), 0);
  const secondLabel = mode === 'listening' ? 'Great' : 'Excellent';
  const totalWeek = resultMode ? KEYS.reduce((n, k) => n + resTot(k), 0) : tot('newWords') + tot('reviews');
  const resMax = Math.max(5, ...days.map((d) => KEYS.reduce((n, k) => n + (resStat?.get(d)?.[k] ?? 0), 0)));

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
            let segs: { h: number; c: string }[];
            if (resultMode) {
              const sc = (n: number) => (n / resMax) * H;
              const m = resStat?.get(days[i]);
              segs = [
                { h: sc(m?.nice ?? 0), c: 'var(--st-review)' },
                { h: sc(m?.good ?? 0), c: 'var(--st-known)' },
                { h: sc(m?.second ?? 0), c: 'var(--st-pink)' },
                { h: sc(m?.perfect ?? 0), c: 'var(--st-new)' },
              ];
            } else {
              const sc = (n: number) => (n / max) * H;
              const known = r?.knownNew ?? 0;
              const fresh = Math.max(0, (r?.newWords ?? 0) - known);
              segs =
                mode === 'vocab'
                  ? [
                      { h: sc(r?.reviews ?? 0), c: 'var(--st-review)' },
                      { h: sc(known), c: 'var(--st-known)' },
                      { h: sc(fresh), c: 'var(--st-new)' },
                    ]
                  : [
                      { h: sc(r?.reviews ?? 0), c: 'var(--st-review)' },
                      { h: sc(r?.newWords ?? 0), c: 'var(--st-new)' },
                    ];
            }
            let y = H;
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
          {!resultMode && (
            <>
              <polyline
                className="wk-line"
                points={rows
                  .map((r, i) => (r && r.total ? `${24 + i * 42},${8 + (1 - r.correct / r.total) * 60}` : null))
                  .filter(Boolean)
                  .join(' ')}
              />
              {rows.map((r, i) => (r && r.total ? <circle key={i} cx={24 + i * 42} cy={8 + (1 - r.correct / r.total) * 60} r={4} className="wk-dot" /> : null))}
            </>
          )}
        </svg>
        <div className="weekly-sum">
          <div className="ws-total">
            <span>Total</span>
            <b>{totalWeek}</b>
          </div>
          <ul>
            {resultMode ? (
              <>
                <li>
                  <i className="sw new" /> Perfect <b>{resTot('perfect') || '-'}</b>
                </li>
                <li>
                  <i className="sw pink" /> {secondLabel} <b>{resTot('second') || '-'}</b>
                </li>
                <li>
                  <i className="sw known" /> Good <b>{resTot('good') || '-'}</b>
                </li>
                <li>
                  <i className="sw review" /> Nice Try <b>{resTot('nice') || '-'}</b>
                </li>
                {mode === 'listening' && (
                  <li>
                    <i className="sw ring" /> 최고 레벨 <b>{listenBest ?? '-'}</b>
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <i className="sw new" /> 새로 배운 {unit} <b>{mode === 'vocab' ? newLearned : tot('newWords')}</b>
                </li>
                {mode === 'vocab' && (
                  <li>
                    <i className="sw known" /> 이미 아는 단어 <b>{tot('knownNew')}</b>
                  </li>
                )}
                <li>
                  <i className="sw review" /> 복습 {unit} <b>{tot('reviews')}</b>
                </li>
                <li>
                  <i className="sw ring" /> 복습 정답률 <i className="qmark">?</i> <b>{accAll == null ? '-' : `${accAll}%`}</b>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------------- 어휘력 ---------------- */

/** 어휘력 측정 결과: 측정일별 상위 % 꺾은선 (말해보카: ‹ 전체 › + 날짜 알약 + 선택 점에 세로 막대) */
function VocabHistoryChart({ history, imp }: { history: { date: string; vocab: number; level?: number }[]; imp: ImportedProgress | null }) {
  const pts = [...history].sort((a, b) => a.date.localeCompare(b.date)).map((h) => ({ ...h, pct: imp && h.vocab === imp.vocabSize && imp.percentile != null ? imp.percentile : percentileOf(h.vocab) }));
  const [sel, setSel] = useState(pts.length - 1);
  const cur = pts[Math.min(sel, pts.length - 1)];
  const W = 300;
  const H = 150;
  const pad = 26;
  const vals = pts.map((p) => p.pct);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals, lo + 0.01);
  const x = (i: number) => (pts.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (pts.length - 1));
  const y = (v: number) => pad + ((v - lo) / (hi - lo)) * (H - pad * 2);
  return (
    <div className="s-card vh-card">
      <div className="card-head-row">
        <b className="card-title">어휘력 측정 결과</b>
        <span className="nb-date">
          <button disabled>‹</button>
          <b>전체</b>
          <button disabled>›</button>
        </span>
      </div>
      <div className="vh-pill">{cur.date.replace(/-/g, '.')}</div>
      <svg className="vh-chart" viewBox={`0 0 ${W} ${H}`} aria-label="어휘력 측정 결과 차트">
        <rect x={x(sel) - 7} y={pad - 10} width={14} height={H - pad - 4} rx={5} className="vh-bar" />
        <polyline points={pts.map((p, i) => `${x(i)},${y(p.pct)}`).join(' ')} className="vh-line" />
        {pts.map((p, i) => (
          <g key={p.date} onClick={() => setSel(i)}>
            <circle cx={x(i)} cy={y(p.pct)} r={5} className={`vh-dot ${i === sel ? 'sel' : ''}`} />
            {(i === 0 || i === pts.length - 1 || i === sel) && (
              <text x={x(i)} y={y(p.pct) - 11} textAnchor="middle" className="vh-label">
                {p.pct}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="vh-axis">
        <span>{pts[0].date.replace(/-/g, '.')}</span>
        <span>{pts[pts.length - 1].date.replace(/-/g, '.')}</span>
      </div>
      <p className="vh-note">
        {cur.vocab.toLocaleString()} 개 · 상위 {cur.pct} %{cur.level != null ? ` · 레벨 ${cur.level}` : ''}
      </p>
    </div>
  );
}

function VocabTab({ level, imp }: { level: number; imp: ImportedProgress | null }) {
  const nav = useNavigate();
  const comp = useLiveQuery(() => comprehension(), []);
  const testDate = useLiveQuery(async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
  const measured = useLiveQuery(() => latestMeasure(imp), [imp?.asOf]);
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
  const hist = useLiveQuery(async () => ((await db.kv.get('vocabHistory'))?.value as { date: string; vocab: number; level?: number }[] | undefined) ?? [], []);
  const history = [...(imp?.vocabHistory ?? []), ...(hist ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const vocabNow = measured?.vocab ?? displayVocab(level, comp ?? null, imp, testDate);
  // 레벨 테스트 기록이 없으면 들여온 이해도
  const compShown = measured ? measured.comprehension : testDate && (!imp || testDate > imp.asOf) ? (comp ?? null) : (imp?.comprehension ?? comp ?? null);
  const pct = measured ? measured.percentile : imp?.percentile != null && vocabNow === imp.vocabSize ? imp.percentile : percentileOf(vocabNow);
  const dt = measured ? `${measured.date} 측정` : vocabDateText(imp, testDate);
  const dateText = dt ? dt.replace(/^(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => `${y}년 ${Number(m)}월 ${Number(d)}일`) : '측정 전';

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
          <b className="laurel">{vocabNow.toLocaleString()} 개</b>
          <span>나의 어휘 이해도</span>
          <b className="laurel">{compShown == null ? '-' : `${(compShown * 100).toFixed(2)} %`}</b>
          <span>나의 어휘력은 대한민국</span>
          <b className="laurel">{pct} %</b>
        </div>
      </section>
      {history.length > 0 && <VocabHistoryChart history={history} imp={imp} />}
      <button className="measure-btn" onClick={() => nav('/measure')}>
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

