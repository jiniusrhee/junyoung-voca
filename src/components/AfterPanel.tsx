import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

export interface AfterPanelProps {
  /** 보라 말풍선 글자(정답) */
  answer: string;
  /** 사전에 있는 단어면 밑줄 (누르면 뜻) */
  answerIsWord: boolean;
  onBubble: () => void;
  /** 말풍선 위에 띄울 뜻 팝업 등 */
  bubbleExtra?: ReactNode;
  wrongCount: number;
  /** 말해보기 중: 아이콘 줄이 듣기 UI(보라 테두리 원의 정지 버튼)로 바뀌고 말풍선에 점 3개 */
  listening: boolean;
  onStopListening: () => void;
  examplesOpen: boolean;
  wrongsOpen: boolean;
  onExamples: () => void;
  onWrongs: () => void;
  onSay: () => void;
  onInfo: () => void;
  /** 듣기평가 속도: 느리게 한 번 재생 (토글 아님, 라벨 고정 — 말해보카) */
  onSlow: () => void;
  onReplay: () => void;
  onNext: () => void;
  /** 마지막 문제: 다음 문제 대신 초록 '학습 완료' */
  finish?: boolean;
  /** 말풍선 오른쪽 '^' → 추가 동작 시트 */
  onMore: () => void;
  /** enter / leave 슬라이드 애니메이션용 */
  className?: string;
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

/** 정답 후 하단 패널: 말풍선 + '^' / 도구 아이콘 줄 / 듣기평가 속도 · 다시 듣기 · 다음 문제 (말해보카). 말풍선은 패널 위(bubble-row)에 붙어 자판 자리에서 37px 내려오며, 본문(after-body)만 아래에서 올라온다 */
export default function AfterPanel(p: AfterPanelProps) {
  return (
    <div className={`after ${p.className ?? ''}`}>
      <div className="bubble-row">
        {p.bubbleExtra}
        <button className={`bubble ${p.answerIsWord ? 'link' : ''}`} onClick={p.onBubble}>
          {p.listening ? <span className="dots"><i /></span> : p.answer}
        </button>
        <button className="more-btn" onClick={p.onMore} aria-label="더 보기">
          <Icon name="caret" size={16} />
        </button>
      </div>
      <div className="after-body">
      {p.listening ? (
        <div className="after-listen">
          <button className="listen-stop" onClick={p.onStopListening} aria-label="듣기 멈춤">
            <span className="stop-square" />
          </button>
        </div>
      ) : (
        <div className="after-tools">
          <Tool icon="quote" label="다른 예문" onClick={p.onExamples} active={p.examplesOpen} />
          <Tool icon="notew" label="오답 노트" onClick={p.onWrongs} badge={p.wrongCount} active={p.wrongsOpen} />
          <Tool icon="micFill" label="말해보기" onClick={p.onSay} />
          <Tool icon="book" label="단어 정보" onClick={p.onInfo} />
        </div>
      )}
      <div className="after-big">
        <button className="big-btn" onClick={p.onSlow}>
          <Icon name="turtle" size={34} />
          <span>듣기평가 속도</span>
        </button>
        <button className="big-btn" onClick={p.onReplay}>
          <Icon name="speaker" size={34} />
          <span>다시 듣기</span>
        </button>
        <button className={`big-btn next ${p.finish ? 'finish' : ''}`} onClick={p.onNext}>
          <Icon name={p.finish ? 'check' : 'play'} size={34} />
          <span>{p.finish ? '학습 완료' : '다음 문제'}</span>
        </button>
      </div>
      </div>
    </div>
  );
}
