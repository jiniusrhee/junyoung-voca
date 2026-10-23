import type { PointerEvent } from 'react';
import Icon from './Icon';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface Props {
  onChar: (c: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onEnter: () => void;
  onSettings: () => void;
}

/** 말해보카처럼 앱 안에 그린 영문 자판 (폰 기본 키보드를 띄우지 않음) */
export default function Keyboard({ onChar, onBackspace, onSpace, onEnter, onSettings }: Props) {
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };
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
            <button key={c} className="kb-key" onPointerDown={press(() => onChar(c))}>
              {c}
            </button>
          ))}
          {r === 2 && (
            <button className="kb-key gray" onPointerDown={press(onBackspace)} aria-label="지우기">
              <Icon name="backspace" size={22} />
            </button>
          )}
        </div>
      ))}
      <div className="kb-row bottom">
        <button className="kb-key gray wide" onPointerDown={press(onSettings)}>
          <Icon name="gear" size={16} /> 설정
        </button>
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
