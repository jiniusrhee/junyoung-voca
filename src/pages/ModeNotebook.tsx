import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { listenPool } from '../lib/listening';
import { speak } from '../lib/speech';
import { shiftDate, studyDateOf } from '../lib/time';
import type { ReviewRow, StudyMode } from '../types';

interface Sent {
  id: string;
  en: string;
  ko: string;
  sub?: string;
}

const TITLE: Partial<Record<StudyMode, string>> = { grammar: '내가 학습한 문법', listening: '내가 학습한 문장' };

async function resolve(mode: StudyMode, ids: string[]): Promise<Sent[]> {
  if (mode === 'grammar') {
    const topics = new Map((await db.gtopics.toArray()).map((t) => [t.id, t]));
    const rows = await db.gsentences.bulkGet(ids);
    return rows.filter((s): s is NonNullable<typeof s> => !!s).map((s) => ({ id: s.id, en: s.en, ko: s.ko, sub: topics.get(s.topic)?.title }));
  }
  const pool = new Map((await listenPool()).map((p) => [p.id, p]));
  return ids.map((id) => pool.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ id: p.id, en: p.en, ko: p.ko, sub: `레벨 ${p.level}` }));
}

/** 그날 학습한 문장 */
async function dailyRows(mode: StudyMode, date: string) {
  const logs = (await db.reviews.where('studyDate').equals(date).filter((r) => r.studyMode === mode).toArray()).sort((a, b) => a.ts - b.ts);
  const ids = [...new Set(logs.map((l) => l.wordId))];
  const sents = await resolve(mode, ids);
  return sents.map((s) => ({ s, logs: logs.filter((l) => l.wordId === s.id) }));
}

/** 최근에 틀린 문장 (최신순, 최대 30) */
async function wrongRows(mode: StudyMode) {
  const logs = await db.reviews
    .orderBy('ts')
    .reverse()
    .filter((r) => r.studyMode === mode && (!r.firstTry || r.showedAnswer))
    .limit(300)
    .toArray();
  const ids = [...new Set(logs.map((l) => l.wordId))].slice(0, 30);
  const sents = await resolve(mode, ids);
  return ids.map((id) => sents.find((s) => s.id === id)).filter((s): s is Sent => !!s).map((s) => ({ s, logs: logs.filter((l) => l.wordId === s.id) }));
}

export function logText(l: ReviewRow): string {
  if (l.showedAnswer) return '정답 보기';
  if (l.firstTry) return '한 번에 정답';
  return `오답 ${l.wrongAttempts}번`;
}

/** 내가 학습한 문법: 메뉴 (말해보카: 일별 학습 문장 / 최근에 틀린 문장) */
export function ModeLearnedMenu() {
  const nav = useNavigate();
  const { mode = 'grammar' } = useParams();
  const m = mode as StudyMode;
  const counts = useLiveQuery(async () => ({ daily: (await dailyRows(m, studyDateOf())).length, wrong: (await wrongRows(m)).length }), [m]);
  return (
    <div className="screen sub">
      <SubHeader title={TITLE[m] ?? '내가 학습한 문장'} />
      <ul className="lw-menu">
        {(
          [
            ['daily', '일별 학습 문장'],
            ['wrong', '최근에 틀린 문장'],
          ] as const
        ).map(([k, label]) => (
          <li key={k}>
            <button className="menu-row" onClick={() => nav(`/learned/${m}/${k}`)}>
              <span className="menu-icon purple soft">
                <Icon name="gbook" size={22} />
              </span>
              <span className="menu-text">
                <b>{label}</b>
              </span>
              <span className="lw-count">{counts?.[k] ?? 0}</span>
              <Icon name="chevron" size={18} className="muted-ic" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 일별 학습 문장 / 최근에 틀린 문장 목록 */
export default function ModeNotebook() {
  const nav = useNavigate();
  const { mode = 'grammar', kind = 'daily' } = useParams();
  const m = mode as StudyMode;
  const today = studyDateOf();
  const [date, setDate] = useState(today);
  const [koFirst, setKoFirst] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rows = useLiveQuery(() => (kind === 'wrong' ? wrongRows(m) : dailyRows(m, date)), [m, kind, date]);
  const label = date === today ? '오늘' : date === shiftDate(today, -1) ? '어제' : date.slice(2).replace(/-/g, '.');
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="vs-page lw-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> {kind === 'wrong' ? '최근에 틀린 문장' : '일별 학습 문장'}
        </button>
        <label className="vs-help">
          학습 기록
          <input type="checkbox" checked={showLog} onChange={(e) => setShowLog(e.target.checked)} />
          <span className="toggle" />
        </label>
      </header>
      <div className="nb-filters">
        <button className="chip-btn" onClick={() => setKoFirst((v) => !v)}>
          {koFirst ? '뜻 먼저 보기' : '영어 먼저 보기'} ▾
        </button>
        {kind === 'daily' && (
          <span className="nb-date">
            <button onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="이전 날">
              ‹
            </button>
            <b>{label}</b>
            <button onClick={() => setDate((d) => (d < today ? shiftDate(d, 1) : d))} aria-label="다음 날" disabled={date >= today}>
              ›
            </button>
          </span>
        )}
      </div>
      {rows && rows.length === 0 && (
        <div className="lw-empty">
          <Icon name="info" size={26} />
          <p>표시할 문장이 없어요.</p>
        </div>
      )}
      <div className="lw-list">
        {(rows ?? []).map(({ s, logs }) => {
          const shown = open.has(s.id);
          return (
            <div key={s.id} className="lw-card">
              <button className="lw-body" onClick={() => toggle(s.id)}>
                {koFirst ? (
                  <>
                    <span className="lw-ko">{s.ko}</span>
                    {shown ? <b className="lw-en">{s.en}</b> : <span className="lw-reveal">탭해서 영어 보기</span>}
                  </>
                ) : (
                  <>
                    <b className="lw-en">{s.en}</b>
                    {shown ? <span className="lw-ko">{s.ko}</span> : <span className="lw-reveal">탭해서 뜻 보기</span>}
                  </>
                )}
                {s.sub && <span className="lw-log">{s.sub}</span>}
                {showLog && logs.length > 0 && <span className="lw-log">{logs.map(logText).join(' · ')}</span>}
              </button>
              <button className="lw-more" onClick={() => speak(s.en)} aria-label="듣기">
                <Icon name="speaker" size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
