import { useLiveQuery } from 'dexie-react-hooks';
import Icon from '../components/Icon';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { speak } from '../lib/speech';
import { fullSentence } from '../lib/text';

export default function Favorites() {
  const rows = useLiveQuery(async () => {
    const favs = await db.favorites.orderBy('ts').reverse().toArray();
    const words = await db.words.bulkGet(favs.map((f) => f.wordId));
    return favs
      .map((f, i) => ({ f, w: words[i] }))
      .filter((x) => x.w && x.w.sentences[x.f.sentenceIdx])
      .map((x) => ({ key: x.f.key, s: x.w!.sentences[x.f.sentenceIdx] }));
  }, []);

  return (
    <div className="screen sub">
      <SubHeader title="내가 좋아하는 문장" right={<span className="count-pill pink">{rows?.length ?? 0}</span>} />
      {rows && rows.length === 0 && <p className="empty-note">퀴즈에서 정답 후 카드의 하트를 누르면 여기에 모여요.</p>}
      {(rows ?? []).map(({ key, s }) => (
        <div key={key} className="sent-item">
          <p className="sent-en">
            <FilledSentence sentence={s} />
          </p>
          <p className="sent-ko">
            <KoSentence ko={s.ko} />
          </p>
          <div className="sent-actions">
            <button className="icon-btn small" onClick={() => speak(fullSentence(s.en, s.answer))} aria-label="듣기">
              <Icon name="speaker" size={18} />
            </button>
            <button className="icon-btn small pink" onClick={() => void db.favorites.delete(key)} aria-label="좋아요 취소">
              <Icon name="heartFill" size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
