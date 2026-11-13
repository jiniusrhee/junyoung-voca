import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link, useNavigate, useNavigationType } from 'react-router-dom';
import Icon from '../components/Icon';
import KoText from '../components/KoText';
import { speak } from '../lib/speech';
import { db } from '../db';
import { POS_KO } from '../types';

type Tab = 'word' | 'sentence';
const RECENT_KEY = 'recentSearches';

async function getRecent(): Promise<string[]> {
  return ((await db.kv.get(RECENT_KEY))?.value as string[] | undefined) ?? [];
}
async function pushRecent(term: string): Promise<void> {
  const cur = await getRecent();
  await db.kv.put({ key: RECENT_KEY, value: [term, ...cur.filter((t) => t !== term)].slice(0, 20) });
}

/** 낱말 상세를 보고 돌아왔을 때 검색어와 결과를 그대로 보여 주려고 마지막 검색어를 들고 있는다 (앱이 켜져 있는 동안만) */
let lastQuery = '';

/**
 * 단어 & 문장 검색 (말해보카 플립 실측 2026-11-13).
 * 들어오면 바로 자판이 뜨고, 치는 대로 결과가 바뀌며 머리줄이 '"…" 의 검색 결과' 가 된다.
 * 결과를 열었다 돌아오면 자판 없이 결과가 그대로 있고 머리줄은 원래 제목이다. 오른쪽 아래 × 는 검색 화면을 닫는다.
 */
