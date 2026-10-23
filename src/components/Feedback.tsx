import type { Outcome } from '../lib/scheduler';
import type { Question } from '../lib/session';
import { canSpeak, speak } from '../lib/speech';
import { splitBlank, splitBold } from '../lib/text';
import { formatRelative } from '../lib/time';
import { POS_KO } from '../types';

export interface Answered {
  question: Question;
  outcome: Outcome;
  grade: number;
  known: boolean;
  due: Date;
  correct: boolean;
}

export default function Feedback({ answered, onNext }: { answered: Answered; onNext: () => void }) {
  const { question: q, outcome, known, due, correct } = answered;
  const w = q.word;
  const sent = w.sentences[q.sentenceIdx];
  const [before, after] = splitBlank(sent.en);
  const title = correct ? (known ? '정답! 이미 아는 단어네요' : '정답!') : outcome.showedAnswer ? '정답을 확인했어요' : '맞혔지만 조금 헷갈렸어요';
  const cls = correct ? 'good' : outcome.showedAnswer ? 'bad' : 'soso';

  return (
    <div className="feedback">
      <div className={`result-banner ${cls}`}>{title}</div>
      <p className="sentence-en">
        {before}
        <mark>{sent.answer}</mark>
        {after}
      </p>
      <p className="sentence-ko muted">
        {splitBold(sent.ko).map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
      </p>
      <div className="word-card">
        <div className="word-head">
          <span className="word">{w.word}</span>
          <span className="chip pos">{POS_KO[w.pos]}</span>
          {canSpeak() && (
            <button className="icon-btn" onClick={() => speak(w.word)} aria-label="발음 듣기">
              🔊
            </button>
          )}
        </div>
        <p className="meanings">{w.meanings.join(' · ')}</p>
        {w.nuance && (
          <div className="note">
            <span className="note-label">뉘앙스</span>
            <p>{w.nuance}</p>
          </div>
        )}
        {w.etymology && (
          <div className="note">
            <span className="note-label">어원</span>
            <p>{w.etymology}</p>
          </div>
        )}
      </div>
      <p className="next-due muted small">
        {known ? `이미 아는 단어로 분류했어요 · 다음 확인 ${formatRelative(due)}` : `다음 복습: ${formatRelative(due)}`}
      </p>
      <button className="btn primary big" onClick={onNext}>
        다음
      </button>
    </div>
  );
}
