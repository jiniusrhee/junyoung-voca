import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { MASTERY_KO, masteryOf, type Mastery } from '../lib/scheduler';
import { formatAfter } from '../lib/time';
import type { CardRow, StoredWord } from '../types';

type Filter = 'all' | Mastery | 'recentLapse' | 'frequentLapse';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'strong', label: '매우 숙달된' },
  { key: 'solid', label: '숙달된' },
  { key: 'fresh', label: '아직 서툰' },
  { key: 'shaky', label: '재학습 필요' },
  { key: 'recentLapse', label: '최근에 잊은' },
  { key: 'frequentLapse', label: '자주 잊은' },
];

interface Row {
  card: CardRow;
  word: StoredWord;
  mastery: Mastery;
}

export default function Words() {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const rows = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const words = await db.words.bulkGet(cards.map((c) => c.wordId));
    const out: Row[] = [];
    cards.forEach((card, i) => {
      const word = words[i];
      if (word) out.push({ card, word, mastery: masteryOf(card) });
    });
    return out;
  }, []);

  const recentLapse = useLiveQuery(async () => {
    const logs = await db.reviews.orderBy('ts').reverse().filter((r) => r.rating === 1).limit(300).toArray();
    return [...new Set(logs.map((l) => l.wordId))];
  }, []);

  const list = useMemo(() => {
    if (!rows) return [];
    let r = rows;
    if (filter === 'recentLapse') {
      const idx = new Map((recentLapse ?? []).map((id, i) => [id, i]));
      r = rows.filter((x) => idx.has(x.word.id)).sort((a, b) => (idx.get(a.word.id) ?? 0) - (idx.get(b.word.id) ?? 0));
    } else if (filter === 'frequentLapse') {
      r = rows.filter((x) => x.card.lapses >= 2).sort((a, b) => b.card.lapses - a.card.lapses);
    } else {
      if (filter !== 'all') r = rows.filter((x) => x.mastery === filter);
      r = [...r].sort((a, b) => (b.card.last_review?.getTime() ?? 0) - (a.card.last_review?.getTime() ?? 0));
    }
    const q = query.trim().toLowerCase();
    if (q) r = r.filter((x) => x.word.word.toLowerCase().includes(q) || x.word.meanings.some((m) => m.includes(q)));
    return r;
  }, [rows, filter, query, recentLapse]);

  const counts = useMemo(() => {
    const c: Partial<Record<Mastery, number>> = {};
    for (const r of rows ?? []) c[r.mastery] = (c[r.mastery] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="screen sub">
      <SubHeader title="내가 학습한 어휘" right={<span className="count-pill purple">{rows?.length ?? 0}</span>} />
      <div className="search-box">
        <input placeholder="단어 또는 뜻 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="filters">
        {FILTERS.map((f) => {
          const n = f.key in counts ? counts[f.key as Mastery] : undefined;
          return (
            <button key={f.key} className={`chip-btn ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
              {n ? ` ${n}` : ''}
            </button>
          );
        })}
      </div>
      <ul className="dict-list">
        {list.map((r) => (
          <li key={r.word.id}>
            <Link to={`/words/${encodeURIComponent(r.word.id)}`} className="dict-row">
              <span className="dict-word">{r.word.word}</span>
              <span className="dict-mean">{r.word.meanings[0]}</span>
              <span className="row-side">
                <span className={`chip m-${r.mastery}`}>{MASTERY_KO[r.mastery]}</span>
                <span className="muted tiny">{formatAfter(r.card.due)} 복습</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows && rows.length === 0 && <p className="empty-note">아직 학습한 단어가 없어요.</p>}
    </div>
  );
}
