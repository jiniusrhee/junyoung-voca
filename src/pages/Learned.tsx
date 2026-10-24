import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { LEARNED_KINDS, importedDay, learnedCounts, learnedList, logText, type LearnedKind, type LearnedRow } from '../lib/learned';
import { speak } from '../lib/speech';
import { shiftDate, studyDateOf } from '../lib/time';
import { toggleWordbook, useWordbook } from '../lib/wordbook';

/** 내가 학습한 어휘: 목록 메뉴 (말해보카 구조) */
export default function LearnedMenu() {
  const nav = useNavigate();
  const counts = useLiveQuery(() => learnedCounts(), []);
  return (
    <div className="screen sub">
      <SubHeader title="내가 학습한 어휘" />
      <ul className="lw-menu">
        {LEARNED_KINDS.map((k) => (
          <li key={k.kind}>
            <button className="menu-row" onClick={() => nav(`/learned-words/${k.kind}`)}>
              <span className="menu-icon purple soft">
                <Icon name="bookPerson" size={22} />
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

type Hide = 'ko' | 'en' | 'none';
const HIDE_OPTS: { v: Hide; label: string; desc: string[] }[] = [
  { v: 'ko', label: '한글 먼저 보기', desc: ['한글 뜻을 보고 스펠링을 맞혀보세요.', '탭하면 스펠링을 볼 수 있어요.'] },
  { v: 'en', label: '스펠링 먼저 보기', desc: ['스펠링을 보고 뜻을 맞혀보세요.', '탭하면 뜻을 볼 수 있어요.'] },
  { v: 'none', label: '가리지 않기', desc: ['스펠링과 한글 뜻 모두 가리지 않아요.'] },
];
type Filter = 'all' | 'wrong';
const FILTER_OPTS: { v: Filter; label: string }[] = [
  { v: 'all', label: '모든 단어 보기' },
  { v: 'wrong', label: '틀린 단어만 보기' },
];

/** 목록 화면: 일별 학습 어휘 등 */
export function LearnedWords() {
  const nav = useNavigate();
  const { kind = 'daily' } = useParams();
  const k = kind as LearnedKind;
  const title = LEARNED_KINDS.find((x) => x.kind === k)?.label ?? '내가 학습한 어휘';
  const today = studyDateOf();
  const [date, setDate] = useState(today);
  const [hide, setHide] = useState<Hide>('ko');
  const [filter, setFilter] = useState<Filter>('all');
  const [showLog, setShowLog] = useState(false);
  const [sheet, setSheet] = useState<'hide' | 'filter' | null>(null);
  const [pick, setPick] = useState<string>('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const book = useWordbook();
  const rows = useLiveQuery(() => learnedList(k, date), [k, date]);
  const extra = useLiveQuery(() => (k === 'daily' ? importedDay(date) : Promise.resolve({ rows: [], plain: [] })), [k, date]);
  const have = new Set((rows ?? []).map((r) => r.word.id));
  const merged = [...(rows ?? []), ...(extra?.rows ?? []).filter((r) => !have.has(r.word.id))];
  const list = merged.filter((r) => filter === 'all' || r.logs.some((l) => !l.firstTry || l.showedAnswer));
  const plain = filter === 'all' ? (extra?.plain ?? []) : [];
  const label = date === today ? '오늘' : date === shiftDate(today, -1) ? '어제' : date.slice(5).replace('-', '.');
  const reveal = (id: string) =>
    setRevealed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="screen sub lw-page">
      <SubHeader
        title={title}
        right={
          <label className="vs-help">
            학습 기록
            <input type="checkbox" checked={showLog} onChange={(e) => setShowLog(e.target.checked)} />
            <span className="toggle" />
          </label>
        }
      />
      <div className="nb-filters">
        {k !== 'pron' && (
          <>
            <button
              className="chip-btn"
              onClick={() => {
                setPick(hide);
                setSheet('hide');
              }}
            >
              {HIDE_OPTS.find((o) => o.v === hide)?.label} ▾
            </button>
            <button
              className="chip-btn"
              onClick={() => {
                setPick(filter);
                setSheet('filter');
              }}
            >
              {FILTER_OPTS.find((o) => o.v === filter)?.label} ▾
            </button>
          </>
        )}
        {k === 'daily' && (
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

      {rows && extra && list.length === 0 && plain.length === 0 && (
        <div className="lw-empty">
          <Icon name="xcircle" size={28} />
          <p>표시할 어휘가 없어요.</p>
        </div>
      )}
      <div className="lw-list">
        {list.map((r, idx) => (
          <Fragment key={r.word.id}>
            {k === 'pron' && r.note !== list[idx - 1]?.note && <p className="lw-date">{r.note}</p>}
            <WordCard row={k === 'pron' ? { ...r, note: undefined } : r} hide={k === 'pron' ? 'none' : hide} open={revealed.has(r.word.id)} onToggle={() => reveal(r.word.id)} showLog={showLog} menu={menu === r.word.id} onMenu={() => setMenu((m) => (m === r.word.id ? null : r.word.id))} inBook={book?.includes(r.word.id) ?? false} />
          </Fragment>
        ))}
        {plain.map((w) => (
          <div key={w} className="lw-card plain">
            <button className="lw-body" onClick={() => speak(w)}>
              <b className="lw-en">{w}</b>
              <span className="lw-log">말해보카에서 학습 · 이 앱 단어 팩에는 아직 없는 단어</span>
            </button>
          </div>
        ))}
      </div>
      {list.length > 0 && (
        <div className="nb-foot">
          <button className="btn primary big" onClick={() => nav(`/quiz?ids=${list.map((r) => r.word.id).join(',')}`)}>
            히스토리 학습 ({list.length}개) <Icon name="chevron" size={16} />
          </button>
        </div>
      )}

      {sheet && (
        <div className="modal-dim" onClick={() => setSheet(null)}>
          <div className="opt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{sheet === 'hide' ? '가릴 부분 선택' : '확인할 단어 선택'}</h3>
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
                  setRevealed(new Set());
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

function WordCard({ row, hide, open, onToggle, showLog, menu, onMenu, inBook }: { row: LearnedRow; hide: Hide; open: boolean; onToggle: () => void; showLog: boolean; menu: boolean; onMenu: () => void; inBook: boolean }) {
  const nav = useNavigate();
  const w = row.word;
  const meaning = w.meanings.join(', ');
  const hidden = hide !== 'none' && !open;
  return (
    <div className="lw-card">
      <button className="lw-body" onClick={() => hide !== 'none' && onToggle()}>
        {hide === 'ko' && hidden ? <span className="lw-reveal">탭해서 스펠링 보기</span> : <b className="lw-en">{w.word}</b>}
        {hide === 'en' && hidden ? <span className="lw-reveal">탭해서 뜻 보기</span> : <span className="lw-ko">{meaning}</span>}
        {showLog && row.logs.length > 0 && <span className="lw-log">{row.logs.map(logText).join(' · ')}</span>}
        {row.note && <span className="lw-log">{row.note}</span>}
      </button>
      <button className="lw-more" onClick={onMenu} aria-label="더 보기">
        ⋮
      </button>
      {menu && (
        <div className="lw-pop">
          <button onClick={() => speak(w.word)}>
            <Icon name="speaker" size={16} /> 발음 듣기
          </button>
          <button onClick={() => nav(`/words/${encodeURIComponent(w.id)}`)}>
            <Icon name="dict" size={16} /> 단어 정보
          </button>
          <button
            onClick={() => {
              void toggleWordbook(w.id);
              onMenu();
            }}
          >
            <Icon name="bookmark" size={16} /> {inBook ? '내 단어장에서 빼기' : '내 단어장에 추가'}
          </button>
        </div>
      )}
    </div>
  );
}
