import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExtraStudySheet from '../components/ExtraStudySheet';
import ModeStart from '../components/ModeStart';
import GaugeRing from '../components/GaugeRing';
import GoalModal, { MODE_PRESETS, VOCAB_PRESETS } from '../components/GoalModal';
import Icon from '../components/Icon';
import { HBadge, HBell, HBookOpen, HChevron, HCoin, HDict, HFlag, HFlame, HGear, HHeart, HLearned, HNote, HPencil, HStar, HTabExpr, HTabGrammar, HTabListen, HTabTalk, HTabVocab, HTodayMark, HTrophy } from '../components/HomeIcons';
import KoText from '../components/KoText';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { saveSettings, useSettings } from '../lib/settings';
import { useCachedQuery, useKeptQuery } from '../lib/liveCache';
import { isNativeApp, nativeNotifyRequest } from '../lib/nativeNotify';
import { getImported, importedRange, inRange, type DayRange } from '../lib/imported';
import { STREAK_GOALS } from './Streak';
import { comprehension, computeStreak, dayTime, dayTotal, displayVocab, getRepairedDays, goalMet, reviewAccuracy, studied, vocabDateText, percentileOf, latestMeasure, daySolved } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, formatClock, shiftDate, studyDateOf } from '../lib/time';
import type { ImportedProgress, DailyRow, StudyMode } from '../types';

