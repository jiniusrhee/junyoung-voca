import { useRef, type PointerEvent } from 'react';
import Icon from './Icon';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onEnter: () => void;
  onSettings: () => void;
  /** 다음 글자를 대문자로 (문장 첫 글자) — 자판 글자도 대문자로 보임 */
  shift?: boolean;
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
    fn();
    stop();
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(fn, 55);
    }, 380);
  };
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop };
}

/** 말해보카처럼 앱 안에 그린 영문 자판 (폰 기본 키보드를 띄우지 않음) */
export default function Keyboard({ onChar, onBackspace, onSpace, onEnter, onSettings, shift = false }: Props) {
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };
  const hold = useHoldRepeat(onBackspace);
  return (
    <div className="kb" role="group" aria-label="영문 자판">
      {ROWS.map((row, r) => (
        <div key={row} className={`kb-row r${r}`}>
          {r === 2 && (
            <button className="kb-key gray" onPointerDown={press(() => onChar("'"))} aria-label="아포스트로피">
              &apos;
            </button>
          )}
          {row.split('').map((c) => (
            <button key={c} className="kb-key" onPointerDown={press(() => onChar(shift ? c.toUpperCase() : c))} aria-label={c}>
              {shift ? c.toUpperCase() : c}
            </button>
          ))}
          {r === 2 && (
            <button className="kb-key gray" {...hold} aria-label="지우기">
              <Icon name="backspace" size={22} />
            </button>
          )}
        </div>
      ))}
      <div className="kb-row bottom">
        <button className="kb-key gray wide" onPointerDown={press(onSettings)} aria-label="설정" />
        <button className="kb-key space" onPointerDown={press(onSpace)} aria-label="띄어쓰기">
          <span className="space-glyph" />
        </button>
        <button className="kb-key gray wide" onPointerDown={press(onEnter)}>
          <Icon name="check" size={16} /> 확인
        </button>
      </div>
    </div>
  );
}
