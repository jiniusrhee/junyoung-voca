import { useLiveQuery } from 'dexie-react-hooks';
import { GRAMMAR_BOOKMARKS, getFolders } from '../lib/folders';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import ModeStart from '../components/ModeStart';
import { db } from '../db';
import { modeToday } from '../lib/modeStudy';
import { useSettings } from '../lib/settings';
import { getTalkProgress } from '../lib/talk';
import { studyDateOf } from '../lib/time';
import type { StudyMode } from '../types';

type Chip = 'vocab' | 'grammar' | 'expr' | 'talk' | 'listening';
const CHIPS: [Chip, string][] = [
  ['vocab', '어휘'],
  ['grammar', '문법'],
  ['expr', '표현'],
  ['talk', '실전 회화'],
  ['listening', '리스닝'],
];

/** 말해보카 '전체 학습' 탭 */
export default function AllLearning() {
  const nav = useNavigate();
  const settings = useSettings();
  const [params, setParams] = useSearchParams();
  const chip = (params.get('mode') as Chip) || 'vocab';
  const [start, setStart] = useState<StudyMode | null>(null);
  const counts = useLiveQuery(
    async () => ({
      fav: await db.favorites.count(),
      wrongs: await db.reviews.filter((r) => (r.wrongs?.length ?? 0) > 0 && !r.studyMode).count(),
      learned: await db.cards.count(),
      wordbook: await db.kv.get('wordbook').then((r) => ((r?.value as string[] | undefined) ?? []).length),
      gLearned: await db.mcards.where('mode').equals('grammar').count(),
      gMarks: (await getFolders(GRAMMAR_BOOKMARKS)).length,
      lLearned: await db.mcards.where('mode').equals('listening').count(),
      lMarks: await db.bookmarks.where('mode').equals('listening').count(),
      vToday: (await db.daily.get(studyDateOf()))?.total ?? 0,
      gToday: (await modeToday('grammar')).total,
      lToday: (await modeToday('listening')).total,
      eLearned: await db.mcards.where('mode').equals('expr').count(),
      eToday: (await modeToday('expr')).total,
      tToday: (await modeToday('talk')).total,
      course: settings?.exprCourse ? (await db.ecourses.get(settings.exprCourse))?.title : (await db.ecourses.orderBy('order').first())?.title,
      story: await lastStory(),
      saved: await db.kv.get('myExpressions').then((r) => ((r?.value as unknown[] | undefined) ?? []).length),
    }),
    [settings?.exprCourse],
  );
  if (!settings) return null;

  return (
    <div className="screen all-learning">
      <header className="home-head">
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <MenuGlyph />
          <span>{settings.nickname}</span>
        </button>
        <button className="head-bell" onClick={() => nav('/inbox')} aria-label="알림함">
          <BellGlyph />
        </button>
      </header>

      <h2 className="al-title">학습 모드</h2>
      <div className="al-chips">
        {CHIPS.map(([k, l]) => (
          <button key={k} className={`al-chip ${chip === k ? 'active' : ''}`} onClick={() => setParams({ mode: k }, { replace: true })}>
            {l}
          </button>
        ))}
      </div>

      {chip === 'vocab' && (
        <>
          <ModeCard color="voca" title="어휘 학습" sub={<>하루 목표 <strong className="mc-num">{settings.dailyGoal}</strong> 개 <Icon name="pencil" size={13} className="mc-pen" /></>} done={(counts?.vToday ?? 0) >= settings.dailyGoal} onPlay={() => ((counts?.vToday ?? 0) >= settings.dailyGoal ? setStart('vocab') : nav('/quiz'))} />
          <ul className="al-list">
            <Row to="/favorites" icon="heartFill" tint="pink" label="내가 좋아하는 문장" />
            <Row to="/wrongs" icon="xcircle" tint="plain" label="내가 좋아하는 오답노트" />
            <Row to="/words" icon="hourglass" tint="teal" label="내가 학습한 어휘" />
            <Row to="/wordbook" icon="bookmark" tint="blue" label="내 단어장" />
          </ul>
        </>
      )}
      {chip === 'grammar' && (
        <>
          <ModeCard color="grammar" title="문법 학습" sub={<>하루 목표 <strong className="mc-num">{settings.grammarGoal}</strong> 개 <Icon name="pencil" size={13} className="mc-pen" /></>} done={(counts?.gToday ?? 0) >= settings.grammarGoal} onPlay={() => setStart('grammar')} />
          <ul className="al-list">
            <Row to="/learned/grammar" icon="hourglass" tint="teal" label="내가 학습한 문법" />
            <Row to="/bookmarks/grammar" icon="bookmark" tint="blue" label="북마크" />
          </ul>
        </>
      )}
      {chip === 'expr' && (
        <>
          <ModeCard
            color="expr"
            title="표현 학습"
            beta
            sub={
              <>
                학습 코스 <i className="sep">|</i> {counts?.course ?? '코스 선택'} <Icon name="pencil" size={13} className="mc-pen" />
              </>
            }
            done={(counts?.eToday ?? 0) >= settings.exprGoal}
            onPlay={() => nav('/expr')}
          />
          <ul className="al-list">
            <Row to="/learned/expr" icon="hourglass" tint="teal" label="내가 학습한 표현" count={counts?.eLearned} />
          </ul>
        </>
      )}
      {chip === 'talk' && (
        <>
          <ModeCard
            color="talk"
            title="실전 회화 학습"
            beta
            sub={
              <>
                스토리 <i className="sep">|</i> {counts?.story ?? '스토리 선택'}
              </>
            }
            done={(counts?.tToday ?? 0) >= settings.talkGoal}
            onPlay={() => nav('/talk')}
          />
          <ul className="al-list">
            <Row to="/talk/recent" icon="hourglass" tint="teal" label="최근 학습한 에피소드" />
            <Row to="/talk/saved" icon="bookmark" tint="blue" label="내가 추가한 표현" count={counts?.saved} />
          </ul>
        </>
      )}
      {chip === 'listening' && (
        <>
          <ModeCard
            color="listen"
            title="리스닝 학습"
            sub={
              <>
                하루 목표 <strong className="mc-num">{settings.listeningGoal}</strong> 개 <Icon name="pencil" size={13} className="mc-pen" /> <i className="sep">|</i> {settings.listeningSpeed === 'slow' ? '듣기 평가 속도' : '실전 속도'} <Icon name="pencil" size={13} className="mc-pen" />
              </>
            }
            done={(counts?.lToday ?? 0) >= settings.listeningGoal}
            onPlay={() => setStart('listening')}
          />
          <ul className="al-list">
            <Row to="/learned/listening" icon="hourglass" tint="teal" label="내가 학습한 문장" count={counts?.lLearned} />
            <Row to="/bookmarks/listening" icon="bookmark" tint="blue" label="북마크" count={counts?.lMarks} />
          </ul>
        </>
      )}

      <div className="al-sep" />
      <h2 className="al-title">사전</h2>
      <ul className="al-list">
        <Row to="/dict" icon="search" tint="blue" label="단어 사전" />
        <Row to="/grammar-dict" icon="search" tint="salmon" label="문법 사전" />
      </ul>

      <h2 className="al-title">기타</h2>
      <ul className="al-list">
        <Row to="/pairs" icon="mic" tint="purple" label="발음 구분 연습" />
        <Row to="/guide" icon="note" tint="pink" label="사용 설명서" />
      </ul>
      {start && <ModeStart mode={start} onClose={() => setStart(null)} />}
    </div>
  );
}

