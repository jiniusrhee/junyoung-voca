import { useState, type PointerEvent } from 'react';
import Icon from './Icon';

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const NUMS = ['1234567890', '-/:;()$&@', ".,?!'"];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}

/** 실전 회화용 문장 자판: 자동 대문자, 쉼표·마침표, 123 */
export default function SentenceKeyboard({ value, onChange, onEnter }: Props) {
  const [manualShift, setManualShift] = useState<boolean | null>(null);
  const [nums, setNums] = useState(false);
  const auto = value.trim() === '' || /[.?!]\s*$/.test(value);
  const shift = manualShift ?? auto;
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    fn();
  };
  const type = (c: string) => {
    onChange(value + (shift && /[a-z]/.test(c) ? c.toUpperCase() : c));
    setManualShift(null);
  };
  const rows = nums ? NUMS : LETTERS;
  return (
    <div className="kb sentence" role="group" aria-label="영문 자판">
      {rows.map((row, r) => (
        <div key={row} className={`kb-row r${r}`}>
          {r === 2 && !nums && (
            <button className={`kb-key gray ${shift ? 'on' : ''}`} onPointerDown={press(() => setManualShift(!shift))} aria-label="대문자">
              <Icon name="shift" size={20} />
            </button>
          )}
          {row.split('').map((c) => (
            <button key={c} className="kb-key" onPointerDown={press(() => type(c))} aria-label={c}>
              {shift && !nums ? c.toUpperCase() : c}
            </button>
          ))}
          {r === 2 && (
            <button className="kb-key gray" onPointerDown={press(() => onChange(value.slice(0, -1)))} aria-label="지우기">
              <Icon name="backspace" size={22} />
            </button>
          )}
        </div>
      ))}
      <div className="kb-row bottom">
        <button className="kb-key gray wide" onPointerDown={press(() => setNums((v) => !v))}>
          {nums ? 'ABC' : '123'}
        </button>
        <button className="kb-key gray" onPointerDown={press(() => type(','))}>
          ,
        </button>
        <button className="kb-key space" onPointerDown={press(() => onChange(value && !value.endsWith(' ') ? value + ' ' : value))} aria-label="띄어쓰기">
          <span className="space-glyph" />
        </button>
        <button className="kb-key gray" onPointerDown={press(() => type('.'))}>
          .
        </button>
        <button className="kb-key gray wide" onPointerDown={press(onEnter)}>
          <Icon name="check" size={16} /> 확인
        </button>
      </div>
    </div>
  );
}
