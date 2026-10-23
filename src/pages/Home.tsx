import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExtraStudySheet from '../components/ExtraStudySheet';
import ModeStart from '../components/ModeStart';
import GaugeRing from '../components/GaugeRing';
import GoalModal from '../components/GoalModal';
import Icon, { type IconName } from '../components/Icon';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { saveSettings, useSettings } from '../lib/settings';
import { getImported, importedRange, inRange, type DayRange } from '../lib/imported';
import { comprehension, computeStreak, dayTime, dayTotal, displayVocab, goalMet, reviewAccuracy, studied, vocabDateText } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatClock, shiftDate, studyDateOf, weekOf } from '../lib/time';
import type { DailyRow, StudyMode } from '../types';

const STREAK_GOALS = [7, 14, 30, 50, 100, 150, 200, 300, 365, 500, 700, 1000, 1500, 2000];
const MODE_TABS: { key: string; icon: IconName; label: string; mode?: StudyMode }[] = [
  { key: 'grammar', icon: 'gbook', label: '문법', mode: 'grammar' },
  { key: 'expr', icon: 'chat', label: '표현', mode: 'expr' },
  { key: 'talk', icon: 'talk', label: '실전 회화', mode: 'talk' },
  { key: 'listen', icon: 'headphones', label: '리스닝', mode: 'listening' },
];
const MODE_TITLE: Record<string, string> = { vocab: '어휘 학습', grammar: '문법 학습', listening: '리스닝 학습', expr: '표현 학습', talk: '실전 회화 학습' };
const HOME_MODES: StudyMode[] = ['vocab', 'grammar', 'listening', 'expr', 'talk'];
const BAR_MODES: [StudyMode, string][] = [
  ['vocab', '#9d86ef'],
  ['grammar', '#6eb0e8'],
  ['expr', '#ec6f86'],
  ['talk', '#8fbf4d'],
  ['listening', '#f39a4b'],
];

