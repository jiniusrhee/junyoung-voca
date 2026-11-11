import { BigPlay, BigSpeaker, BigTurtle } from './AfterPanel';
import Icon, { type IconName } from './Icon';

export interface SheetAction {
  key: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

interface Props {
  actions: SheetAction[];
  onClose: () => void;
  onSlow: () => void;
  onReplay: () => void;
  onNext: () => void;
  /** 마지막 문제: 다음 문제 대신 초록 '학습 완료' */
  finish?: boolean;
}

/**
 * 정답 후 말풍선 오른쪽 '^' 를 누르면 아래에서 올라오는 추가 동작 시트 (말해보카 '편집' 시트의 격자 + 큰 버튼 3개).
 * ※ 임시 스텁 — 모양은 panel 작업에서 맞춘다.
 */
export default function ExtraSheet({ actions, onClose, onSlow, onReplay, onNext, finish }: Props) {
  return (
    <div className="extra-sheet-dim" onClick={onClose}>
      <div className="xsheet" onClick={(e) => e.stopPropagation()}>
        <div className="xsheet-head">
          <span>편집</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="xsheet-grid">
          {actions.map((a) => (
            <button key={a.key} className={`xsheet-item ${a.active ? 'active' : ''}`} onClick={a.onClick} disabled={a.disabled}>
              <span className="xsheet-icon">
                <Icon name={a.icon} size={22} />
              </span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
        <div className="after-big">
          <button className="big-btn" onClick={onSlow}>
            <BigTurtle />
            <span>듣기평가 속도</span>
          </button>
          <button className="big-btn" onClick={onReplay}>
            <BigSpeaker />
            <span>다시 듣기</span>
          </button>
          <button className={`big-btn next ${finish ? 'finish' : ''}`} onClick={onNext}>
            {finish ? <Icon name="check" size={34} /> : <BigPlay />}
            <span>{finish ? '학습 완료' : '다음 문제'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
