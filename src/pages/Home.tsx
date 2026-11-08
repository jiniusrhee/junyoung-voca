import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExtraStudySheet from '../components/ExtraStudySheet';
import ModeStart from '../components/ModeStart';
import GaugeRing from '../components/GaugeRing';
import GoalModal, { MODE_PRESETS, VOCAB_PRESETS } from '../components/GoalModal';
import Icon, { type IconName } from '../components/Icon';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { saveSettings, useSettings } from '../lib/settings';
import { getImported, importedRange, inRange, type DayRange } from '../lib/imported';
import { STREAK_GOALS } from './Streak';
import { comprehension, computeStreak, dayTime, dayTotal, displayVocab, getRepairedDays, goalMet, reviewAccuracy, studied, vocabDateText, percentileOf, latestMeasure, daySolved } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatClock, shiftDate, studyDateOf } from '../lib/time';
import type { ImportedProgress, DailyRow, StudyMode } from '../types';

const MODE_TABS: { key: string; icon: IconName; label: string; mode?: StudyMode }[] = [
  { key: 'grammar', icon: 'gbook', label: '문법', mode: 'grammar' },
  { key: 'expr', icon: 'chat', label: '표현', mode: 'expr' },
  { key: 'talk', icon: 'talk', label: '실전 회화', mode: 'talk' },
  { key: 'listen', icon: 'headphones', label: '리스닝', mode: 'listening' },
];
const MODE_TITLE: Record<string, string> = { vocab: '어휘 학습', grammar: '문법 학습', listening: '리스닝 학습', expr: '표현 학습', talk: '실전 회화 학습' };
const HOME_MODES: StudyMode[] = ['vocab', 'grammar', 'listening', 'expr', 'talk'];
// 말해보카 홈 '학습 정보' 범례·막대 색 (플립 다크 모드 캡처 실측)
const BAR_MODES: [StudyMode, string][] = [
  ['vocab', '#9d81e9'],
  ['grammar', '#74acd1'],
  ['expr', '#df7f96'],
  ['talk', '#9fb864'],
  ['listening', '#f3a25f'],
];

/* 머리글·연속 학습 카드 전용 그림 (말해보카 실측 크기: ☰ 15x13.3, 🔔 18.7x19.3, 불꽃 42x51) */
function MenuGlyph() {
  return (
    <svg width="15" height="13.333" viewBox="0 0 15 13.333" aria-hidden="true">
      <rect y="0" width="15" height="1.667" rx="0.6" fill="currentColor" />
      <rect y="5.833" width="15" height="1.667" rx="0.6" fill="currentColor" />
      <rect y="11.666" width="15" height="1.667" rx="0.6" fill="currentColor" />
    </svg>
  );
}
function BellGlyph() {
  return (
    <svg width="18.667" height="19.333" viewBox="0 0 28 29" aria-hidden="true">
      <path d="M14 1.5a2 2 0 0 1 2 2v1A9 9 0 0 1 23 13.5v6l2.6 3.4c.6.8 0 1.9-1 1.9H3.4c-1 0-1.6-1.1-1-1.9L5 19.5v-6a9 9 0 0 1 7-9v-1a2 2 0 0 1 2-2z" fill="currentColor" />
      <path d="M10.5 26h7a3.5 3.5 0 0 1-7 0z" fill="currentColor" />
    </svg>
  );
}
function FlameGlyph({ off }: { off: boolean }) {
  return off ? (
    <svg width="42" height="51" viewBox="0 0 42 51" aria-hidden="true">
      <path d="M21 3c-7 11-16 19-16 29a16 16 0 0 0 32 0C37 22 28 14 21 3z" fill="currentColor" />
    </svg>
  ) : (
    <svg width="42" height="51" viewBox="0 0 42 51" aria-hidden="true">
      <path d="M21.5 1c2.5 9 11.5 14 15 24 3.5 11-2 25-15 25C8 50 1.5 40 2.5 30c.7-7.5 5.5-12 8.5-17 .8 5 3 8 6 8.5C15 15 17.5 7 21.5 1z" fill="currentColor" />
      <path d="M21 23c5 6 9 10 9 16 0 5.5-4 9-9 9s-9-3.5-9-9c0-6 4-10 9-16z" fill="#f9be76" />
    </svg>
  );
}

