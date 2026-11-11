import { Fragment, type ReactNode } from 'react';
import { answerWords, layoutSentence, splitBold, splitInput, type SentenceSeg } from '../lib/text';
import type { StoredWord, Tone, WordSentence } from '../types';
import Icon from './Icon';
import KoText from './KoText';

/** 카드 오른쪽 위 배지: New / N일 전 / 재도전(틀렸던 단어) / N 뒤 복습(정답 뒤) — 말해보카 */
export type CardBadge = { kind: 'new' } | { kind: 'ago'; text: string } | { kind: 'retry' } | { kind: 'due'; text: string };

/** 카드 반응: wrong = '!' 도장 + 카드가 1초 붉어짐(오타 포함 모든 오답 — 말해보카 실측 2026-11-10), correct = 초록 체크 도장 */
export type CardFlash = { kind: 'wrong' | 'correct'; key: number } | null;

interface Props {
  word: StoredWord;
  sentence: WordSentence;
  /** 문제 풀이 중(question) / 정답 후(answered) */
  state: 'question' | 'answered';
  input: string;
  showedAnswer: boolean;
  showCaret: boolean;
  blankMatchesLength: boolean;
  flash: CardFlash;
  feedback: { tone: Tone; msg: string; mask?: { text: string; bad: boolean }[] } | null;
  /** 힌트로 보여 준 앞글자: 입력이 비어 있을 때 첫 칸에 주황 고스트로 남는다 (말해보카 실측) */
  hintText?: string;
  /** 오답 말풍선의 ♥: 이 설명을 좋아하는 오답노트에 담기 */
  onFavoriteNote?: () => void;
  noteFavorite?: boolean;
  badge: CardBadge;
  /** 정답 뒤 배지 왼쪽의 ♥ 버튼 (말해보카: 정답 0.55초 뒤에 나타남) */
  heart: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
  onLevelHelp: () => void;
  onBadgeHelp?: () => void;
  /** [어휘 출처] 줄 */
  source?: string;
  overlay?: ReactNode;
  levelHelp?: boolean;
}

/**
 * 하이픈으로 이어진 칸들(up-and-coming)은 한 단어처럼 줄 끝에서 갈라지지 않는다(말해보카 실측: 묶음째 다음 줄로 넘어감).
 * 띄어쓰기로 나뉜 칸들은 보통 낱말처럼 사이에서 줄이 바뀔 수 있다.
 */
function groupSegs(segs: SentenceSeg[]): { joined: boolean; segs: SentenceSeg[] }[] {
  const out: { joined: boolean; segs: SentenceSeg[] }[] = [];
  let i = 0;
  while (i < segs.length) {
    const s = segs[i];
    if (s.kind === 'blank') {
      const run: SentenceSeg[] = [s];
      let j = i + 1;
      while (j + 1 < segs.length) {
        const sep = segs[j];
        const nxt = segs[j + 1];
        if (sep.kind === 'text' && sep.text === '-' && nxt.kind === 'blank') {
          run.push(sep, nxt);
          j += 2;
        } else break;
      }
      out.push({ joined: run.length > 1, segs: run });
      i = j;
    } else {
      out.push({ joined: false, segs: [s] });
      i += 1;
    }
  }
  return out;
}

export function KoSentence({ ko }: { ko: string }) {
  return (
    <>
      {splitBold(ko).map((s, i) =>
        s.bold ? (
          <em key={i} className="hl">
            <KoText text={s.text} />
          </em>
        ) : (
          <span key={i}>
            <KoText text={s.text} />
          </span>
        ),
      )}
    </>
  );
}