async function lastStory(): Promise<string | undefined> {
  const prog = await getTalkProgress();
  const stories = await db.tstories.orderBy('order').toArray();
  let best: { t: number; title: string } | null = null;
  for (const st of stories) {
    const t = Math.max(0, ...st.episodes.map((e) => prog[e.id]?.ts ?? 0));
    if (t > 0 && (!best || t > best.t)) best = { t, title: st.title };
  }
  return best?.title ?? stories[0]?.title;
}

function ModeCard({ color, title, sub, beta, done, onPlay }: { color: string; title: string; sub: React.ReactNode; beta?: boolean; done?: boolean; onPlay: () => void }) {
  return (
    <button className={`mode-card ${color}`} onClick={onPlay}>
      {done && <Ribbon />}
      <span className="mode-card-text">
        <b>
          {title} {beta && <sup>beta</sup>}
        </b>
        <span>{sub}</span>
      </span>
      <span className="mode-card-play">
        <Icon name="play" size={33} />
      </span>
    </button>
  );
}

function Row({ to, icon, label, tint, count }: { to: string; icon: IconName; label: string; tint: string; count?: number }) {
  return (
    <li>
      <Link to={to} className="al-row">
        <span className={`al-icon ${tint}`}>
          <Icon name={icon} size={20} />
        </span>
        <span className="al-label">{label}</span>
        {count != null && count > 0 && <span className="al-count">{count}</span>}
        <Icon name="chevron" size={17} className="muted-ic" />
      </Link>
    </li>
  );
}

/** 헤더 ☰ (말해보카 실측: 14.5×13.3, 선 굵기 2) */
function MenuGlyph() {
  return (
    <svg width="14.5" height="13.4" viewBox="0 0 14.5 13.4" fill="currentColor" aria-hidden="true">
      <rect width="14.5" height="2" rx="0.3" />
      <rect y="5.7" width="14.5" height="2" rx="0.3" />
      <rect y="11.4" width="14.5" height="2" rx="0.3" />
    </svg>
  );
}

/** 헤더 🔔 (18.3×19, 노란색) */
function BellGlyph() {
  return (
    <svg width="18.3" height="19" viewBox="0 0 18.3 19" fill="currentColor" aria-hidden="true">
      <circle cx="9.15" cy="1.3" r="1.3" />
      <path d="M9.15 2C5.2 2 2.75 5 2.75 8.6v4L0 15.3v.9h18.3v-.9l-2.75-2.7v-4C15.55 5 13.1 2 9.15 2z" />
      <path d="M6.4 17.1a2.75 1.9 0 0 0 5.5 0z" />
    </svg>
  );
}

/** 하루 목표 달성 트로피 리본 (직접 그린 것: 32×40, 아래 가운데 홈 4.3px, 흰 트로피 18×14.3) */
function Ribbon() {
  return (
    <svg className="mode-card-ribbon" width="32" height="42" viewBox="0 0 32 42" aria-hidden="true">
      <defs>
        <filter id="al-ribbon-shadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>
      <path d="M0 0h32v40l-16-4.3L0 40z" fill="#deba4a" filter="url(#al-ribbon-shadow)" />
      <g transform="translate(7 12.85)" fill="#fff">
        <path d="M3.2 0h11.6v4.6a5.8 5.8 0 0 1-11.6 0z" />
        <path d="M3.2 1.6H1.1A1.1 1.1 0 0 0 0 2.7v1.3a3.8 3.8 0 0 0 3.6 3.8M14.8 1.6h2.1A1.1 1.1 0 0 1 18 2.7v1.3a3.8 3.8 0 0 1-3.6 3.8" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7.9 10.2h2.2v1.8H7.9z" />
        <path d="M5 12h8a.9.9 0 0 1 .9.9v.5a.9.9 0 0 1-.9.9H5a.9.9 0 0 1-.9-.9v-.5A.9.9 0 0 1 5 12z" />
      </g>
    </svg>
  );
}
