import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
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

/** 단어 & 문장 검색 (말해보카: 탭, 최근 검색, 아래 입력줄 + 확인, 검색 후에만 결과) */
export default function Dictionary() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('word');
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
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

  const submit = (term = draft) => {
    const t = term.trim();
    if (!t) return;
    setDraft(t);
    setQuery(t);
    void pushRecent(t);
  };

  return (
    <div className="vs-page dict-page search-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 단어 &amp; 문장 검색
        </button>
      </header>
      <nav className="dict-tabs2">
        <button className={tab === 'word' ? 'active' : ''} onClick={() => setTab('word')}>
          단어 검색
        </button>
        <button className={tab === 'sentence' ? 'active' : ''} onClick={() => setTab('sentence')}>
          문장 검색
        </button>
      </nav>

      {!q && (
        <>
          {recent && recent.length > 0 ? (
            <section className="recent-sec">
              <div className="recent-head">
                <b>최근 검색</b>
                <button onClick={() => void db.kv.put({ key: RECENT_KEY, value: [] })}>전체 삭제</button>
              </div>
              {recent.map((t) => (
                <div key={t} className="recent-row">
                  <button className="recent-term" onClick={() => submit(t)}>
                    <Icon name="clock" size={16} /> {t}
                  </button>
                  <button className="recent-x" onClick={() => void db.kv.put({ key: RECENT_KEY, value: recent.filter((x) => x !== t) })} aria-label="삭제">
                    ×
                  </button>
                </div>
              ))}
            </section>
          ) : (
            <div className="search-prompt">
              <Icon name="search" size={30} />
              <p>
                {tab === 'word' ? (
                  <>
                    영어 또는 <b>한글</b>을 입력해서
                    <br />
                    원하는 단어를 검색하세요.
                  </>
                ) : (
                  <>
                    <b>영어 단어들</b>을 입력해서
                    <br />
                    원하는 문장을 검색하세요.
                  </>
                )}
              </p>
            </div>
          )}
        </>
      )}

      {q && tab === 'word' && (
        <>
          <p className="result-head">&quot;{query}&quot; 의 검색 결과</p>
          {words && words.length === 0 && <p className="empty-note">검색 결과가 없습니다.</p>}
          <ul className="dict-list">
            {(words ?? []).map((w) => (
              <li key={w.id}>
                <Link to={`/words/${encodeURIComponent(w.id)}`} className="dict-row">
                  <span className="dict-word">{w.word}</span>
                  <span className="dict-mean">
                    <small>{POS_KO[w.pos]}</small> {w.meanings.join(', ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
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

      <form
        className="dict-searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          placeholder={tab === 'word' ? '검색할 단어를 입력하세요' : '검색할 단어들을 입력하세요'}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value.trim()) setQuery('');
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {draft && (
          <button
            type="button"
            className="clear-x"
            onClick={() => {
              setDraft('');
              setQuery('');
            }}
            aria-label="지우기"
          >
            ×
          </button>
        )}
        <button type="submit">확인</button>
      </form>
    </div>
  );
}