/** 홈 어휘력 카드: 들여온 백분위가 있으면 그대로, 아니면 어휘 수로 추정 (말해보카: '어휘력 상위 0.25%') */
function homePct(level: number, comp: number | null, imp: ImportedProgress | null, testDate: string | undefined): string {
  const v = displayVocab(level, comp, imp, testDate);
  return imp?.percentile != null && v === imp.vocabSize ? String(imp.percentile) : String(percentileOf(v));
}

export default function Home() {
  const nav = useNavigate();
  const settings = useSettings();
  const today = studyDateOf();
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const imp = useLiveQuery(() => getImported(), []);
  const repaired = useLiveQuery(() => getRepairedDays(), []);
  const homeMode: StudyMode = settings && HOME_MODES.includes(settings.homeMode) ? settings.homeMode : 'vocab';
  const acc = useLiveQuery(() => reviewAccuracy(7, new Date(), homeMode), [homeMode]);
  const [start, setStart] = useState<StudyMode | null>(null);
  const comp = useLiveQuery(() => comprehension(), []);
  const testDate = useLiveQuery(async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
  const measured = useLiveQuery(() => latestMeasure(imp ?? null), [imp?.asOf]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 앱을 열 때 한 번 환영 인사 (말해보카 홈과 같게)
  useEffect(() => {
    if (!settings || sessionStorage.getItem('welcomed')) return;
    sessionStorage.setItem('welcomed', '1');
    setToast(`'${settings.nickname}' 님 환영합니다.`);
    window.setTimeout(() => setToast(null), 2200);
  }, [settings]);
  if (!settings) return null;

  const byDate = new Map((daily ?? []).map((d) => [d.date, d]));
  const t = byDate.get(today);
  const vocabTotal = daySolved(t);
  const total = homeMode === 'vocab' ? vocabTotal : (t?.byMode?.[homeMode]?.total ?? 0);
  const goal = homeMode === 'grammar' ? settings.grammarGoal : homeMode === 'listening' ? settings.listeningGoal : homeMode === 'expr' ? settings.exprGoal : homeMode === 'talk' ? settings.talkGoal : settings.dailyGoal;
  const pct = Math.round((total / goal) * 100);
  const met = total >= goal;
  const last7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6));

  return (
    <div className="screen home">
      {toast && <div className="home-toast">{toast}</div>}
      <header className="home-head">
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <MenuGlyph />
          <span>{settings.nickname}</span>
        </button>
        <button className="head-bell" onClick={() => nav('/inbox')} aria-label="알림함">
          <BellGlyph />
        </button>
      </header>

      <StreakCard today={today} byDate={byDate} goal={settings.dailyGoal} streak={streak ?? 0} range={importedRange(imp)} target={settings.streakGoal} repaired={repaired} />

      <section className="main-card">
        <div className="main-body">
          {met && (
            <span className="ribbon">
              <Icon name="trophy" size={30} />
            </span>
          )}
          <div className="main-mascot">
            <Mascot size={72} mood={met ? 'cheer' : 'happy'} />
          </div>
          <div className="main-row">
            <div className="main-text">
              <Link to="/stats" className="acc-line">
                <Icon name="shield" size={12} /> 복습 정답률 {acc == null ? '-' : `${Math.round(acc * 100)}%`} <Icon name="chevron" size={11} />
              </Link>
              <h2>{MODE_TITLE[homeMode]}</h2>
              <button className="goal-line-btn" onClick={() => setGoalOpen(true)}>
                하루 목표 <b>{goal}</b> 개 <Icon name="pencil" size={14} />
              </button>
            </div>
            <GaugeRing value={total / goal} label={String(pct)} size={63.333} stroke={6.5} />
          </div>
          <button
            className={`today-btn m-${homeMode}`}
            onClick={() =>
              homeMode === 'vocab'
                ? setExtraOpen(true)
                : homeMode === 'expr'
                  ? nav(met ? `/expr/quiz?target=${total + 15}` : '/expr/quiz')
                  : homeMode === 'talk'
                    ? nav('/talk')
                    : setStart(homeMode)
            }
          >
            <Icon name={met ? 'star' : 'book'} size={22} />
            {homeMode === 'vocab' ? (met ? '추가 어휘' : '오늘의 어휘') : met ? '추가 학습' : '오늘의 학습'}
          </button>
        </div>
        <div className="mode-tabs">
          <button className={`mode-tab vocab ${homeMode === 'vocab' ? 'active' : ''}`} onClick={() => void saveSettings({ homeMode: 'vocab' })} aria-label="어휘 학습">
            <Icon name="bookPerson" size={28} />
          </button>
          {MODE_TABS.filter((m) => !settings.homeTabs || !m.mode || settings.homeTabs.includes(m.mode)).map((m) => (
            <button
              key={m.key}
              className={`mode-tab ${m.key} ${m.mode && homeMode === m.mode ? 'active' : ''}`}
              onClick={() => m.mode && void saveSettings({ homeMode: m.mode })}
              aria-label={m.label}
            >
              <Icon name={m.icon} size={25} />
            </button>
          ))}
          <button className="mode-gear" onClick={() => nav('/settings')} aria-label="설정">
            <Icon name="gear" size={26} />
          </button>
        </div>
      </section>

      <Link to="/stats" className="info-card study-card">
        <div className="info-card-head">
          <h3>학습 정보</h3>
          <Icon name="chevron" size={20} className="muted-ic" />
        </div>
        <ul className="mode-legend">
          <li className="m-voca">어휘</li>
          <li className="m-grammar">문법</li>
          <li className="m-expr">표현</li>
          <li className="m-talk">실전 회화</li>
          <li className="m-listen">리스닝</li>
        </ul>
        <WeekBars days={last7} byDate={byDate} today={today} />
        <div className="time-row">
          <span>시간</span>
          <b>{formatClock(dayTime(t))}</b>
          <i />
          <span>문제</span>
          <b>{dayTotal(t)}</b>
        </div>
      </Link>

      <section className="info-card power-card">
        <Link to="/stats?tab=vocab" className="power-head">
          <span className="power-icon">
            <Icon name="trophy" size={20} />
          </span>
          <div className="power-text">
            <p>
              어휘력 상위 <em>{measured ? measured.percentile : homePct(settings.level ?? 10, comp ?? null, imp ?? null, testDate)}%</em>
            </p>
            <span>{measured ? `${measured.date} 측정 결과` : (vocabDateText(imp, testDate)?.replace(/측정$/, '측정 결과') ?? '아직 측정하지 않았어요')}</span>
          </div>
          <Icon name="chevron" size={20} className="muted-ic" />
        </Link>
        <button className="power-btn" onClick={() => nav('/measure')}>
          지금 측정가능
        </button>
      </section>

      <section className="info-card icon-grid">
        <GridItem to="/dict" icon="dict" label="사전" />
        <GridItem to="/wordbook" icon="heartFill" label="내 단어장" tint="pink" />
        <GridItem to="/wrongs" icon="note" label="오답노트" tint="red" />
        <GridItem to="/words" icon="hourglass" label="학습한 어휘" tint="teal" />
      </section>

      {goalOpen && (
        <GoalModal
          presets={homeMode === 'vocab' ? VOCAB_PRESETS : MODE_PRESETS}
          current={goal}
          onClose={() => setGoalOpen(false)}
          onSave={(n) => {
            void saveSettings(
              homeMode === 'grammar' ? { grammarGoal: n } : homeMode === 'listening' ? { listeningGoal: n } : homeMode === 'expr' ? { exprGoal: n } : homeMode === 'talk' ? { talkGoal: n } : { dailyGoal: n },
            );
            setGoalOpen(false);
          }}
        />
      )}
      {start && <ModeStart mode={start} onClose={() => setStart(null)} />}
      {extraOpen && <ExtraStudySheet todayTotal={total} goal={goal} met={met} onClose={() => setExtraOpen(false)} onStart={(target) => nav(`/quiz?target=${target}`)} />}
    </div>
  );
}

