import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BagCount, EmptyBox, ListFilters } from '../components/ListChrome';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import WrongItem from '../components/WrongItem';
import { db } from '../db';
import { FAV_NOTE_LIMIT, removeFavNote, useFavNotes } from '../lib/favnotes';


type Hide = 'none' | 'ko' | 'en';
const HIDE_LABEL: Record<Hide, string> = { none: '가리지 않기', ko: '한글 가리기', en: '영어 가리기' };

/** 내가 좋아하는 오답노트 (말해보카: 가리기, 최신순, 편집, N/500) */
export default function WrongNotes() {
  const [hide, setHide] = useState<Hide>('none');
  const [newest, setNewest] = useState(true);
  const [editing, setEditing] = useState(false);
  const favs = useFavNotes();
  const rows = useLiveQuery(async () => {
    if (!favs) return undefined;
    const words = await db.words.bulkGet(favs.map((n) => n.wordId));
    return favs
      .map((n, i) => ({ n, w: words[i] }))
      .filter((x) => x.w)
      .map((x) => ({ n: x.n, w: x.w!, s: x.w!.sentences[x.n.sentenceIdx] ?? x.w!.sentences[0] }));
  }, [favs]);

  const list = newest ? (rows ?? []) : [...(rows ?? [])].reverse();
  return (
    <div className="screen sub list-page">
      <SubHeader title="내가 좋아하는 오답노트" right={<BagCount n={rows?.length ?? 0} max={FAV_NOTE_LIMIT} />} />
      <ListFilters editing={editing} onEdit={() => setEditing((v) => !v)}>
        <button className="chip-btn" onClick={() => setHide((h) => (h === 'none' ? 'ko' : h === 'ko' ? 'en' : 'none'))}>
          {HIDE_LABEL[hide]} ▾
        </button>
        <button className="chip-btn" onClick={() => setNewest((v) => !v)}>
          {newest ? '최신순' : '오래된순'} ▾
        </button>
      </ListFilters>
      {rows && rows.length === 0 && <EmptyBox />}
      {list.map(({ n, w, s }) => (
        <div key={n.key} className="note-item">
          <Link to={`/words/${encodeURIComponent(w.id)}`} className="note-sent">
            {hide !== 'en' && (
              <p className="sent-en">
                <FilledSentence sentence={s} />
              </p>
            )}
            {hide !== 'ko' && (
              <p className="sent-ko">
                <KoSentence ko={s.ko} />
              </p>
            )}
          </Link>
          {editing && (
            <button className="note-del" onClick={() => void removeFavNote(n.key)}>
              삭제
            </button>
          )}
          <WrongItem w={n.w} tone={n.tone} m={n.m} />
          <p className="note-date">{new Date(n.ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</p>
        </div>
      ))}
    </div>
  );
}
