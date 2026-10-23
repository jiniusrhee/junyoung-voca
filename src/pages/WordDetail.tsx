import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { MASTERY_KO, masteryOf } from '../lib/scheduler';
import { canSpeak, speak } from '../lib/speech';
import { splitBold } from '../lib/text';
import { formatRelative } from '../lib/time';
import { POS_KO } from '../types';

const RATING_KO: Record<number, string> = { 1: '틀림', 2: '헷갈림', 3: '정답', 4: '쉬움' };

export default function WordDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const wordId = decodeURIComponent(id);
  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const card = useLiveQuery(() => db.cards.get(wordId), [wordId]);
  const logs = useLiveQuery(() => db.reviews.where('wordId').equals(wordId).reverse().sortBy('ts'), [wordId]);

  if (word === undefined) {
    return (
      <div className="screen">
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }
  if (!word) {
    return (
      <div className="screen">
        <p>단어를 찾을 수 없어요.</p>
        <button className="btn ghost" onClick={() => nav(-1)}>
          뒤로
        </button>
      </div>
    );
  }
  const mastery = card ? masteryOf(card) : null;

  return (
    <div className="screen">
      <button className="btn ghost back" onClick={() => nav(-1)}>
        ← 뒤로
      </button>
      <div className="word-head big">
        <span className="word">{word.word}</span>
        <span className="chip pos">{POS_KO[word.pos]}</span>
        <span className="badge">Lv.{word.level}</span>
        {canSpeak() && (
          <button className="icon-btn" onClick={() => speak(word.word)} aria-label="발음 듣기">
            🔊
          </button>
        )}
      </div>
      <p className="meanings">{word.meanings.join(' · ')}</p>
      {card && mastery && (
        <div className="card">
          <span className={`chip m-${mastery}`}>{MASTERY_KO[mastery]}</span>
          <p className="muted small">
            다음 복습 {formatRelative(card.due)} · 학습 {card.reps}회 · 틀림 {card.lapses}회
          </p>
        </div>
      )}
      <h3>예문</h3>
      {word.sentences.map((s, i) => (
        <div key={i} className="card">
          <p className="sentence-en small-en">{s.en.replace('___', s.answer)}</p>
          <p className="muted">
            {splitBold(s.ko).map((seg, j) => (seg.bold ? <strong key={j}>{seg.text}</strong> : <span key={j}>{seg.text}</span>))}
          </p>
        </div>
      ))}
      {word.nuance && (
        <>
          <h3>뉘앙스</h3>
          <p>{word.nuance}</p>
        </>
      )}
      {word.etymology && (
        <>
          <h3>어원</h3>
          <p>{word.etymology}</p>
        </>
      )}
      {logs && logs.length > 0 && (
        <>
          <h3>학습 기록</h3>
          <ul className="list plain">
            {logs.map((l) => (
              <li key={l.id} className="muted small">
                {new Date(l.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                {RATING_KO[l.rating] ?? l.rating}
                {l.hints ? ` · 힌트 ${l.hints}` : ''}
                {l.showedAnswer ? ' · 정답 봄' : ''}
                {l.isTest ? ' · 레벨 테스트' : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
