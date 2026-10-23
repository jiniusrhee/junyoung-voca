import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { FilledSentence, KoSentence } from '../components/QuizCard';
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

/** 단어 사전 상세 (말해보카 2026 구성: 발음 기호, 영영 풀이 토글, 변화형/영영사전/어원 탭) */
export default function WordDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const wordId = decodeURIComponent(id);
  const word = useLiveQuery(() => db.words.get(wordId), [wordId]);
  const card = useLiveQuery(() => db.cards.get(wordId), [wordId]);
  const logs = useLiveQuery(() => db.reviews.where('wordId').equals(wordId).reverse().sortBy('ts'), [wordId]);
  const [exIdx, setExIdx] = useState(0);
  const [engDef, setEngDef] = useState(() => localStorage.getItem('engDef') !== '0');
  const [open, setOpen] = useState(true);
  const [more, setMore] = useState(false);
  const wordbook = useWordbook();
  const refs = {
    forms: useRef<HTMLHeadingElement>(null),
    mean: useRef<HTMLElement>(null),
    etym: useRef<HTMLHeadingElement>(null),
    alts: useRef<HTMLHeadingElement>(null),
  };

  if (word === undefined) {
    return (
      <div className="screen sub">
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }
  if (!word) {
    return (
      <div className="screen sub">
        <p className="empty-note">단어를 찾을 수 없어요.</p>
      </div>
    );
  }
  const mastery = card ? masteryOf(card) : null;
  const alts = word.sentences.flatMap((s) => s.alts ?? []).filter((a, i, arr) => arr.findIndex((b) => b.w.toLowerCase() === a.w.toLowerCase()) === i);
  const ex = word.sentences[exIdx % word.sentences.length];
  const inBook = wordbook?.includes(word.id) ?? false;
  const go = (k: keyof typeof refs) => refs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const toggleDef = () => {
    setEngDef((v) => {
      localStorage.setItem('engDef', v ? '0' : '1');
      return !v;
    });
  };

  return (
    <div className="screen sub word-page">
      <header className="wd-head">
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="뒤로">
          <Icon name="back" size={22} />
        </button>
        <button className={`def-toggle ${engDef ? 'on' : ''}`} onClick={toggleDef}>
          영영 풀이 <span>{engDef ? 'ON' : 'OFF'}</span>
        </button>
      </header>
      <section className="dict-hero">
        <h1 className="word-big">{word.word}</h1>
        {word.ipa && <p className="word-ipa">{word.ipa}</p>}
        <div className="listen-row">
          <button className="listen-pill" onClick={() => speak(word.word)}>
            <Icon name="speaker" size={16} /> 발음 듣기
          </button>
          <button className="listen-more" onClick={() => setMore((v) => !v)} aria-label="더 보기">
            ⋮
          </button>
          {more && (
            <div className="lw-pop">
              <button onClick={() => speak(word.word, true)}>
                <Icon name="speaker" size={16} /> 천천히 듣기
              </button>
              <button onClick={() => void toggleWordbook(word.id).then(() => setMore(false))}>
                <Icon name="bookmark" size={16} /> {inBook ? '단어장에서 빼기' : '단어장에 추가'}
              </button>
            </div>
          )}
        </div>
      </section>
      <nav className="dict-tabs">
        <button onClick={() => go('forms')} disabled={!word.forms?.length}>
          변화형
        </button>
        <button className="active" onClick={() => go('mean')}>
          영영사전
        </button>
        <button onClick={() => go('etym')} disabled={!word.etymology}>
          어원
        </button>
        <button onClick={() => go('alts')} disabled={!alts.length}>
          헷갈리는 답
        </button>
      </nav>

      <section className="mean-card" ref={refs.mean}>
        <div className="mean-tags">
          <span className="chip">{POS_KO[word.pos]}</span>
          <span className="chip level">레벨 {word.level}</span>
          <button className={`mean-plus ${inBook ? 'on' : ''}`} onClick={() => void toggleWordbook(word.id)} aria-label="단어장">
            {inBook ? '✓' : '+'}
          </button>
        </div>
        <p className="mean-text">{word.meanings.join(', ')}</p>
        {word.nuance && <p className="mean-nuance">{word.nuance}</p>}
        {engDef && word.def && <p className="mean-def">{word.def}</p>}
        <button className="mean-fold" onClick={() => setOpen((v) => !v)} aria-label={open ? '접기' : '펼치기'}>
          <Icon name="chevron" size={18} className={open ? 'up' : ''} />
        </button>
        {open && (
          <div className="ex-box">
            <span className="box-tag">예문</span>
            {word.sentences.length > 1 && (
              <button className="ex-next" onClick={() => setExIdx((i) => i + 1)} aria-label="다음 예문">
                <Icon name="chevron" size={18} />
              </button>
            )}
            <p className="ex-en">
              <FilledSentence sentence={ex} />
            </p>
            {ex.ctx && <p className="ctx">{ex.ctx}</p>}
            <p className="ex-ko">
              <KoSentence ko={ex.ko} />
            </p>
            {ex.note && <p className="note left">※ {ex.note}</p>}
            <button className="ex-listen" onClick={() => speak(fullSentence(ex.en, ex.answer))} aria-label="예문 듣기">
              <Icon name="speaker" size={18} />
            </button>
          </div>
        )}
        <div className="mean-foot">
          <span className="mean-record">
            {card ? (
              <>
                총 {card.reps}회 학습, {formatAfter(card.due)} 복습{mastery ? ` · ${MASTERY_KO[mastery]}` : ''}
              </>
            ) : (
              '아직 학습하지 않은 단어예요'
            )}
          </span>
          <button className={`wb-add ${inBook ? 'on' : ''}`} onClick={() => void toggleWordbook(word.id)}>
            {inBook ? '✓ 학습에 추가됨' : '+ 학습에 추가'}
          </button>
        </div>
      </section>

      {word.forms && word.forms.length > 0 && (
        <>
          <h3 className="sec-title" ref={refs.forms}>
            변화형
          </h3>
          <div className="text-card forms-card">
            {word.forms.map((f) => {
              const m = f.match(/^(.*?)\s*\((.*)\)$/);
              return (
                <button key={f} className="form-row" onClick={() => speak(m ? m[1] : f)}>
                  <b>{m ? m[1] : f}</b>
                  {m && <span>{m[2]}</span>}
                  <Icon name="speaker" size={14} />
                </button>
              );
            })}
          </div>
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
      <button className="wd-close" onClick={() => nav(-1)} aria-label="닫기">
        <Icon name="close" size={22} />
      </button>
    </div>
  );
}
