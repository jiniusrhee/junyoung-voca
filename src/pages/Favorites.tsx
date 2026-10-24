import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import Icon from '../components/Icon';
import { BagCount, EmptyBox, ListFilters } from '../components/ListChrome';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { speak } from '../lib/speech';
import { fullSentence } from '../lib/text';

/** 내가 좋아하는 문장 (말해보카: 영어/한글 먼저 보기, 최신순, 편집, N/500) */
export default function Favorites() {
  const [enFirst, setEnFirst] = useState(true);
  const [newest, setNewest] = useState(true);
  const [editing, setEditing] = useState(false);
  const rows = useLiveQuery(async () => {
    const favs = await db.favorites.orderBy('ts').reverse().toArray();
    const words = await db.words.bulkGet(favs.map((f) => f.wordId));
    return favs
      .map((f, i) => ({ f, w: words[i] }))
      .filter((x) => x.w && x.w.sentences[x.f.sentenceIdx])
      .map((x) => ({ key: x.f.key, s: x.w!.sentences[x.f.sentenceIdx] }));
  }, []);
  const list = newest ? (rows ?? []) : [...(rows ?? [])].reverse();

  return (
    <div className="screen sub list-page">
      <SubHeader title="내가 좋아하는 문장" right={<BagCount n={rows?.length ?? 0} />} />
      <ListFilters editing={editing} onEdit={() => setEditing((v) => !v)}>
        <button className="chip-btn" onClick={() => setEnFirst((v) => !v)}>
          {enFirst ? '영어 문장 먼저 보기' : '한글 문장 먼저 보기'} ▾
        </button>
        <button className="chip-btn" onClick={() => setNewest((v) => !v)}>
          {newest ? '최신순' : '오래된순'} ▾
        </button>
      </ListFilters>
      {rows && rows.length === 0 && <EmptyBox />}
      {list.map(({ key, s }) => (
        <div key={key} className="sent-item">
          {enFirst ? (
            <>
              <p className="sent-en">
                <FilledSentence sentence={s} />
              </p>
              <p className="sent-ko">
                <KoSentence ko={s.ko} />
              </p>
            </>
          ) : (
            <>
              <p className="sent-ko big">
                <KoSentence ko={s.ko} />
              </p>
              <p className="sent-en">
                <FilledSentence sentence={s} />
              </p>
            </>
          )}
          <div className="sent-actions">
            <button className="icon-btn small" onClick={() => speak(fullSentence(s.en, s.answer))} aria-label="듣기">
              <Icon name="speaker" size={18} />
            </button>
            {editing ? (
              <button className="icon-btn small" onClick={() => void db.favorites.delete(key)} aria-label="삭제">
                <Icon name="close" size={18} />
              </button>
            ) : (
              <button className="icon-btn small pink" onClick={() => void db.favorites.delete(key)} aria-label="좋아요 취소">
                <Icon name="heartFill" size={18} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