const MODE_TABS: { key: string; icon: ReactNode; label: string; mode?: StudyMode }[] = [
  { key: 'grammar', icon: <HTabGrammar />, label: '문법', mode: 'grammar' },
  { key: 'expr', icon: <HTabExpr />, label: '표현', mode: 'expr' },
  { key: 'talk', icon: <HTabTalk />, label: '실전 회화', mode: 'talk' },
  { key: 'listen', icon: <HTabListen />, label: '리스닝', mode: 'listening' },
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
/** 홈 어휘력 카드: 들여온 백분위가 있으면 그대로, 아니면 어휘 수로 추정 (말해보카: '어휘력 상위 0.25%') */
function homePct(level: number, comp: number | null, imp: ImportedProgress | null, testDate: string | undefined): string {
  const v = displayVocab(level, comp, imp, testDate);
  return imp?.percentile != null && v === imp.vocabSize ? String(imp.percentile) : String(percentileOf(v));
}

export default function Home() {
  const nav = useNavigate();
  const settings = useSettings();
  const today = studyDateOf();
  // 홈으로 돌아올 때 한 프레임에 다 보이도록: 하루 기록은 계속 들고 있고, 나머지는 지난번 값을 먼저 쓴다
  const daily = useKeptQuery('daily', () => db.daily.toArray());
  const streak = useCachedQuery('streak', () => computeStreak(), []);
  const imp = useCachedQuery('imported', () => getImported(), []);
  const repaired = useCachedQuery('repaired', () => getRepairedDays(), []);
  const homeMode: StudyMode = settings && HOME_MODES.includes(settings.homeMode) ? settings.homeMode : 'vocab';
  const acc = useCachedQuery(`acc:${homeMode}`, () => reviewAccuracy(7, new Date(), homeMode), [homeMode]);
  const [start, setStart] = useState<StudyMode | null>(null);
  const comp = useCachedQuery('comprehension', () => comprehension(), []);
  const testDate = useCachedQuery('levelTestDate', async () => (await db.kv.get('levelTestDate'))?.value as string | undefined, []);
  const measured = useCachedQuery(`measured:${imp?.asOf ?? ''}`, () => latestMeasure(imp ?? null), [imp?.asOf]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  /**
   * 앱을 켠 뒤 처음 홈이 뜰 때의 순서 (말해보카 60fps 녹화 실측 2026-11-11, 홈이 보인 순간 기준):
   * +0.13초 마스코트, +0.28~0.90초 고리 숫자가 0 에서 차오름, +0.33초 리본이 위에서 내려옴(0.15초),
   * +0.47초 환영 토스트가 0.2초 동안 나타나고 +2.97초에 0.12초 동안 위로 사라진다.
   * 탭을 오가며 홈으로 돌아올 때는 이 순서 없이 한 번에 다 보인다.
   */
  const [intro] = useState(() => !sessionStorage.getItem('welcomed'));
  // 앱(APK)에서는 시스템 스플래시 아이콘이 0.25초쯤 걷히는 동안 홈이 가려져 있으므로 그만큼 늦게 시작한다
  const lag = intro && isNativeApp() ? 250 : 0;
  const [toast, setToast] = useState<'in' | 'out' | null>(null);
  const ready = !!settings;
  useEffect(() => {
    if (!ready || !intro) return;
    sessionStorage.setItem('welcomed', '1');
    const timers = [window.setTimeout(() => setToast('in'), 467 + lag), window.setTimeout(() => setToast('out'), 2967 + lag), window.setTimeout(() => setToast(null), 3100 + lag)];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [ready, intro, lag]);
  // '오늘' 막대: 학습 정보 카드가 화면에 다 들어왔을 때(하단 탭 위) 한 번 자라난다. 홈에 들어올 때마다 다시.
  const studyRef = useRef<HTMLAnchorElement>(null);
  const [todayBar, setTodayBar] = useState(false);
  useEffect(() => {
    const el = studyRef.current;
    if (!el || todayBar) return;
    if (typeof IntersectionObserver === 'undefined') {
      setTodayBar(true);
      return;
    }
    const io = new IntersectionObserver((es) => es.some((e) => e.intersectionRatio >= 0.999) && setTodayBar(true), { threshold: 1, rootMargin: '0px 0px -53.333px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [ready, todayBar]);
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
    <div className={`screen home ${intro ? 'intro' : ''}`} style={lag ? ({ '--lag': `${lag}ms` } as CSSProperties) : undefined}>
      {toast && (
        <div className={`home-toast ${toast}`}>
          <em>
            <KoText text={`'${settings.nickname}'`} />
          </em>{' '}
          님 환영합니다.
        </div>
      )}
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
          {/* 학습 알림 켜고 끄기 (말해보카: 카드 오른쪽 위 알약. 꺼져 있으면 회색 종 + OFF) */}
          <button
            className={`notify-pill ${settings.notifyStudy ? 'on' : ''}`}
            aria-label={settings.notifyStudy ? '학습 알림 끄기' : '학습 알림 켜기'}
            onClick={() => {
              const on = !settings.notifyStudy;
              void saveSettings({ notifyStudy: on });
              if (on && isNativeApp()) void nativeNotifyRequest().catch(() => undefined);
              else if (on && typeof Notification !== 'undefined') void Notification.requestPermission().catch(() => undefined);
            }}
          >
            <span className="np-knob">
              <HBell />
            </span>
            <span className="np-text" lang="en">
              {settings.notifyStudy ? 'ON' : 'OFF'}
            </span>
          </button>
          <div className="main-mascot">
            <Mascot size={72} mood={met ? 'cheer' : 'happy'} />
          </div>
          <div className="main-row" key={homeMode}>
            <div className="main-text">
              <Link to="/stats" className="acc-line">
                <HBadge />
                <span>복습 정답률</span>
                <span lang="en">{acc == null ? '-' : `${Math.round(acc * 100)}%`}</span>
                <svg className="acc-chev" width="4" height="6.667" viewBox="0 0 4 6.667" aria-hidden="true">
                  <polyline points="0.650,0.650 3.350,3.333 0.650,6.017" fill="none" stroke="currentColor" strokeWidth="1.200" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <h2>{MODE_TITLE[homeMode]}</h2>
              <button className="goal-line-btn" onClick={() => setGoalOpen(true)}>
                하루 목표 <b lang="en">{goal}</b> 개 <HPencil />
              </button>
            </div>
            <GaugeRing percent={pct} size={63.333} stroke={5} intro={intro} introLag={lag} />
          </div>
          {/* 턱(아래 그림자)은 움직이지 않는 받침으로 그리고 버튼 면만 내려앉는다 — 면·그림·빛줄기의 움직임이 모두 같은 박자로 돌게 transform 만 쓴다 */}
          <div className={`today-seat m-${homeMode}`}>
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
              <span className={`btn-ic ${met ? 'spin' : ''}`}>{met ? <HStar /> : <HBookOpen />}</span>
              {homeMode === 'vocab' ? (met ? '추가 어휘' : '오늘의 어휘') : met ? '추가 학습' : '오늘의 학습'}
            </button>
          </div>
        </div>
        <div className="mode-tabs">
          <button className={`mode-tab vocab ${homeMode === 'vocab' ? 'active' : ''}`} onClick={() => void saveSettings({ homeMode: 'vocab' })} aria-label="어휘 학습">
            <HTabVocab />
          </button>
          {MODE_TABS.filter((m) => !settings.homeTabs || !m.mode || settings.homeTabs.includes(m.mode)).map((m) => (
            <button
              key={m.key}
              className={`mode-tab ${m.key} ${m.mode && homeMode === m.mode ? 'active' : ''}`}
              onClick={() => m.mode && void saveSettings({ homeMode: m.mode })}
              aria-label={m.label}
            >
              {m.icon}
            </button>
          ))}
          <button className="mode-gear" onClick={() => nav('/settings')} aria-label="설정">
            <HGear />
          </button>
        </div>
      </section>

      <Link to="/stats" className="info-card study-card" ref={studyRef}>
        <div className="info-card-head">
          <h3>학습 정보</h3>
          <HChevron />
        </div>
        <ul className="mode-legend">
          <li className="m-voca">어휘</li>
          <li className="m-grammar">문법</li>
          <li className="m-expr">표현</li>
          <li className="m-talk">실전 회화</li>
          <li className="m-listen">리스닝</li>
        </ul>
        <WeekBars days={last7} byDate={byDate} today={today} grown={todayBar} />
        <div className="time-row">
          <span>시간</span>
          <b lang="en">{formatClock(dayTime(t))}</b>
          <i />
          <span>문제</span>
          <b lang="en">{dayTotal(t)}</b>
        </div>
      </Link>

      <section className="info-card power-card">
        <Link to="/stats?tab=vocab" className="power-head">
          <span className="power-icon">
            <HTrophy />
          </span>
          <div className="power-text">
            <p>
              어휘력 상위{' '}
              <em lang="en">
                {measured ? measured.percentile : homePct(settings.level ?? 10, comp ?? null, imp ?? null, testDate)}
                <i>%</i>
              </em>
            </p>
            <small>
              <KoText text={measured ? `${measured.date} 측정 결과` : (vocabDateText(imp, testDate)?.replace(/측정$/, '측정 결과') ?? '아직 측정하지 않았어요')} />
            </small>
          </div>
          <HChevron />
        </Link>
        <button className="power-btn" onClick={() => nav('/measure')}>
          지금 측정가능
        </button>
      </section>

      {/* 실제 앱의 이 줄은 상점·도전과제·사전·내 단어장. 상점·도전과제는 만들지 않으므로 그 자리에 학습한 어휘·오답노트를 둔다 (사전·내 단어장은 같은 자리) */}
      <section className="info-card icon-grid">
        <GridItem to="/words" label="학습한 어휘">
          <HLearned />
        </GridItem>
        <GridItem to="/wrongs" label="오답노트">
          <HNote />
        </GridItem>
        <GridItem to="/dict" label="사전">
          <HDict />
        </GridItem>
        <GridItem to="/wordbook" label="내 단어장">
          <HHeart />
        </GridItem>
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
        <HFlame off={!did(today)} />
      </span>
      <div className="streak-main">
        <div className="streak-top">
          <p className="streak-text">
            연속 학습 <b lang="en">{streak}</b>일
          </p>
          <span className="streak-goal">
            <HFlag /> 내 목표{' '}
            <b>
              <span lang="en">{target}</span>일
            </b>
          </span>
          <HChevron />
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
                    <HCoin />
                  </span>
                ) : did(d) ? (
                  <span className="stamp star">
                    <Icon name="star" size={16} />
                  </span>
                ) : (
                  <span className="stamp">{WEEKDAYS_KO[dayOfWeek(d)]}</span>
                )}
                {d === today && <HTodayMark />}
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

function WeekBars({ days, byDate, today, grown }: { days: string[]; byDate: Map<string, DailyRow>; today: string; grown: boolean }) {
  const max = Math.max(1, ...days.map((d) => dayTotal(byDate.get(d))));
  return (
    <div className="week-bars">
      {days.map((d) => {
        const row = byDate.get(d);
        return (
          <div key={d} className="wb-col">
            <div className="wb-track">
              <div className={`wb-stack ${d === today ? (grown ? 'grow' : 'wait') : ''}`} style={{ height: `${(dayTotal(row) / max) * 100}%` }}>
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

function GridItem({ to, label, children }: { to: string; label: string; children: ReactNode }) {
  return (
    <Link to={to} className="grid-item">
      <span className="grid-ic">{children}</span>
      <span>{label}</span>
    </Link>
  );
}