/** 빈칸에 정답이 채워진 영어 문장 (정답 단어는 초록 칸) */
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
  const { word, sentence, state, input, showedAnswer, flash, feedback, badge, onFavoriteNote, noteFavorite, hintText = '' } = p;
  const words = answerWords(sentence.answer);
  const typed = splitInput(input, words.length);
  // 힌트로 보여 준 글자를 칸별로 나눈 것 (입력을 다 지웠을 때의 주황 고스트, 정답 보기의 초록 부분에 쓴다)
  const hintParts = splitInput(hintText, words.length);
  const spaces = (input.replace(/^\s+/, '').match(/ /g) || []).length;
  const active = Math.min(spaces, words.length - 1);
  const flashCls = flash ? `is-${flash.kind}` : '';
  // 말해보카: 정답 보기를 누르면 입력이 비워지고 정답 전체가 칸에 비친다 (힌트로 본 앞글자는 초록, 나머지는 주황). 한 글자라도 치면 사라진다
  const ghostFull = showedAnswer && input === '';

  return (
    <div className="qcard-wrap">
      <div className="qcard-head">
        <button className="qcard-tab" onClick={p.onLevelHelp}>
          레벨 {word.level} <span className="tab-q">?</span>
        </button>
        <div className="qcard-badges">
          {p.heart && (
            <button className={`heart-btn ${p.favorite ? 'on' : ''}`} onClick={p.onToggleFavorite} aria-label="좋아하는 문장">
              <Icon name="heartFill" size={16} />
            </button>
          )}
          {badge.kind === 'new' && (
            <button className="badge-new" onClick={p.onBadgeHelp}>
              New
            </button>
          )}
          {badge.kind === 'ago' && (
            <button className="badge-ago" onClick={p.onBadgeHelp}>
              {badge.text}
            </button>
          )}
          {badge.kind === 'retry' && (
            <button className="badge-retry" onClick={p.onBadgeHelp}>
              재도전 <span className="tab-q">?</span>
            </button>
          )}
          {badge.kind === 'due' && (
            <button className="badge-due" onClick={p.onBadgeHelp}>
              {badge.text}
            </button>
          )}
        </div>
      </div>
      {p.levelHelp && <div className="level-help">레벨은 단어의 난이도예요. 1이 가장 일상적인 단어, 30이 가장 어려운 단어예요.</div>}
      <div className={`qcard ${flashCls}`} key={flash?.key ?? 0}>
        {flash?.kind === 'correct' && (
          <span className="mark-check" aria-hidden="true">
            {/* 말해보카 실측: 폭 105 × 높이 68 CSS px, 획 16px, 카드 위 40px 에서 시작해 28px 겹침 */}
            <svg viewBox="0 0 110 72">
              <polyline points="10,38 42,62 100,10" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {flash?.kind === 'wrong' && <span className="mark-bang">!</span>}
        <div className="qcard-top">
          {sentence.ctx && (
            <p className="ctx">
              <KoText text={sentence.ctx} />
            </p>
          )}
          <p className="ko">
            <KoSentence ko={sentence.ko} />
          </p>
          {sentence.note && (
            <p className="note">
              ※ <KoText text={sentence.note} />
            </p>
          )}
        </div>
        {feedback && (
          <div className={`pill ${feedback.tone}`}>
            <span>
              {feedback.mask && (
                <>
                  <span lang="en">
                    {feedback.mask.map((m, k) => (
                      <b key={k} className={m.bad ? 'mask-bad' : 'mask-ok'}>
                        {m.text}
                      </b>
                    ))}
                  </span>
                  {' - '}
                </>
              )}
              <KoText text={feedback.msg} />
            </span>
            {feedback.tone !== 'info' && onFavoriteNote && (
              <button className={`pill-heart ${noteFavorite ? 'on' : ''}`} onClick={onFavoriteNote} aria-label="오답노트에 담기">
                <Icon name={noteFavorite ? 'heartFill' : 'heart'} size={18} />
              </button>
            )}
          </div>
        )}
        <div className="qcard-bottom">
          <p className="en" lang="en">
            {groupSegs(layoutSentence(sentence.en, sentence.answer)).map((grp, gi) => {
              const nodes = grp.segs.map((seg, i) => {
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
              // 칸 너비 = 정답 글자의 실제 너비(같은 글꼴로 숨겨서 잼). 더 길게 치면 글자에 맞춰 늘어난다 (말해보카)
              const sizer = p.blankMatchesLength ? target : 'abc';
              // 앞 칸이 맞으면 초록으로 잠긴다
              const ok = seg.idx < active && t.toLowerCase() === target.toLowerCase();
              const isActive = seg.idx === active;
              return (
                <span key={i} className={`blank ${isActive ? 'active' : ''} ${ok ? 'ok' : ''}`}>
                  <span className="blank-text">
                    {ghostFull ? (
                      <>
                        {p.showCaret && isActive && <span className="caret" />}
                        {hintParts[seg.idx] && <span className="ghost pre">{target.slice(0, hintParts[seg.idx].length)}</span>}
                        <span className="ghost">{target.slice(hintParts[seg.idx]?.length ?? 0)}</span>
                      </>
                    ) : (
                      <>
                        <span className="typed">{ok ? target : t}</span>
                        {p.showCaret && isActive && <span className="caret" />}
                        {input === '' && hintParts[seg.idx] && <span className="ghost">{hintParts[seg.idx]}</span>}
                      </>
                    )}
                  </span>
                  <span className="blank-size" aria-hidden="true">
                    {sizer}
                  </span>
                </span>
              );
              });
              return grp.joined ? (
                <span key={gi} className="blank-group">
                  {nodes}
                </span>
              ) : (
                <Fragment key={gi}>{nodes}</Fragment>
              );
            })}
          </p>
          <p className="source">[어휘 출처] {p.source ?? `준영보카 레벨 ${word.level} 단어장`}</p>
        </div>
        {p.overlay}
      </div>
    </div>
  );
}
