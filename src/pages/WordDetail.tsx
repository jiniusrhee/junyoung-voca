import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { MASTERY_KO, masteryOf } from '../lib/scheduler';
import { canSpeak, speak } from '../lib/speech';
import { fullSentence } from '../lib/text';
import { formatAfter } from '../lib/time';
import { POS_KO, type Tone } from '../types';

const RATING_KO: Record<number, string> = { 1: '틀림', 2: '헷갈림', 3: '정답', 4: '쉬움' };
const ALT_TONE: Record<string, Tone> = { ok: 'green', near: 'yellow', wrong: 'red' };
const TAG: Record<Tone, string> = { green: '유의어', yellow: '아쉬워요', red: '오답' };

export default function WordDetail() {
  const { id = '' } = useParams();
  const wordId = decodeURIComponent(id);
  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const card = useLiveQuery(() => db.cards.get(wordId), [wordId]);
  const logs = useLiveQuery(() => db.reviews.where('wordId').equals(wordId).reverse().sortBy('ts'), [wordId]);

  if (word === undefined) {
    return (
      <div className="screen sub">
        <SubHeader title="단어 정보" />
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }
  if (!word) {
    return (
      <div className="screen sub">
        <SubHeader title="단어 정보" />
        <p className="empty-note">단어를 찾을 수 없어요.</p>
      </div>
    );
  }
  const mastery = card ? masteryOf(card) : null;
  const alts = word.sentences.flatMap((s) => s.alts ?? []).filter((a, i, arr) => arr.findIndex((b) => b.w.toLowerCase() === a.w.toLowerCase()) === i);

  return (
    <div className="screen sub">
      <SubHeader title="단어 정보" />
      <section className="word-hero">
        <div className="word-hero-top">
          <span className="word-big">{word.word}</span>
          {canSpeak() && (
            <button className="icon-btn" onClick={() => speak(word.word)} aria-label="발음 듣기">
              <Icon name="speaker" size={22} />
            </button>
          )}
        </div>
        <div className="word-tags">
          <span className="chip">{POS_KO[word.pos]}</span>
          <span className="chip blue">레벨 {word.level}</span>
          {mastery && <span className={`chip m-${mastery}`}>{MASTERY_KO[mastery]}</span>}
        </div>
        <p className="word-mean">{word.meanings.join(', ')}</p>
        {card && (
          <p className="muted small">
            {formatAfter(card.due)} 복습 · 학습 {card.reps}회 · 잊음 {card.lapses}회
          </p>
        )}
      </section>

      <h3 className="sec-title">예문</h3>
      {word.sentences.map((s, i) => (
        <div key={i} className="sent-item">
          {s.ctx && <p className="ctx">{s.ctx}</p>}
          <p className="sent-en">
            <FilledSentence sentence={s} />
          </p>
          <p className="sent-ko">
            <KoSentence ko={s.ko} />
          </p>
          {s.note && <p className="note">※ {s.note}</p>}
          <div className="sent-actions">
            <button className="icon-btn small" onClick={() => speak(fullSentence(s.en, s.answer))} aria-label="듣기">
              <Icon name="speaker" size={18} />
            </button>
          </div>
        </div>
      ))}

      {word.nuance && (
        <>
          <h3 className="sec-title">뉘앙스</h3>
          <div className="text-card">{word.nuance}</div>
        </>
      )}
      {word.etymology && (
        <>
          <h3 className="sec-title">어원</h3>
          <div className="text-card">{word.etymology}</div>
        </>
      )}
      {alts.length > 0 && (
        <>
          <h3 className="sec-title">헷갈리기 쉬운 답</h3>
          {alts.map((a, i) => {
            const tone = ALT_TONE[a.t];
            return (
              <div key={i} className="wrong-item">
                <div className="wrong-head">
                  <span className="wrong-w">{a.w}</span>
                  <span className={`tag ${tone}`}>{TAG[tone]}</span>
                </div>
                <p>{a.m}</p>
              </div>
            );
          })}
        </>
      )}
      {logs && logs.length > 0 && (
        <>
          <h3 className="sec-title">학습 기록</h3>
          <ul className="log-list">
            {logs.map((l) => (
              <li key={l.id}>
                {new Date(l.ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                {RATING_KO[l.rating] ?? l.rating}
                {l.hints ? ' · 힌트' : ''}
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
