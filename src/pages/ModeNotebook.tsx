import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { listenPool } from '../lib/listening';
import { GRAMMAR_BOOKMARKS, folderItems, toggleInFolder } from '../lib/folders';
import { toggleBookmark } from '../lib/modeStudy';
import { speak } from '../lib/speech';
import { shiftDate, studyDateOf } from '../lib/time';
import type { GrammarTopic, ReviewRow, StudyMode } from '../types';

interface Sent {
  id: string;
  en: string;
  ko: string;
  topic?: GrammarTopic;
}
interface Row {
  s: Sent;
  logs: ReviewRow[];
  /** 그룹 날짜 (최근에 틀린 목록) */
  date: string;
  lapses?: number;
}
interface TopicRow {
  topic: GrammarTopic;
  wrong: boolean;
  date: string;
}
type Kind = 'tdaily' | 'twrong' | 'daily' | 'wrong' | 'most';
type Hide = 'ko' | 'en' | 'none';
type Filter = 'all' | 'wrong';

/** 말해보카 '내가 학습한 문법' 메뉴 5개 */
const KINDS: { kind: Kind; label: string; topic?: boolean }[] = [
  { kind: 'tdaily', label: '일별 학습 문법', topic: true },
  { kind: 'twrong', label: '최근에 틀린 문법', topic: true },
  { kind: 'daily', label: '일별 학습 문장' },
  { kind: 'wrong', label: '최근에 틀린 문장' },
  { kind: 'most', label: '역대 가장 많이 틀린 문장' },
];
const TITLE: Partial<Record<StudyMode, string>> = { grammar: '내가 학습한 문법', listening: '내가 학습한 문장' };
const HIDE_OPTS: { v: Hide; label: string; desc: string[] }[] = [
  { v: 'ko', label: '뜻 먼저 보기', desc: ['뜻을 보고 영어 문장을 생각해 보세요.', '탭하면 영어 문장을 볼 수 있어요.'] },
  { v: 'en', label: '영어 먼저 보기', desc: ['영어 문장을 보고 뜻을 생각해 보세요.', '탭하면 뜻을 볼 수 있어요.'] },
  { v: 'none', label: '가리지 않기', desc: ['영어 문장과 뜻 모두 가리지 않아요.'] },
];
const SENT_FILTER: { v: Filter; label: string }[] = [
  { v: 'all', label: '모든 문장 보기' },
  { v: 'wrong', label: '틀린 문장만 보기' },
];
const TOPIC_FILTER: { v: Filter; label: string }[] = [
  { v: 'all', label: '모든 문법 보기' },
  { v: 'wrong', label: '틀린 문법만 보기' },
];
const MAX_RECENT = 30;

const isWrong = (l: ReviewRow) => !l.firstTry || l.showedAnswer;

async function resolve(mode: StudyMode, ids: string[]): Promise<Map<string, Sent>> {
  const out = new Map<string, Sent>();
  if (mode === 'grammar') {
    const topics = new Map((await db.gtopics.toArray()).map((t) => [t.id, t]));
    for (const s of await db.gsentences.bulkGet(ids)) if (s) out.set(s.id, { id: s.id, en: s.en, ko: s.ko, topic: topics.get(s.topic) });
    return out;
  }
  const pool = new Map((await listenPool()).map((p) => [p.id, p]));
  for (const id of ids) {
    const p = pool.get(id);
    if (p) out.set(id, { id: p.id, en: p.en, ko: p.ko });
  }
  return out;
}

/** 그날 학습한 문장 (학습 순서) */
async function dailyRows(mode: StudyMode, date: string): Promise<Row[]> {
  const logs = (await db.reviews.where('studyDate').equals(date).filter((r) => r.studyMode === mode).toArray()).sort((a, b) => a.ts - b.ts);
  const ids = [...new Set(logs.map((l) => l.wordId))];
  const sents = await resolve(mode, ids);
  return ids.flatMap((id) => {
    const s = sents.get(id);
    return s ? [{ s, logs: logs.filter((l) => l.wordId === id), date }] : [];
  });
}

/** 최근에 틀린 문장 (최신순, 최대 30) — 그룹 날짜는 마지막으로 틀린 날 */
async function wrongRows(mode: StudyMode): Promise<Row[]> {
  const logs = await db.reviews
    .orderBy('ts')
    .reverse()
    .filter((r) => r.studyMode === mode && isWrong(r))
    .limit(400)
    .toArray();
  const ids = [...new Set(logs.map((l) => l.wordId))].slice(0, MAX_RECENT);
  const sents = await resolve(mode, ids);
  return ids.flatMap((id) => {
    const s = sents.get(id);
    const mine = logs.filter((l) => l.wordId === id);
    return s ? [{ s, logs: mine, date: mine[0].studyDate }] : [];
  });
}

