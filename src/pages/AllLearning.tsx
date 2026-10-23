import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import ModeStart from '../components/ModeStart';
import { db } from '../db';
import { modeToday } from '../lib/modeStudy';
import { useSettings } from '../lib/settings';
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
  const [toast, setToast] = useState<string | null>(null);
  const counts = useLiveQuery(
    async () => ({
      fav: await db.favorites.count(),
      wrongs: await db.reviews.filter((r) => (r.wrongs?.length ?? 0) > 0 && !r.studyMode).count(),
      learned: await db.cards.count(),
      wordbook: await db.kv.get('wordbook').then((r) => ((r?.value as string[] | undefined) ?? []).length),
      gLearned: await db.mcards.where('mode').equals('grammar').count(),
      gMarks: await db.bookmarks.where('mode').equals('grammar').count(),
      lLearned: await db.mcards.where('mode').equals('listening').count(),
      lMarks: await db.bookmarks.where('mode').equals('listening').count(),
      vToday: (await db.daily.get(studyDateOf()))?.total ?? 0,
      gToday: (await modeToday('grammar')).total,
      lToday: (await modeToday('listening')).total,
    }),
    [],
  );
  if (!settings) return null;
  const soon = (m: string) => {
    setToast(`${m} 학습은 준비 중이에요`);
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="screen all-learning">
      <header className="home-head">
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <Icon name="list" size={26} />
          <span>{settings.nickname}</span>
        </button>
        <span className="head-bell">
          <Icon name="bell" size={26} />
        </span>
      </header>
      {toast && <div className="home-toast">{toast}</div>}

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
          <ModeCard color="voca" title="어휘 학습" sub={<>하루 목표 {settings.dailyGoal} 개 <Icon name="pencil" size={13} /></>} done={(counts?.vToday ?? 0) >= settings.dailyGoal} onPlay={() => ((counts?.vToday ?? 0) >= settings.dailyGoal ? setStart('vocab') : nav('/quiz'))} />
          <ul className="al-list">
            <Row to="/favorites" icon="heartFill" tint="pink" label="내가 좋아하는 문장" count={counts?.fav} />
            <Row to="/wrongs" icon="xcircle" tint="plain" label="내 오답노트" count={counts?.wrongs} />
            <Row to="/words" icon="hourglass" tint="teal" label="내가 학습한 어휘" count={counts?.learned} />
            <Row to="/wordbook" icon="bookmark" tint="blue" label="내 단어장" count={counts?.wordbook} />
          </ul>
        </>
      )}
      {chip === 'grammar' && (
        <>
          <ModeCard color="grammar" title="문법 학습" sub={<>하루 목표 {settings.grammarGoal} 개 <Icon name="pencil" size={13} /></>} done={(counts?.gToday ?? 0) >= settings.grammarGoal} onPlay={() => setStart('grammar')} />
          <ul className="al-list">
            <Row to="/learned/grammar" icon="hourglass" tint="teal" label="내가 학습한 문법" count={counts?.gLearned} />
            <Row to="/bookmarks/grammar" icon="bookmark" tint="blue" label="북마크" count={counts?.gMarks} />
          </ul>
        </>
      )}
      {chip === 'expr' && (
        <>
          <ModeCard color="expr" title="표현 학습" beta sub="학습 코스 | 준비 중" onPlay={() => soon('표현')} />
          <p className="al-soon">표현 학습 화면은 실제 앱 화면을 확인한 뒤 만들 예정이에요.</p>
        </>
      )}
      {chip === 'talk' && (
        <>
          <ModeCard color="talk" title="실전 회화 학습" beta sub="스토리 | 준비 중" onPlay={() => soon('실전 회화')} />
          <p className="al-soon">실전 회화 화면은 실제 앱 화면을 확인한 뒤 만들 예정이에요.</p>
        </>
      )}
      {chip === 'listening' && (
        <>
          <ModeCard
            color="listen"
            title="리스닝 학습"
            sub={
              <>
                하루 목표 {settings.listeningGoal} 개 <Icon name="pencil" size={13} /> <i className="sep">|</i> {settings.listeningSpeed === 'slow' ? '듣기 평가 속도' : '실전 속도'} <Icon name="pencil" size={13} />
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

      <div className="al-sep" />
      <h2 className="al-title">기타</h2>
      <ul className="al-list">
        <Row to="/pairs" icon="mic" tint="purple" label="발음 구분 연습" />
        <Row to="/guide" icon="note" tint="pink" label="사용 설명서" />
      </ul>
      {start && <ModeStart mode={start} onClose={() => setStart(null)} />}
    </div>
  );
}

function ModeCard({ color, title, sub, beta, done, onPlay }: { color: string; title: string; sub: React.ReactNode; beta?: boolean; done?: boolean; onPlay: () => void }) {
  return (
    <button className={`mode-card ${color}`} onClick={onPlay}>
      {done && (
        <span className="mode-card-ribbon">
          <Icon name="trophy" size={20} />
        </span>
      )}
      <span className="mode-card-text">
        <b>
          {title} {beta && <sup>beta</sup>}
        </b>
        <span>{sub}</span>
      </span>
      <span className="mode-card-play">
        <Icon name="play" size={34} />
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
        <Icon name="chevron" size={18} className="muted-ic" />
      </Link>
    </li>
  );
}
