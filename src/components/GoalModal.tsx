import { useState } from 'react';
import Mascot from './Mascot';

const PRESETS = [
  { label: '여유롭게', n: 20 },
  { label: '적당하게', n: 30 },
  { label: '열심히', n: 50 },
  { label: '열정적으로', n: 100 },
];

interface Props {
  current: number;
  onClose: () => void;
  onSave: (n: number) => void;
}

/** 하루 목표 선택 팝업 */
export default function GoalModal({ current, onClose, onSave }: Props) {
  const [value, setValue] = useState(current);
  const isPreset = PRESETS.some((p) => p.n === value);
  const [custom, setCustom] = useState(isPreset ? 75 : current);

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="modal goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-mascot">
          <Mascot size={88} mood="cheer" />
        </div>
        <p className="modal-title">자신에게 적당한 하루 목표를 선택해보세요.</p>
        <div className="goal-grid">
          {PRESETS.map((p) => (
            <button key={p.n} className={`goal-opt ${value === p.n ? 'sel' : ''}`} onClick={() => setValue(p.n)}>
              <span className="goal-label">{p.label}</span>
              <span className="goal-n">
                {p.n}
                <small>개</small>
              </span>
            </button>
          ))}
          <div className={`goal-opt custom ${!PRESETS.some((p) => p.n === value) ? 'sel' : ''}`} onClick={() => setValue(custom)}>
            <span className="goal-label">자유 설정</span>
            <div className="goal-stepper">
              <button
                aria-label="줄이기"
                onClick={(e) => {
                  e.stopPropagation();
                  const n = Math.max(5, custom - 5);
                  setCustom(n);
                  setValue(n);
                }}
              >
                −
              </button>
              <span className="goal-n">{custom}</span>
              <button
                aria-label="늘리기"
                onClick={(e) => {
                  e.stopPropagation();
                  const n = Math.min(500, custom + 5);
                  setCustom(n);
                  setValue(n);
                }}
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn gray" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" onClick={() => onSave(value)}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