/** 역대 가장 많이 틀린 문장 (틀린 횟수 순, 최대 30) */
async function mostRows(mode: StudyMode): Promise<Row[]> {
  const cards = (await db.mcards.where('mode').equals(mode).toArray()).filter((c) => c.lapses > 0).sort((a, b) => b.lapses - a.lapses);
  const top = cards.slice(0, MAX_RECENT);
  const sents = await resolve(mode, top.map((c) => c.itemId));
  return top.flatMap((c) => {
    const s = sents.get(c.itemId);
    return s ? [{ s, logs: [], date: '', lapses: c.lapses }] : [];
  });
}

/** 문장 목록 → 문법 주제 목록 (처음 나온 순서, 틀린 문장이 있으면 ❗) */
function topicsOf(rows: Row[]): TopicRow[] {
  const out: TopicRow[] = [];
  for (const r of rows) {
    const topic = r.s.topic;
    if (!topic) continue;
    const hit = out.find((t) => t.topic.id === topic.id && t.date === r.date);
    const wrong = r.logs.some(isWrong) || (r.lapses ?? 0) > 0;
    if (hit) hit.wrong ||= wrong;
    else out.push({ topic, wrong, date: r.date });
  }
  return out;
}

async function listOf(mode: StudyMode, kind: Kind, date: string) {
  const none = { topics: [] as TopicRow[], rows: [] as Row[] };
  if (kind === 'tdaily') return { ...none, topics: topicsOf(await dailyRows(mode, date)) };
  if (kind === 'twrong') return { ...none, topics: topicsOf(await wrongRows(mode)).slice(0, MAX_RECENT) };
  if (kind === 'wrong') return { ...none, rows: await wrongRows(mode) };
  if (kind === 'most') return { ...none, rows: await mostRows(mode) };
  return { ...none, rows: await dailyRows(mode, date) };
}

export function logText(l: ReviewRow): string {
  if (l.showedAnswer) return '정답 보기';
  if (l.firstTry) return '한 번에 정답';
  return `오답 ${l.wrongAttempts}번`;
}

