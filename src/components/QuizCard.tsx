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
  feedback: { tone: Tone; msg: string } | null;
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
  const { word, sentence, state, input, showedAnswer, flash, feedback, badge } = p;
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
            <Icon name="bulb" size={18} className="pill-icon" />
            <span>{feedback.msg}</span>
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
              const minCh = p.blankMatchesLength ? target.length : 3;
              const width = `${Math.max(minCh, t.length) * 0.62 + 0.9}em`;
              return (
                <span key={i} className={`blank ${seg.idx === active ? 'active' : ''}`} style={{ minWidth: width }}>
                  <span className="typed">{t}</span>
                  {p.showCaret && seg.idx === active && <span className="caret" />}
                  {ghost && <span className="ghost">{ghost}</span>}
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
