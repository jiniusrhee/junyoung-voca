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
  /** 다섯 번째 도구: 내 단어장에 담기/빼기 (말해보카는 이 자리가 편집 가능한 다섯 번째 버튼) */
  onWordbook: () => void;
  inWordbook: boolean;
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

/* 큰 버튼 아이콘 — 46×46 상자 안에 플립 실측(2026-11-11) 위치·크기로 직접 그린 그림
   거북: x 0~46.3, y 8.7~37.4 (왼쪽을 보는 머리, 둥근 등, 발 둘, 오른쪽 꼬리) · 스피커: x 4~41.7, y 6.7~38.3 (몸통 + 호 두 줄) · ▶: 25 × 30 */
export function BigTurtle() {
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path
        d="M0 24C0 20.300 3 17.500 6.600 17.500c2 0 3.500.900 4.400 2.400C13.200 13.200 19.800 8.700 27.500 8.700c8.300 0 14 6.800 14 16.300v1c1.800.200 3.600.900 4.800 2-1 1.200-2.800 1.600-4.600 1.400h-2.500v5.800a2.200 2.200 0 0 1-2.200 2.200h-3.700a2.200 2.200 0 0 1-2.200-2.200v-4.600h-10v4.600a2.200 2.200 0 0 1-2.200 2.200h-4a2.200 2.200 0 0 1-2.200-2.200v-5c-1.500-.300-3.200-.900-4.400-1.400-1 .300-2 .400-3.100.400C2.300 29.200 0 27 0 24z"
        fill="currentColor"
      />
    </svg>
  );
}
export function BigSpeaker() {
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path d="M6.200 13.600h6.300l9.100-6.700c1.400-1 3.500 0 3.500 1.800v26.600c0 1.800-2.100 2.800-3.500 1.800l-9.100-6.600H6.200A2.200 2.200 0 0 1 4 28.300V15.800a2.200 2.200 0 0 1 2.200-2.200z" fill="currentColor" />
      <path d="M29 14.600a10.900 10.900 0 0 1 0 15.700M34.600 9.200a18.500 18.500 0 0 1 0 26.500" fill="none" stroke="currentColor" strokeWidth="2.700" strokeLinecap="round" />
    </svg>
  );
}
export function BigPlay() {
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path d="M12 11.200c0-2.700 2.900-4.400 5.300-3l18.300 11.800c2.200 1.400 2.200 4.600 0 6L17.300 37.800c-2.400 1.400-5.300-.3-5.300-3z" fill="currentColor" />
    </svg>
  );
}

/** 정답 후 하단 패널: 말풍선 + '^' / 도구 아이콘 줄 / 듣기평가 속도 · 다시 듣기 · 다음 문제 (말해보카). 말풍선은 패널 위(bubble-row)에 붙어 자판 자리에서 37px 내려오며, 본문(after-body)만 아래에서 올라온다 */
export default function AfterPanel(p: AfterPanelProps) {
  return (
    <div className={`after ${p.className ?? ''}`}>
      <div className="bubble-row">
        {p.bubbleExtra}
        <button className={`bubble ${p.answerIsWord && !p.listening ? 'link' : ''}`} onClick={p.onBubble}>
          {p.listening ? <span className="dots"><i /></span> : p.answer}
        </button>
        <button className="more-btn" onClick={p.onMore} aria-label="더 보기">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <polyline points="3.5,11.5 9,6 14.5,11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          <Tool icon="bookmark" label="내 단어장" onClick={p.onWordbook} active={p.inWordbook} />
        </div>
      )}
      <div className="after-big">
        <button className="big-btn" onClick={p.onSlow}>
          <BigTurtle />
          <span>듣기평가 속도</span>
        </button>
        <button className="big-btn" onClick={p.onReplay}>
          <BigSpeaker />
          <span>다시 듣기</span>
        </button>
        <button className={`big-btn next ${p.finish ? 'finish' : ''}`} onClick={p.onNext}>
          {p.finish ? <Icon name="check" size={34} /> : <BigPlay />}
          <span>{p.finish ? '학습 완료' : '다음 문제'}</span>
        </button>
      </div>
      </div>
    </div>
  );
}
