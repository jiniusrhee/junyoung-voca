import { useState } from 'react';
import Mascot from './Mascot';

const LABELS = ['여유롭게', '적당하게', '열심히', '열정적으로'];
/** 어휘는 20/30/50/100, 그 밖의 모드는 5/10/20/50 (말해보카) */
export const VOCAB_PRESETS = [20, 30, 50, 100];
export const MODE_PRESETS = [5, 10, 20, 50];

interface Props {
  current: number;
  onClose: () => void;
  onSave: (n: number) => void;
  presets?: number[];
}

/** 하루 목표 선택 팝업 (말해보카: 작은 목표도, 큰 목표도 좋아요) */
export default function GoalModal({ current, onClose, onSave, presets = VOCAB_PRESETS }: Props) {
  const PRESETS = presets.map((n, i) => ({ label: LABELS[i], n }));
  const [value, setValue] = useState(current);
  const isPreset = PRESETS.some((p) => p.n === value);
  const [custom, setCustom] = useState(isPreset ? Math.round(presets[1] * 1.5) : current);

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="modal goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-mascot">
          <Mascot size={88} mood="cheer" />
        </div>
        <p className="modal-title">
          작은 목표도, 큰 목표도 좋아요.
          <br />
          꾸준히 할 수 있는 목표를 설정해 보세요.
        </p>
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
                  const n = Math.max(1, custom - (custom > 20 ? 5 : 1));
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
                  const n = Math.min(500, custom + (custom >= 20 ? 5 : 1));
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
            결정
          </button>
        </div>
      </div>
    </div>
  );
}