export default function Dictionary() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const returned = useNavigationType() === 'POP';
  const initial = params.get('q') ?? (returned ? lastQuery : '');
  // 머리줄을 검색 결과 제목으로 바꾸는 것은 이 화면에서 글자를 쳤을 때부터
  const [typed, setTyped] = useState(false);
  const [tab, setTab] = useState<Tab>('word');
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);
  const q = query.trim().toLowerCase();
  const recent = useLiveQuery(() => getRecent(), []);

  const words = useLiveQuery(async () => {
    if (!q || tab !== 'word') return [];
    const all = await db.words.toArray();
    return all
      .filter((w) => w.word.toLowerCase().includes(q) || w.meanings.some((m) => m.includes(q)))
      .sort((a, b) => {
        const as = a.word.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.word.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.level - b.level || a.word.localeCompare(b.word);
      })
      .slice(0, 100);
  }, [q, tab]);

  const favs = useLiveQuery(async () => new Set((await db.favorites.toArray()).map((f) => f.key)), []);
  const sentences = useLiveQuery(async () => {
    if (!q || tab !== 'sentence') return [];
    const all = await db.words.toArray();
    const out: { id: string; idx: number; w: (typeof all)[number] }[] = [];
    for (const w of all) {
      w.sentences.forEach((s, idx) => {
        const en = s.en.replace('___', s.answer).toLowerCase();
        // 말해보카: 영어는 단어 단위로 (big 이 ambiguous 에 걸리지 않게), 한글은 포함
        const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const hit = /^[a-z' ]+$/.test(q) ? q.split(/\s+/).every((t) => new RegExp('(^|[^a-z])' + esc(t) + '([^a-z]|$)').test(en)) : s.ko.replace(/\*\*/g, '').includes(q);
        if (hit) out.push({ id: w.id, idx, w });
      });
      if (out.length > 100) break;
    }
    return out;
  }, [q, tab]);

  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // 폰의 뒤로 가기로 자판만 내리면 입력칸은 포커스를 쥔 채로 남는다 → 화면이 다시 길어지면(자판이 내려가면) 포커스를 놓아 검색 줄 모양을 바꾼다
  useEffect(() => {
    let last = window.innerHeight;
    const onResize = () => {
      const h = window.innerHeight;
      if (h - last > 120 && document.activeElement === inputRef.current) inputRef.current?.blur();
      last = h;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // 최근 검색에 남기기: 확인(완료)을 누르거나 결과를 열 때
  const submit = (term = draft) => {
    const t = term.trim();
    if (!t) return;
    setDraft(t);
    setQuery(t);
    lastQuery = t;
    void pushRecent(t);
  };
  const clear = () => {
    setDraft('');
    setQuery('');
    lastQuery = '';
    inputRef.current?.focus();
  };

  return (
    <div className={`vs-page dict2 ${focused ? 'typing' : ''}`}>
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} />
          {q && typed ? (
            <span>
              <span lang="en">&quot;{query.trim()}&quot;</span> 의 검색 결과
            </span>
          ) : (
            <span>단어 &amp; 문장 검색</span>
          )}
        </button>
      </header>
      {/* 실제 앱은 탭이 셋(셋째는 AI 문장 분석 — 만들지 않음)이라 탭 하나가 화면의 1/3 */}
      <nav className="d2-tabs">
        <button className={tab === 'word' ? 'active' : ''} onClick={() => setTab('word')}>
          단어 검색
        </button>
        <button className={tab === 'sentence' ? 'active' : ''} onClick={() => setTab('sentence')}>
          문장 검색
        </button>
      </nav>

      {!q && recent && recent.length > 0 && (
        <section className="d2-recent">
          <div className="d2-recent-head">
            <b>최근 검색</b>
            <button onClick={() => void db.kv.put({ key: RECENT_KEY, value: [] })}>전체 삭제</button>
          </div>
          {recent.map((t) => (
            <div key={t} className="d2-recent-row">
              <button className="d2-term" onClick={() => submit(t)}>
                <KoText text={t} />
              </button>
              <button className="d2-x" onClick={() => void db.kv.put({ key: RECENT_KEY, value: recent.filter((x) => x !== t) })} aria-label="삭제">
                <svg width="7.333" height="7.333" viewBox="0 0 7.333 7.333" aria-hidden="true">
                  <path d="M0.600 0.600l6.133 6.133M6.733 0.600L0.600 6.733" fill="none" stroke="currentColor" strokeWidth="1.100" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
        </section>
      )}

      {q && tab === 'word' && (
        <div className="d2-results">
          {words && words.length === 0 && <p className="empty-note">검색 결과가 없습니다.</p>}
          {(words ?? []).map((w) => (
            <Link key={w.id} to={`/words/${encodeURIComponent(w.id)}`} className="d2-card" onClick={() => void pushRecent(query.trim())}>
              <span className="d2-word" lang="en">
                {w.word}
              </span>
              <span className="d2-means">
                {w.meanings.map((m, i) => (
                  <span key={i} className="d2-mean">
                    <span className="d2-mean-text">
                      {i === 0 && <small>{POS_KO[w.pos]}</small>}
                      <b>
                        <KoText text={m} />
                      </b>
                    </span>
                    <svg className="d2-chev" width="6" height="10.333" viewBox="0 0 6 10.333" aria-hidden="true">
                      <polyline points="0.700,0.700 5.300,5.167 0.700,9.633" fill="none" stroke="currentColor" strokeWidth="1.200" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ))}
              </span>
            </Link>
          ))}
        </div>
      )}
      {q && tab === 'sentence' && (
        <>
          <p className="result-head">&quot;{query}&quot; 의 검색 결과</p>
          {sentences && sentences.length === 0 && <p className="empty-note">검색 결과가 없습니다.</p>}
          {(sentences ?? []).map(({ id, idx, w }) => {
            const key = `${id}#${idx}`;
            const full = w.sentences[idx].en.replace('___', w.sentences[idx].answer);
            return (
              <div key={key} className="sent-item sent-card">
                <Link to={`/words/${encodeURIComponent(id)}`} className="sent-card-body">
                  <p className="sent-en plain">{full}</p>
                  <p className="sent-ko">{w.sentences[idx].ko.replace(/\*\*/g, '')}</p>
                </Link>
                <div className="sent-card-actions">
                  <button onClick={() => speak(full, true)} aria-label="천천히 듣기">
                    <Icon name="turtle" size={22} />
                  </button>
                  <button onClick={() => speak(full)} aria-label="듣기">
                    <Icon name="speaker" size={22} />
                  </button>
                  <button
                    className={favs?.has(key) ? 'on' : ''}
                    onClick={() => void (favs?.has(key) ? db.favorites.delete(key) : db.favorites.put({ key, wordId: id, sentenceIdx: idx, ts: Date.now() }))}
                    aria-label="좋아하는 문장"
                  >
                    <Icon name={favs?.has(key) ? 'heartFill' : 'heart'} size={22} />
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* 검색 줄: 치는 대로 결과가 바뀐다. 자판이 떠 있을 때는 낮은 줄(지우기 + 확인), 자판이 내려가면 돋보기와 검색어만 보이는 높은 줄 + 떠 있는 × */}
      {!focused && (
        <button className="d2-float-x" onClick={() => nav(-1)} aria-label="검색 닫기">
          <svg width="9.667" height="9.667" viewBox="0 0 11 11" aria-hidden="true">
            <path d="M1.200 1.200l8.600 8.600M9.800 1.200l-8.600 8.600" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <form
        className="d2-bar"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
          inputRef.current?.blur();
        }}
      >
        <svg className="d2-bar-ic" width="15.667" height="15.667" viewBox="0 0 15.667 15.667" aria-hidden="true">
          <circle cx="6.500" cy="6.500" r="5.400" fill="none" stroke="currentColor" strokeWidth="1.900" />
          <path d="M10.500 10.500l4.200 4.200" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          autoFocus={!returned}
          lang="en"
          placeholder={tab === 'word' ? '검색할 단어를 입력하세요' : '검색할 단어들을 입력하세요'}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setQuery(e.target.value);
            setTyped(true);
            lastQuery = e.target.value;
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          enterKeyHint="done"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {/* 누르는 동안 입력칸이 포커스를 잃지 않게 (잃으면 줄 모양이 바뀌어 버튼이 사라진다) */}
        <button type="button" className="d2-clear" onMouseDown={(e) => e.preventDefault()} onTouchStart={(e) => e.preventDefault()} onTouchEnd={clear} onClick={clear} aria-label="지우기">
          <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
            <path d="M0.700 0.700l5.600 5.600M6.300 0.700L0.700 6.300" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" />
          </svg>
        </button>
        <button type="submit" className="d2-ok" onMouseDown={(e) => e.preventDefault()}>
          확인
        </button>
      </form>
    </div>
  );
}
