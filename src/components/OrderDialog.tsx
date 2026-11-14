import { useState } from 'react';

export type StudyOrder = 'seq' | 'random';

/** 목록을 섞는다 (랜덤 학습) */
export function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * '히스토리 학습'을 누르면 뜨는 '학습 순서 설정' 창 — 말해보카 플립 실측(2026-11-14).
 * 창 335.33 x 330.33, 고르는 칸 둘(308.67 x 86.33: 동그란 단추 + 그림 + 이름 + 설명), 취소 / 결정.
 * 그림과 설명글은 직접 그리고 쓴 것.
 */
export default function OrderDialog({ onPick, onClose }: { onPick: (order: StudyOrder) => void; onClose: () => void }) {
  const [order, setOrder] = useState<StudyOrder>('seq');
  return (
    <div className="modal-dim order-dim" onClick={onClose}>
      <div className="order-pop" role="dialog" aria-label="학습 순서 설정" onClick={(e) => e.stopPropagation()}>
        <h3>학습 순서 설정</h3>
        <button className={`op-opt${order === 'seq' ? ' on' : ''}`} onClick={() => setOrder('seq')} aria-pressed={order === 'seq'}>
          <i className="op-radio" />
          <svg className="op-ic" viewBox="0 0 46.667 50" aria-hidden="true">
            <circle cx="13" cy="13.600" r="2.700" fill="#ffb300" />
            <path d="M17.800 13.900H26.500A6.650 6.650 0 0 1 26.500 27.200H15.500A6.500 6.500 0 0 0 15.500 40.200H26" fill="none" stroke="#dcdde0" strokeWidth="3.300" strokeLinecap="round" />
            <path d="M28.500 36 33.500 40.200 28.500 44.500" fill="none" stroke="#ffb300" strokeWidth="3.300" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <b>순차 학습</b>
          <span>목록에 담긴 순서 그대로 하나씩 학습해요.</span>
        </button>
        <button className={`op-opt${order === 'random' ? ' on' : ''}`} onClick={() => setOrder('random')} aria-pressed={order === 'random'}>
          <i className="op-radio" />
          <svg className="op-ic" viewBox="0 0 46.667 50" aria-hidden="true">
            <circle cx="11.700" cy="14.800" r="2.700" fill="#ffb300" />
            <path d="M11.700 20.600V23.900L29.400 33.300V38.300" fill="none" stroke="#dcdde0" strokeWidth="3.300" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M29.400 14.400V22.800L11.700 33.300V42.200" fill="none" stroke="#dcdde0" strokeWidth="3.300" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M24.200 40 29.400 45 34.600 40" fill="none" stroke="#ffb300" strokeWidth="3.300" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <b>랜덤 학습</b>
          <span>목록에 담긴 것을 무작위로 섞어서 학습해요.</span>
        </button>
        <div className="op-btns">
          <button className="op-cancel" onClick={onClose}>
            취소
          </button>
          <button className="op-ok" onClick={() => onPick(order)}>
            결정
          </button>
        </div>
      </div>
    </div>
  );
}
