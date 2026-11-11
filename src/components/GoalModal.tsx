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

/**
 * 하루 목표 선택 팝업 (말해보카: 작은 목표도, 큰 목표도 좋아요).
 * 치수는 플립 캡처 실측 (2026-11-11): 상자 335.33 x 401.67, 칸 93.33 x 93, 버튼 높이 49. 스타일은 styles/goalpop.css.
 */
export default function GoalModal({ current, onClose, onSave, presets = VOCAB_PRESETS }: Props) {
  const PRESETS = presets.map((n, i) => ({ label: LABELS[i], n }));
  const [value, setValue] = useState(current);
  const isPreset = PRESETS.some((p) => p.n === value);
  // 자유 설정의 처음 값: 셋째와 넷째 사이 (어휘 50·100 → 75)
  const [custom, setCustom] = useState(isPreset ? Math.round((presets[2] + presets[3]) / 2) : current);
  const step = (dir: 1 | -1) => {
    const by = dir > 0 ? (custom >= 20 ? 5 : 1) : custom > 20 ? 5 : 1;
    const n = Math.min(500, Math.max(1, custom + dir * by));
    setCustom(n);
    setValue(n);
  };

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="goal-pop" onClick={(e) => e.stopPropagation()}>
        <div className="gp-mascot">
          <Mascot size={88} mood="cheer" />
        </div>
        <div className="gp-box">
          <p className="gp-title">
            작은 목표도, 큰 목표도 좋아요.
            <br />
            꾸준히 할 수 있는 목표를 설정해 보세요.
          </p>
          <div className="gp-grid">
            {PRESETS.map((p) => (
              <button key={p.n} className={`gp-opt ${value === p.n ? 'sel' : ''}`} onClick={() => setValue(p.n)}>
                <span className="gp-label">{p.label}</span>
                <span className={`gp-n ${p.n >= 100 ? 'wide' : ''}`}>
                  <b lang="en">{p.n}</b>
                  <small>개</small>
                </span>
              </button>
            ))}
            <div className={`gp-opt free ${!isPreset ? 'sel' : ''}`} onClick={() => setValue(custom)}>
              <span className="gp-label">자유 설정</span>
              <button
                className="gp-step minus"
                aria-label="줄이기"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
              />
              <span className="gp-n">
                <b lang="en">{custom}</b>
              </span>
              <button
                className="gp-step plus"
                aria-label="늘리기"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
              />
            </div>
          </div>
          <div className="gp-actions">
            <button className="gp-cancel" onClick={onClose}>
              취소
            </button>
            <button className="gp-ok" onClick={() => onSave(value)}>
              결정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
