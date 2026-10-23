import { useEffect, useMemo, useRef, useState } from 'react';
import type { Question } from '../lib/session';
import { canRecognize, recognizeOnce } from '../lib/speech';
import { splitBlank, splitBold } from '../lib/text';
import { POS_KO, type Settings } from '../types';

interface Props {
  question: Question;
  hints: number;
  showedAnswer: boolean;
  message: string | null;
  shake: number;
  settings: Settings;
  inputMode: 'keyboard' | 'voice';
  onSubmit: (input: string) => void;
  onVoice: (alts: string[]) => void;
  onHint: () => void;
  onShowAnswer: () => void;
  onToggleMode: () => void;
}

export default function QuizCard(p: Props) {
  const { question: q, hints, showedAnswer, message, shake, settings, inputMode } = p;
  const sent = q.word.sentences[q.sentenceIdx];
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [before, after] = splitBlank(sent.en);
  const koSegs = useMemo(() => splitBold(sent.ko), [sent.ko]);

  useEffect(() => {
    if (inputMode === 'keyboard') inputRef.current?.focus();
  }, [inputMode]);
  useEffect(() => {
    if (shake > 0 && inputMode === 'keyboard') {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [shake, inputMode]);

  const cells = useMemo(() => {
    const a = sent.answer;
    const matchLen = settings.blankMatchesLength;
    const len = matchLen ? Math.max(a.length, input.length) : Math.max(input.length, 5);
    const out: { ch: string; cls: string }[] = [];
    for (let i = 0; i < len; i++) {
      const target = a[i];
      const t = input[i];
      if (t !== undefined) {
        const ok = target !== undefined && t.toLowerCase() === target.toLowerCase();
        out.push({ ch: t === ' ' ? ' ' : t, cls: settings.liveHint ? (ok ? 'ok' : 'bad') : 'typed' });
      } else if (matchLen && target === ' ') {
        out.push({ ch: ' ', cls: 'space' });
      } else if (matchLen && i < hints) {
        out.push({ ch: target ?? '', cls: 'hint' });
      } else {
        out.push({ ch: '_', cls: 'empty' });
      }
    }
    return out;
  }, [sent.answer, input, hints, settings.blankMatchesLength, settings.liveHint]);

  const submit = () => {
    if (!input.trim()) return;
    p.onSubmit(input);
  };

  const listen = async () => {
    setVoiceError(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      p.onVoice(alts);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setVoiceError(
        code === 'no-speech'
          ? '음성이 들리지 않았어요. 다시 눌러 말해 보세요'
          : code === 'not-allowed' || code === 'service-not-allowed'
            ? '마이크 권한을 허용해 주세요'
            : code === 'unsupported'
              ? '이 브라우저는 음성 인식을 지원하지 않아요'
              : '음성 인식에 실패했어요. 다시 시도해 주세요',
      );
    } finally {
      setListening(false);
    }
  };

  return (
    <div className="quiz-body">
      <div className="tags">
        <span className={`chip ${q.isNew ? 'new' : 'review'}`}>{q.isNew ? '새 단어' : '복습'}</span>
        <span className="chip pos">{POS_KO[q.word.pos]}</span>
      </div>
      <p className="sentence-ko">
        {koSegs.map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
      </p>
      <p className="sentence-en">
        {before}
        <span className={`blank ${shake ? 'shake' : ''}`} key={shake}>
          {cells.map((c, i) => (
            <span key={i} className={`cell ${c.cls}`}>
              {c.ch}
            </span>
          ))}
        </span>
        {after}
      </p>
      {!settings.blankMatchesLength && hints > 0 && <p className="hint-line">힌트: {sent.answer.slice(0, hints)}…</p>}
      {message && <p className={`msg ${showedAnswer ? 'info' : 'warn'}`}>{message}</p>}

      {inputMode === 'keyboard' ? (
        <div className="input-row">
          <input
            ref={inputRef}
            className="answer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="영어로 입력"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
          />
          <button className="btn primary" onClick={submit} disabled={!input.trim()}>
            확인
          </button>
        </div>
      ) : (
        <div className="voice-row">
          <button className={`mic ${listening ? 'listening' : ''}`} onClick={listen} disabled={listening || !canRecognize()}>
            {listening ? '듣고 있어요…' : '🎤 눌러서 말하기'}
          </button>
          {voiceError && <p className="msg warn">{voiceError}</p>}
          {!canRecognize() && <p className="msg warn">이 브라우저는 음성 인식을 지원하지 않아요</p>}
        </div>
      )}

      <div className="quiz-actions">
        <button className="btn ghost" onClick={p.onHint} disabled={hints >= 2 || showedAnswer}>
          힌트{hints < 2 ? ` (${2 - hints})` : ''}
        </button>
        <button className="btn ghost" onClick={p.onShowAnswer} disabled={showedAnswer}>
          정답 보기
        </button>
        <button className="btn ghost" onClick={p.onToggleMode}>
          {inputMode === 'keyboard' ? '🎤 음성으로' : '⌨️ 키보드로'}
        </button>
      </div>
    </div>
  );
}
