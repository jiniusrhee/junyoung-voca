import type { ReactNode } from 'react';
import { answerWords, layoutSentence, splitBold, splitInput } from '../lib/text';
import type { StoredWord, Tone, WordSentence } from '../types';
import Icon from './Icon';

export type CardBadge = { kind: 'new' } | { kind: 'ago'; text: string } | { kind: 'due'; text: string };

interface Props {
  word: StoredWord;
  sentence: WordSentence;
  /** 문제 풀이 중(question) / 정답 후(answered) */
  state: 'question' | 'answered';
  input: string;
  showedAnswer: boolean;
  showCaret: boolean;
  blankMatchesLength: boolean;
  flash: { kind: 'wrong' | 'correct'; key: number } | null;
  feedback: { tone: Tone; msg: string; mask?: { text: string; bad: boolean }[] } | null;
  /** 힌트로 채워져 지워지지 않는 앞글자 수 (초록으로 표시, 말해보카) */
  lockedLen?: number;
  /** 오답 말풍선의 ♥: 이 설명을 좋아하는 오답노트에 담기 */
  onFavoriteNote?: () => void;
  noteFavorite?: boolean;
  badge: CardBadge;
  favorite: boolean;
  onToggleFavorite: () => void;
  onLevelHelp: () => void;
  overlay?: ReactNode;
  levelHelp?: boolean;
}

export function KoSentence({ ko }: { ko: string }) {
  return (
    <>
      {splitBold(ko).map((s, i) =>
        s.bold ? (
          <em key={i} className="hl">
            {s.text}
          </em>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

/** 빈칸에 정답이 채워진 영어 문장 (정답 단어는 하늘색 칸) */
export function FilledSentence({ sentence }: { sentence: WordSentence }) {
  const words = answerWords(sentence.answer);
  return (
    <>
      {layoutSentence(sentence.en, sentence.answer).map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.text}</span>
        ) : (
          <span key={i} className="blank filled">
            {words[seg.idx]}
          </span>
        ),
      )}
    </>
  );
}

export default function QuizCard(p: Props) {
  const { word, sentence, state, input, showedAnswer, flash, feedback, badge, onFavoriteNote, noteFavorite, lockedLen = 0 } = p;
  const words = answerWords(sentence.answer);
  const typed = splitInput(input, words.length);
  const spaces = (input.replace(/^\s+/, '').match(/ /g) || []).length;
  const active = Math.min(spaces, words.length - 1);
  const flashCls = flash ? (flash.kind === 'wrong' ? 'is-wrong' : 'is-correct') : '';

  return (
    <div className="qcard-wrap">
      <div className="qcard-head">
        <button className="qcard-tab" onClick={p.onLevelHelp}>
          레벨 {word.level} <span className="tab-q">?</span>
        </button>
        <div className="qcard-badges">
          {state === 'answered' && (
            <button className={`heart-btn ${p.favorite ? 'on' : ''}`} onClick={p.onToggleFavorite} aria-label="좋아하는 문장">
              <Icon name={p.favorite ? 'heartFill' : 'heart'} size={18} />
            </button>
          )}
          {badge.kind === 'new' && <span className="badge-new">New</span>}
          {badge.kind === 'ago' && <span className="badge-ago">{badge.text}</span>}
          {badge.kind === 'due' && <span className="badge-due">{badge.text}</span>}
        </div>
      </div>
      {p.levelHelp && (
        <div className="level-help">
          레벨은 단어의 난이도예요. 1이 가장 일상적인 단어, 30이 가장 어려운 단어예요.
        </div>
      )}
      <div className={`qcard ${flashCls}`} key={flash?.key ?? 0}>
        {flash?.kind === 'correct' && (
          <span className="mark-check">
            <Icon name="check" size={56} />
          </span>
        )}
        {flash?.kind === 'wrong' && <span className="mark-bang">!</span>}
        <div className="qcard-top">
          {sentence.ctx && <p className="ctx">{sentence.ctx}</p>}
          <p className="ko">
            <KoSentence ko={sentence.ko} />
          </p>
          {sentence.note && <p className="note">※ {sentence.note}</p>}
        </div>
        {feedback && (
          <div className={`pill ${feedback.tone}`}>
                        <span>
              {feedback.mask && (
                <>
                  {feedback.mask.map((m, k) => (
                    <b key={k} className={m.bad ? 'mask-bad' : 'mask-ok'}>
                      {m.text}
                    </b>
                  ))}
                  {' - '}
                </>
              )}
              {feedback.msg}
            </span>
            {feedback.tone !== 'info' && onFavoriteNote && (
              <button className={`pill-heart ${noteFavorite ? 'on' : ''}`} onClick={onFavoriteNote} aria-label="오답노트에 담기">
                <Icon name={noteFavorite ? 'heartFill' : 'heart'} size={18} />
              </button>
            )}
          </div>
        )}
        <div className="qcard-bottom">
          <p className="en">
            {layoutSentence(sentence.en, sentence.answer).map((seg, i) => {
              if (seg.kind === 'text') return <span key={i}>{seg.text}</span>;
              const target = words[seg.idx];
              if (state === 'answered') {
                return (
                  <span key={i} className="blank filled">
                    {target}
                  </span>
                );
              }
              const t = typed[seg.idx];
              const ghost = showedAnswer && target.toLowerCase().startsWith(t.toLowerCase()) ? target.slice(t.length) : '';
              // 칸 너비 = 정답 글자의 실제 너비(같은 글꼴로 숨겨서 잼). 더 길게 치면 글자에 맞춰 늘어난다 (말해보카)
              const sizer = p.blankMatchesLength ? target : 'abc';
              // 앞 단어가 맞으면 초록으로 잠긴다
              const ok = seg.idx < active && t.toLowerCase() === target.toLowerCase();
              return (
                <span key={i} className={`blank ${seg.idx === active ? 'active' : ''} ${ok ? 'ok' : ''}`}>
                  <span className="blank-text">
                    {seg.idx === 0 && lockedLen > 0 && !ok ? (
                      <>
                        <span className="typed lock">{t.slice(0, lockedLen)}</span>
                        <span className="typed">{t.slice(lockedLen)}</span>
                      </>
                    ) : (
                      <span className="typed">{ok ? target : t}</span>
                    )}
                    {p.showCaret && seg.idx === active && <span className="caret" />}
                    {ghost && <span className="ghost">{ghost}</span>}
                  </span>
                  <span className="blank-size" aria-hidden="true">
                    {sizer}
                  </span>
                </span>
              );
            })}
          </p>
          <p className="source">[어휘 출처] 준영보카 레벨 {word.level} 단어장</p>
        </div>
        {p.overlay}
      </div>
    </div>
  );
}