/** 내가 학습한 문법: 메뉴 (말해보카: 일별 학습 문법 / 최근에 틀린 문법 / 일별 학습 문장 / 최근에 틀린 문장 / 역대 가장 많이 틀린 문장) */
export function ModeLearnedMenu() {
  const nav = useNavigate();
  const { mode = 'grammar' } = useParams();
  const m = mode as StudyMode;
  const today = studyDateOf();
  const counts = useLiveQuery(async () => {
    const out: Partial<Record<Kind, number>> = {};
    for (const k of KINDS) {
      const r = await listOf(m, k.kind, today);
      out[k.kind] = k.topic ? r.topics.length : r.rows.length;
    }
    return out;
  }, [m, today]);
  return (
    <div className="screen sub">
      <SubHeader title={TITLE[m] ?? '내가 학습한 문장'} />
      <ul className="lw-menu">
        {KINDS.filter((k) => m === 'grammar' || !k.topic).map((k) => (
          <li key={k.kind}>
            <button className="menu-row" onClick={() => nav(`/learned/${m}/${k.kind}`)}>
              <span className="menu-icon blue soft">
                <Icon name="gbook" size={22} />
              </span>
              <span className="menu-text">
                <b>{k.label}</b>
              </span>
              <span className="lw-count">{counts?.[k.kind] ?? 0}</span>
              <Icon name="chevron" size={18} className="muted-ic" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 일별 학습 문법·문장 / 최근에 틀린 문법·문장 / 역대 가장 많이 틀린 문장 */
export default function ModeNotebook() {
  const nav = useNavigate();
  const { mode = 'grammar', kind = 'daily' } = useParams();
  const m = mode as StudyMode;
  const k = (KINDS.some((x) => x.kind === kind) ? kind : 'daily') as Kind;
  const meta = KINDS.find((x) => x.kind === k)!;
  const today = studyDateOf();
  const [date, setDate] = useState(today);
  const [hide, setHide] = useState<Hide>('ko');
  const [filter, setFilter] = useState<Filter>('all');
  const [showLog, setShowLog] = useState(false);
  const [sheet, setSheet] = useState<'hide' | 'filter' | null>(null);
  const [pick, setPick] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const data = useLiveQuery(() => listOf(m, k, date), [m, k, date]);
  const marks = useLiveQuery(async () => (m === 'grammar' ? folderItems(GRAMMAR_BOOKMARKS) : new Set((await db.bookmarks.where('mode').equals(m).toArray()).map((b) => b.itemId))), [m]);
  const label = date === today ? '오늘' : date === shiftDate(today, -1) ? '어제' : date.slice(5).replace('-', '.');
  const daily = k === 'daily' || k === 'tdaily';
  const topics = (data?.topics ?? []).filter((t) => filter === 'all' || t.wrong);
  const rows = (data?.rows ?? []).filter((r) => filter === 'all' || r.logs.some(isWrong) || (r.lapses ?? 0) > 0);
  const grouped = k === 'wrong' || k === 'twrong';
  const FILTER_OPTS = meta.topic ? TOPIC_FILTER : SENT_FILTER;
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const empty = data && topics.length === 0 && rows.length === 0;

  let lastDate = '';
  return (
    <div className="screen sub lw-page">
      <SubHeader
        title={meta.label}
        right={
          !meta.topic && (
            <label className="vs-help">
              학습 기록
              <input type="checkbox" checked={showLog} onChange={(e) => setShowLog(e.target.checked)} />
              <span className="toggle" />
            </label>
          )
        }
      />
      <div className="nb-filters">
        {!meta.topic && (
          <button
            className="chip-btn"
            onClick={() => {
              setPick(hide);
              setSheet('hide');
            }}
          >
            {HIDE_OPTS.find((o) => o.v === hide)?.label} ▾
          </button>
        )}
        {daily && (
          <button
            className="chip-btn"
            onClick={() => {
              setPick(filter);
              setSheet('filter');
            }}
          >
            {FILTER_OPTS.find((o) => o.v === filter)?.label} ▾
          </button>
        )}
        {daily && (
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

      {empty && (
        <div className="lw-empty">
          <Icon name="xcircle" size={28} />
          <p>표시할 {meta.topic ? '문법' : '문장'}이 없어요.</p>
        </div>
      )}

      {meta.topic && (
        <ul className="gt-list">
          {topics.map((t) => {
            const head = grouped && t.date !== lastDate ? t.date : null;
            lastDate = t.date;
            return (
              <Fragment key={t.topic.id + t.date}>
                {head && <li className="lw-date">{head}</li>}
                <li>
                  <button className="gt-row" onClick={() => nav(`/grammar-dict/${t.topic.id}`)}>
                    <span className={`bang-ic ${t.wrong ? '' : 'off'}`}>❗</span>
                    <span className="lv-badge">레벨 {t.topic.level}</span>
                    <span className="gt-title">{t.topic.title}</span>
                    <Icon name="chevron" size={18} className="muted-ic" />
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      {!meta.topic && (
        <div className="lw-list">
          {rows.map((r) => {
            const head = grouped && r.date !== lastDate ? r.date : null;
            lastDate = r.date;
            const shown = open.has(r.s.id);
            const hidden = hide !== 'none' && !shown;
            return (
              <Fragment key={r.s.id}>
                {head && <p className="lw-date">{head}</p>}
                {k === 'most' && <p className="lw-wrongs">틀린 횟수: {r.lapses}회</p>}
                <div className="lw-card">
                  <button className="lw-body" onClick={() => hide !== 'none' && toggle(r.s.id)}>
                    {hide === 'ko' && hidden ? <span className="lw-reveal">탭해서 영어 보기</span> : <b className="lw-en">{r.s.en}</b>}
                    {hide === 'en' && hidden ? <span className="lw-reveal">탭해서 뜻 보기</span> : <span className="lw-ko">{r.s.ko}</span>}
                    {showLog && r.logs.length > 0 && <span className="lw-log">{r.logs.map(logText).join(' · ')}</span>}
                  </button>
                  <button className="lw-more" onClick={() => setMenu((x) => (x === r.s.id ? null : r.s.id))} aria-label="더 보기">
                    ⋮
                  </button>
                  {menu === r.s.id && (
                    <div className="lw-pop">
                      <button onClick={() => speak(r.s.en)}>
                        <Icon name="speaker" size={16} /> 발음 듣기
                      </button>
                      {r.s.topic && (
                        <button onClick={() => nav(`/grammar-dict/${r.s.topic?.id}`)}>
                          <Icon name="gbook" size={16} /> 문법 설명 보기
                        </button>
                      )}
                      <button
                        onClick={() => {
                          void (m === 'grammar' ? toggleInFolder(GRAMMAR_BOOKMARKS, r.s.id) : toggleBookmark(m, r.s.id));
                          setMenu(null);
                        }}
                      >
                        <Icon name="bookmark" size={16} /> {marks?.has(r.s.id) ? '북마크 빼기' : '북마크 추가'}
                      </button>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      {!meta.topic && rows.length > 0 && m === 'grammar' && (
        <div className="nb-foot">
          <button className="btn primary big" onClick={() => nav(`/grammar?ids=${rows.map((r) => r.s.id).join(',')}`)}>
            히스토리 학습 ({rows.length}개) <Icon name="chevron" size={16} />
          </button>
        </div>
      )}

      {sheet && (
        <div className="modal-dim" onClick={() => setSheet(null)}>
          <div className="opt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{sheet === 'hide' ? '가릴 부분 선택' : meta.topic ? '확인할 문법 선택' : '확인할 문장 선택'}</h3>
            {(sheet === 'hide' ? HIDE_OPTS : FILTER_OPTS).map((o) => (
              <button key={o.v} className={`opt-row ${pick === o.v ? 'sel' : ''}`} onClick={() => setPick(o.v)}>
                <span className="radio" />
                <span>
                  <b>{o.label}</b>
                  {'desc' in o && o.desc.map((d) => <small key={d}>{d}</small>)}
                </span>
              </button>
            ))}
            <div className="opt-actions">
              <button className="btn gray big" onClick={() => setSheet(null)}>
                취소
              </button>
              <button
                className="btn primary big"
                onClick={() => {
                  if (sheet === 'hide') setHide(pick as Hide);
                  else setFilter(pick as Filter);
                  setOpen(new Set());
                  setSheet(null);
                }}
              >
                결정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
