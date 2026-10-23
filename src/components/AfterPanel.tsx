import Icon, { type IconName } from './Icon';

interface Props {
  answer: string;
  wrongCount: number;
  slow: boolean;
  listening: boolean;
  onExamples: () => void;
  onWrongs: () => void;
  onSay: () => void;
  onInfo: () => void;
  onToggleSpeed: () => void;
  onReplay: () => void;
  onNext: () => void;
}

function Tool({ icon, label, onClick, badge, active }: { icon: IconName; label: string; onClick: () => void; badge?: number; active?: boolean }) {
  return (
    <button className={`after-tool ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="after-tool-icon">
        <Icon name={icon} size={24} />
        {badge ? <span className="tool-badge">{badge}</span> : null}
      </span>
      <span>{label}</span>
    </button>
  );
}

/** 정답 후 하단: 도구 아이콘 줄 + 실전 속도 / 다시 듣기 / 다음 문제 */
export default function AfterPanel(p: Props) {
  return (
    <div className="after">
      <div className="bubble-row">
        <button className="bubble link" onClick={p.onInfo}>
          {p.answer}
        </button>
      </div>
      <div className="after-tools">
        <Tool icon="chat" label="다른 예문" onClick={p.onExamples} />
        <Tool icon="note" label="오답 노트" onClick={p.onWrongs} badge={p.wrongCount} />
        <Tool icon="mic" label={p.listening ? '듣는 중…' : '말해보기'} onClick={p.onSay} active={p.listening} />
        <Tool icon="book" label="단어 정보" onClick={p.onInfo} />
      </div>
      <div className="after-big">
        <button className="big-btn" onClick={p.onToggleSpeed}>
          <Icon name={p.slow ? 'turtle' : 'rabbit'} size={34} />
          <span>{p.slow ? '듣기평가 속도' : '실전 속도'}</span>
        </button>
        <button className="big-btn" onClick={p.onReplay}>
          <Icon name="speaker" size={34} />
          <span>다시 듣기</span>
        </button>
        <button className="big-btn next" onClick={p.onNext}>
          <Icon name="play" size={34} />
          <span>다음 문제</span>
        </button>
      </div>
    </div>
  );
}
