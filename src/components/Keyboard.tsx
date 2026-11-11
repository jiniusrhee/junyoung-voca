import { useRef, type PointerEvent } from 'react';
import { QBackspace, QOk } from './QuizIcons';
import { keyFeedback } from '../lib/sfx';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onEnter: () => void;
  /** (옛 동작) 빈 키를 대문자 키로 쓰고 싶을 때. 말해보카 실측(2026-11-08)에서는 빈 키 두 개 모두 아무 동작이 없어 기본은 없음 */
  onShift?: () => void;
  /** 다음 글자를 대문자로 (문장 첫 글자) — 자판 글자도 대문자로 보임 */
  shift?: boolean;
  /** 정답에 아포스트로피가 있을 때만 ' 키를 보여 준다 (말해보카 어휘 자판은 평소 빈 키) */
  apostrophe?: boolean;
}

/** 지우기 키를 꾹 누르면 반복해서 지워지는 핸들 */
export function useHoldRepeat(fn: () => void) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };
  const start = (e: PointerEvent) => {
    e.preventDefault();
    keyFeedback();
    fn();
    stop();
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(fn, 55);
    }, 380);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

/** 말해보카처럼 앱 안에 그린 영문 자판 (폰 기본 키보드를 띄우지 않음) */
export default function Keyboard({ onChar, onBackspace, onSpace, onEnter, onShift, shift = false, apostrophe = false }: Props) {
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    keyFeedback();
    fn();
  };
  const hold = useHoldRepeat(onBackspace);
  // 빈 키 두 개: 말해보카 실측(2026-11-08)에서는 아무 동작도 없다 (대문자 아님)
  const blank = onShift ? press(onShift) : (e: PointerEvent) => e.preventDefault();
  return (
    <div className="kb" role="group" aria-label="영문 자판">
      {ROWS.map((row, r) => (
        <div key={row} className={`kb-row r${r}`}>
          {r === 2 &&
            (apostrophe ? (
              <button className="kb-key gray" onPointerDown={press(() => onChar("'"))} aria-label="아포스트로피">
                &apos;
              </button>
            ) : (
              <button className="kb-key gray kb-blank" onPointerDown={blank} aria-hidden="true" tabIndex={-1} />
            ))}
          {row.split('').map((c) => (
            <button key={c} className="kb-key" onPointerDown={press(() => onChar(shift ? c.toUpperCase() : c))} aria-label={c}>
              {shift ? c.toUpperCase() : c}
            </button>
          ))}
          {r === 2 && (
            <button className="kb-key gray" {...hold} aria-label="지우기">
              <QBackspace />
            </button>
          )}
        </div>
      ))}
      <div className="kb-row bottom">
        <button className="kb-key gray wide kb-blank" onPointerDown={blank} aria-hidden="true" tabIndex={-1} />
        <button className="kb-key space" onPointerDown={press(onSpace)} aria-label="띄어쓰기">
          <span className="space-glyph" />
        </button>
        <button className="kb-key gray wide" onPointerDown={press(onEnter)}>
          <QOk />
          <span>확인</span>
        </button>
      </div>
    </div>
  );
}
