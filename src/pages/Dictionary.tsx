import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { db } from '../db';
import { POS_KO } from '../types';

export default function Dictionary() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = useLiveQuery(async () => {
    const all = await db.words.toArray();
    const list = q
      ? all.filter((w) => w.word.toLowerCase().includes(q) || w.meanings.some((m) => m.includes(q)))
      : all;
    return list
      .sort((a, b) => {
        if (q) {
          const as = a.word.toLowerCase().startsWith(q) ? 0 : 1;
          const bs = b.word.toLowerCase().startsWith(q) ? 0 : 1;
          if (as !== bs) return as - bs;
        }
        return a.level - b.level || a.word.localeCompare(b.word);
      })
      .slice(0, 200);
  }, [q]);

  return (
    <div className="screen dict">
      <h1 className="page-title">사전 &amp; 단어 검색</h1>
      <div className="search-box">
        <Icon name="search" size={18} />
        <input placeholder="영어 단어나 한글 뜻을 검색하세요" value={query} onChange={(e) => setQuery(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </div>
      <p className="hint-banner">단어를 누르면 예문과 뉘앙스를 볼 수 있어요.</p>
      <ul className="dict-list">
        {(results ?? []).map((w) => (
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
      {results && results.length === 0 && <p className="muted center-text">검색 결과가 없어요.</p>}
    </div>
  );
}
