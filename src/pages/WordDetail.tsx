import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { FilledSentence, KoSentence } from '../components/QuizCard';
import SubHeader from '../components/SubHeader';
import WrongItem from '../components/WrongItem';
import { db } from '../db';
import { MASTERY_KO, masteryOf } from '../lib/scheduler';
import { speak } from '../lib/speech';
import { fullSentence } from '../lib/text';
import { formatAfter } from '../lib/time';
import { toggleWordbook, useWordbook } from '../lib/wordbook';
import { POS_KO, type Tone } from '../types';

const RATING_KO: Record<number, string> = { 1: '틀림', 2: '헷갈림', 3: '정답', 4: '쉬움' };
const ALT_TONE: Record<string, Tone> = { ok: 'green', near: 'yellow', wrong: 'red' };

export default function WordDetail() {
  const { id = '' } = useParams();
  const wordId = decodeURIComponent(id);
  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const card = useLiveQuery(() => db.cards.get(wordId), [wordId]);
  const logs = useLiveQuery(() => db.reviews.where('wordId').equals(wordId).reverse().sortBy('ts'), [wordId]);
  const [exIdx, setExIdx] = useState(0);
  const wordbook = useWordbook();
  const refs = {
    nuance: useRef<HTMLHeadingElement>(null),
    etym: useRef<HTMLHeadingElement>(null),
    alts: useRef<HTMLHeadingElement>(null),
  };

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
  const ex = word.sentences[exIdx % word.sentences.length];
  const go = (k: keyof typeof refs) => refs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="screen sub word-page">
      <SubHeader title="" />
      <section className="dict-hero">
        <h1 className="word-big">{word.word}</h1>
        <button className="listen-pill" onClick={() => speak(word.word)}>
          <Icon name="speaker" size={16} /> 발음 듣기
        </button>
      </section>
      <nav className="dict-tabs">
        <button className="active">뜻</button>
        <button onClick={() => go('nuance')} disabled={!word.nuance}>
          뉘앙스
        </button>
        <button onClick={() => go('etym')} disabled={!word.etymology}>
          어원
        </button>
        <button onClick={() => go('alts')} disabled={!alts.length}>
          헷갈리는 답
        </button>
      </nav>

      <section className="mean-card">
        <div className="mean-tags">
          <span className="chip">{POS_KO[word.pos]}</span>
          <span className="chip level">레벨 {word.level}</span>
        </div>
        <p className="mean-text">{word.meanings.join(', ')}</p>
        <div className="ex-box">
          <span className="box-tag">예문</span>
          {word.sentences.length > 1 && (
            <button className="ex-next" onClick={() => setExIdx((i) => i + 1)} aria-label="다음 예문">
              <Icon name="chevron" size={18} />
            </button>
          )}
          {ex.ctx && <p className="ctx">{ex.ctx}</p>}
          <p className="ex-en">
            <FilledSentence sentence={ex} />
          </p>
          <p className="ex-ko">
            <KoSentence ko={ex.ko} />
          </p>
          {ex.note && <p className="note left">※ {ex.note}</p>}
          <button className="ex-listen" onClick={() => speak(fullSentence(ex.en, ex.answer))} aria-label="예문 듣기">
            <Icon name="speaker" size={18} />
          </button>
        </div>
        <div className="mean-record">
          <span className="box-tag">기록</span>
          {card ? (
            <span>
              총 {card.reps}회 학습, {formatAfter(card.due)} 복습{mastery ? ` · ${MASTERY_KO[mastery]}` : ''}
            </span>
          ) : (
            <span>아직 학습하지 않은 단어예요</span>
          )}
          <button className={`wb-add ${wordbook?.includes(word.id) ? 'on' : ''}`} onClick={() => void toggleWordbook(word.id)}>
            {wordbook?.includes(word.id) ? '✓ 단어장에 담김' : '+ 단어장에 추가'}
          </button>
        </div>
      </section>

      {word.nuance && (
        <>
          <h3 className="sec-title" ref={refs.nuance}>
            뉘앙스
          </h3>
          <div className="text-card">{word.nuance}</div>
        </>
      )}
      {word.etymology && (
        <>
          <h3 className="sec-title" ref={refs.etym}>
            어원
          </h3>
          <div className="text-card">{word.etymology}</div>
        </>
      )}
      {alts.length > 0 && (
        <>
          <h3 className="sec-title" ref={refs.alts}>
            헷갈리기 쉬운 답
          </h3>
          {alts.map((a, i) => (
            <WrongItem key={i} w={a.w} tone={ALT_TONE[a.t]} m={a.m} />
          ))}
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
