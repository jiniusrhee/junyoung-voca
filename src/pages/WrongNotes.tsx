import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import type { Tone } from '../types';

const TAG: Record<Tone, string> = { green: '유의어', yellow: '아쉬워요', red: '오답' };

export default function WrongNotes() {
  const rows = useLiveQuery(async () => {
    const reviews = await db.reviews
      .orderBy('ts')
      .reverse()
      .filter((r) => (r.wrongs?.length ?? 0) > 0)
      .limit(200)
      .toArray();
    const words = await db.words.bulkGet(reviews.map((r) => r.wordId));
    return reviews
      .map((r, i) => ({ r, w: words[i] }))
      .filter((x) => x.w)
      .map((x) => ({ r: x.r, w: x.w!, s: x.w!.sentences[x.r.sentenceIdx ?? 0] ?? x.w!.sentences[0] }));
  }, []);

  return (
    <div className="screen sub">
      <SubHeader title="내 오답노트" right={<span className="count-pill red">{rows?.length ?? 0}</span>} />
      {rows && rows.length === 0 && <p className="empty-note">퀴즈에서 틀린 답과 그 이유가 여기에 쌓여요.</p>}
      {(rows ?? []).map(({ r, w, s }) => (
        <div key={r.id} className="note-item">
          <Link to={`/words/${encodeURIComponent(w.id)}`} className="note-sent">
            <p className="sent-en">
              <FilledSentence sentence={s} />
            </p>
            <p className="sent-ko">
              <KoSentence ko={s.ko} />
            </p>
          </Link>
          {(r.wrongs ?? []).map((x, i) => (
            <div key={i} className="wrong-item">
              <div className="wrong-head">
                <span className="wrong-w">{x.w}</span>
                <span className={`tag ${x.tone}`}>{TAG[x.tone]}</span>
              </div>
              <p>{x.m}</p>
            </div>
          ))}
          <p className="note-date">{new Date(r.ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</p>
        </div>
      ))}
    </div>
  );
}
