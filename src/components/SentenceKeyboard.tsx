import { useState, type PointerEvent } from 'react';
import { keyFeedback } from '../lib/sfx';
import { useHoldRepeat } from './Keyboard';
import { QBackspace, QOk } from './QuizIcons';

const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const NUMS = ['1234567890', '-/:;()$&@', ".,?!'\"-"];

interface Props {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}

const pressOn = (e: PointerEvent) => e.currentTarget.classList.add('pressed');
const pressOff = (e: PointerEvent) => e.currentTarget.classList.remove('pressed');
const release = { onPointerUp: pressOff, onPointerLeave: pressOff, onPointerCancel: pressOff };

/**
 * 실전 회화용 문장 자판 — 말해보카 플립 실측(2026-11-14).
 * 글자 키 30 x 43(#6a6a6a), 사이 5, 줄 간격 49.33. 셋째 줄 양 끝은 ⇧ · ⌫ (42, #464646), 넷째 줄은 123(62.67) · , · 띄어쓰기(140) · . · 확인(62.67).
 * 문장 첫 글자(와 . ? ! 뒤)는 저절로 대문자: 그때 ⇧ 는 속이 찬 화살표, 글자 키도 대문자로 보인다. 한 글자를 치면 소문자로 돌아간다.
 */
export default function SentenceKeyboard({ value, onChange, onEnter }: Props) {
  const [manualShift, setManualShift] = useState<boolean | null>(null);
  const [nums, setNums] = useState(false);
  // 저절로 대문자: 맨 처음, 그리고 문장이 끝나고 한 칸 띄운 뒤 (실제 앱: 마침표 바로 뒤에서는 소문자 그대로였다 — 'lively.many')
  const auto = value.trim() === '' || /[.?!]\s+$/.test(value);
  const shift = manualShift ?? auto;
  const press = (fn: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    pressOn(e);
    keyFeedback();
    fn();
  };
  const type = (c: string) => {
    onChange(value + (shift && /[a-z]/.test(c) ? c.toUpperCase() : c));
    setManualShift(null);
  };
  const rows = nums ? NUMS : LETTERS;
  const hold = useHoldRepeat(() => onChange(value.slice(0, -1)));
  return (
    <div className="skb" role="group" aria-label="영문 자판">
      {rows.map((row, r) => (
        <div key={row} className={`skb-row r${r}`}>
          {r === 2 &&
            (nums ? (
              <span className="skb-key gray wide skb-none" aria-hidden="true" />
            ) : (
              <button className={`skb-key gray wide${shift ? ' on' : ''}`} onPointerDown={press(() => setManualShift(!shift))} {...release} aria-label="대문자">
                <svg viewBox="0 0 19 16" width="20.333" height="17.167" aria-hidden="true">
                  <path d="M9.500 1 1.200 8.700h4.300v5.100a1.200 1.200 0 0 0 1.200 1.200h5.600a1.200 1.200 0 0 0 1.200-1.200V8.700h4.300z" fill={shift ? '#fff' : 'none'} stroke="#fff" strokeWidth="1.400" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          {row.split('').map((c) => (
            <button key={c} className="skb-key" lang="en" onPointerDown={press(() => type(c))} {...release} aria-label={c}>
              {shift && !nums ? c.toUpperCase() : c}
            </button>
          ))}
          {r === 2 && (
            <button className="skb-key gray wide" {...hold} aria-label="지우기">
              <QBackspace />
            </button>
          )}
        </div>
      ))}
      <div className="skb-row r3">
        <button className="skb-key gray num" lang="en" onPointerDown={press(() => setNums((v) => !v))} {...release}>
          {nums ? 'ABC' : '123'}
        </button>
        <button className="skb-key" lang="en" onPointerDown={press(() => type(','))} {...release} aria-label="쉼표">
          ,
        </button>
        <button className="skb-key space" onPointerDown={press(() => onChange(value && !value.endsWith(' ') ? value + ' ' : value))} {...release} aria-label="띄어쓰기">
          <span className="space-glyph" />
        </button>
        <button className="skb-key" lang="en" onPointerDown={press(() => type('.'))} {...release} aria-label="마침표">
          .
        </button>
        <button className="skb-key gray num" onPointerDown={press(onEnter)} {...release}>
          <QOk />
          <span>확인</span>
        </button>
      </div>
    </div>
  );
}