export default function Home() {
  const nav = useNavigate();
  const settings = useSettings();
  const today = studyDateOf();
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const imp = useLiveQuery(() => getImported(), []);
  const homeMode: StudyMode = settings && HOME_MODES.includes(settings.homeMode) ? settings.homeMode : 'vocab';
  const acc = useLiveQuery(() => reviewAccuracy(7, new Date(), homeMode), [homeMode]);
  const [start, setStart] = useState<StudyMode | null>(null);
  const comp = useLiveQuery(() => comprehension(), []);
  const testDate = useLiveQuery(async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
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
  const vocabTotal = t?.total ?? 0;
  const total = homeMode === 'vocab' ? vocabTotal : (t?.byMode?.[homeMode]?.total ?? 0);
  const goal = homeMode === 'grammar' ? settings.grammarGoal : homeMode === 'listening' ? settings.listeningGoal : homeMode === 'expr' ? settings.exprGoal : homeMode === 'talk' ? settings.talkGoal : settings.dailyGoal;
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
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <Icon name="list" size={26} />
          <span>{settings.nickname}</span>
        </button>
        <button className="head-bell" onClick={() => showToast('새 알림이 없어요')} aria-label="알림">
          <Icon name="bell" size={26} />
        </button>
      </header>
      {toast && <div className="home-toast">{toast}</div>}

      <StreakCard today={today} byDate={byDate} goal={settings.dailyGoal} streak={streak ?? 0} range={importedRange(imp)} />

      <section className="main-card">
        <div className="main-body">
          {met && (
            <span className="ribbon">
              <Icon name="trophy" size={22} />
            </span>
          )}
          <div className="main-mascot">
            <Mascot size={150} mood={met ? 'cheer' : 'happy'} />
          </div>
          <div className="main-row">
            <div className="main-text">
              <Link to="/stats" className="acc-line">
                <Icon name="shield" size={14} /> 복습 정답률 {acc == null ? '-' : `${Math.round(acc * 100)}%`} <Icon name="chevron" size={12} />
              </Link>
              <h2>{MODE_TITLE[homeMode]}</h2>
              <button className="goal-line-btn" onClick={() => setGoalOpen(true)}>
                하루 목표 <b>{goal}</b> 개 <Icon name="pencil" size={15} />
              </button>
            </div>
            <GaugeRing value={total / goal} label={String(pct)} />
          </div>
          <button
            className={`today-btn m-${homeMode}`}
            onClick={() =>
              homeMode === 'vocab'
                ? met
                  ? setExtraOpen(true)
                  : nav('/quiz')
                : homeMode === 'expr'
                  ? nav(met ? `/expr/quiz?target=${total + 15}` : '/expr/quiz')
                  : homeMode === 'talk'
                    ? nav('/talk')
                    : setStart(homeMode)
            }
          >
            <Icon name={met ? 'star' : 'book'} size={24} />
            {homeMode === 'vocab' ? (met ? '추가 어휘' : '오늘의 어휘') : met ? '추가 학습' : '오늘의 학습'}
          </button>
        </div>
        <div className="mode-tabs">
          <button className={`mode-tab vocab ${homeMode === 'vocab' ? 'active' : ''}`} onClick={() => void saveSettings({ homeMode: 'vocab' })} aria-label="어휘 학습">
            <Icon name="bookPerson" size={30} />
          </button>
          {MODE_TABS.map((m) => (
            <button
              key={m.key}
              className={`mode-tab ${m.key} ${m.mode && homeMode === m.mode ? 'active' : ''}`}
              onClick={() => m.mode && void saveSettings({ homeMode: m.mode })}
              aria-label={m.label}
            >
              <Icon name={m.icon} size={26} />
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
          <Icon name="chevron" size={18} className="muted-ic" />
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
            <Icon name="trophy" size={22} />
          </span>
          <div className="power-text">
            <p>
              어휘력 약 <em>{displayVocab(settings.level ?? 10, comp ?? null, imp, testDate).toLocaleString()}</em>개
            </p>
            <span>{vocabDateText(imp, testDate) ?? '아직 측정하지 않았어요'}</span>
          </div>
          <Icon name="chevron" size={18} className="muted-ic" />
        </Link>
        <button className="power-btn" onClick={() => nav('/test')}>
          지금 측정가능
        </button>
      </section>

      <section className="info-card icon-grid">
        <GridItem to="/dict" icon="dict" label="사전" />
        <GridItem to="/wrongs" icon="note" label="오답노트" tint="red" />
        <GridItem to="/words" icon="hourglass" label="학습한 어휘" tint="teal" />
        <GridItem to="/favorites" icon="heartFill" label="좋아하는 문장" tint="pink" />
      </section>

      {goalOpen && (
        <GoalModal
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
      {extraOpen && <ExtraStudySheet todayTotal={total} onClose={() => setExtraOpen(false)} onStart={(target) => nav(`/quiz?target=${target}`)} />}
    </div>
  );
}

function StreakCard({ today, byDate, goal, streak, range }: { today: string; byDate: Map<string, DailyRow>; goal: number; streak: number; range: DayRange | null }) {
  const week = weekOf(today);
  const did = (d: string) => studied(byDate.get(d)) || inRange(range, d);
  const alive = did(today) || did(shiftDate(today, -1));
  const inRun = (d: string) => d <= today && (did(d) || (d === today && alive));
  const target = STREAK_GOALS.find((g) => g > streak) ?? streak + 100;
  return (
    <Link to="/stats" className="streak-card">
      <span className="flame-big">
        <Icon name="flame" size={44} />
      </span>
      <div className="streak-main">
        <div className="streak-top">
          <p className="streak-text">
            연속 학습 <b>{streak}</b>일
          </p>
          <span className="streak-goal">
            <Icon name="ruby" size={16} /> 내 목표 <b>{target}</b>일
          </span>
          <Icon name="chevron" size={18} className="muted-ic" />
        </div>
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
                {goalMet(row, goal) || (!row && inRange(range, d)) ? (
                  <span className="stamp gold">
                    <Icon name="trophy" size={16} />
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
      <Icon name={icon} size={34} />
      <span>{label}</span>
    </Link>
  );
}