function StreakCard({ today, byDate, goal, streak, range, target: manual, repaired }: { today: string; byDate: Map<string, DailyRow>; goal: number; streak: number; range: DayRange | null; target?: number; repaired?: Set<string> }) {
  // 말해보카(플립 360px 폭 실측): 지난 5일 + 오늘 + 내일 = 7칸 (오늘 아래 ▲, 목표 달성 🏆, 학습만 한 날 ★, 안 한 날·미래는 요일 글자)
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 5));
  const did = (d: string) => studied(byDate.get(d)) || inRange(range, d) || !!repaired?.has(d);
  const alive = did(today) || did(shiftDate(today, -1));
  const inRun = (d: string) => d <= today && (did(d) || (d === today && alive));
  const target = manual ?? (STREAK_GOALS.find((g) => g > streak) ?? streak + 100);
  return (
    <Link to="/streak" className="streak-card">
      <span className={`flame-big ${did(today) ? '' : 'off'}`}>
        <FlameGlyph off={!did(today)} />
      </span>
      <div className="streak-main">
        <div className="streak-top">
          <p className="streak-text">
            연속 학습 <b>{streak}</b>일
          </p>
          <span className="streak-goal">
            <Icon name="ruby" size={15} /> 내 목표 <b>{target}일</b>
          </span>
          <Icon name="chevron" size={20} className="muted-ic" />
        </div>
        <div className="week-row">
          {week.map((d, i) => {
            const on = inRun(d);
            const prev = i > 0 && inRun(week[i - 1]);
            const nextOn = i < week.length - 1 && inRun(week[i + 1]);
            const row = byDate.get(d);
            const cls = ['day', on ? 'on' : '', on && !prev ? 'start' : '', on && !nextOn ? 'end' : '', d === today ? 'today' : '', d > today ? 'future' : '']
              .filter(Boolean)
              .join(' ');
            return (
              <span key={d} className={cls}>
                {goalMet(row, goal) || (!row && inRange(range, d)) ? (
                  <span className="stamp gold">
                    <Icon name="trophy" size={18} />
                  </span>
                ) : did(d) ? (
                  <span className="stamp star">
                    <Icon name="star" size={16} />
                  </span>
                ) : (
                  <span className="stamp">{WEEKDAYS_KO[dayOfWeek(d)]}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

function WeekBars({ days, byDate, today }: { days: string[]; byDate: Map<string, DailyRow>; today: string }) {
  const max = Math.max(1, ...days.map((d) => dayTotal(byDate.get(d))));
  return (
    <div className="week-bars">
      {days.map((d) => {
        const row = byDate.get(d);
        return (
          <div key={d} className="wb-col">
            <div className="wb-track">
              <div className="wb-stack" style={{ height: `${(dayTotal(row) / max) * 100}%` }}>
                {BAR_MODES.map(([m, c]) => {
                  const n = dayTotal(row, m);
                  return n > 0 ? <span key={m} className="wb-fill" style={{ flexGrow: n, background: c }} /> : null;
                })}
              </div>
            </div>
            <span className={`wb-x ${d === today ? 'today' : ''}`}>{d === today ? '오늘' : WEEKDAYS_KO[dayOfWeek(d)]}</span>
          </div>
        );
      })}
    </div>
  );
}

function GridItem({ to, icon, label, tint }: { to: string; icon: IconName; label: string; tint?: string }) {
  return (
    <Link to={to} className={`grid-item ${tint ?? ''}`}>
      <Icon name={icon} size={30} />
      <span>{label}</span>
    </Link>
  );
}
