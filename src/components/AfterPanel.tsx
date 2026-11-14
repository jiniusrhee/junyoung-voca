import type { CSSProperties, ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

export interface MoreAction {
  key: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  active?: boolean;
}

export interface AfterPanelProps {
  /** 보라 말풍선 글자(정답) */
  answer: string;
  /** 사전에 있는 단어면 밑줄 (누르면 뜻) */
  answerIsWord: boolean;
  /** 정답 보기를 쓰고 푼 카드: 말풍선 꼬리가 거의 없다 (말해보카) */
  flatBubble?: boolean;
  /** 문장을 읽는 중: '다시 듣기' 스피커의 호가 차례로 켜졌다 꺼진다 */
  speaking?: boolean;
  onBubble: () => void;
  /** 말풍선 위에 띄울 뜻 팝업 등 */
  bubbleExtra?: ReactNode;
  wrongCount: number;
  /** 말해보기 중: 아이콘 줄이 듣기 UI(보라 테두리 원의 정지 버튼)로 바뀌고 말풍선에 점 3개 */
  listening: boolean;
  /** 말해보기에서 아무 말도 못 들은 뒤: 정답 말풍선을 감춘다 ('^' 버튼은 남는다) */
  hideBubble?: boolean;
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
  /** 말풍선 오른쪽 '^' → '편집' 시트 여닫기 */
  onMore: () => void;
  /**
   * '편집' 시트 (말해보카 실측 2026-11-11): 패널은 그대로 있고 그 위로 시트가 패널 뒤에서 0.27초 동안 올라온다.
   * '^' 버튼은 시트 위 끝을 따라 올라가 '×' 가 되고, 위쪽 화면은 어두워진다. 닫힐 때는 전환 없이 바로 사라진다.
   */
  moreOpen?: boolean;
  moreRows?: MoreAction[][];
  /** enter / leave 슬라이드 애니메이션용 */
  className?: string;
  /** 다른 학습 모드(문법 등): 도구 줄을 통째로 바꾼다 (최대 5칸) */
  tools?: PanelTool[];
  /** 다른 학습 모드: 첫 번째 큰 단추('듣기평가 속도' 자리)를 바꾼다 */
  bigFirst?: { icon: ReactNode; label: string; onClick: () => void };
  /** 정답 말풍선이 없는 모드(문법): '^' 단추만 남는다 */
  noBubble?: boolean;
  /** 패널 위(카드 아랫부분)에 겹쳐 띄울 것 — 문법의 오답 노트 */
  above?: ReactNode;
}

export interface PanelTool {
  key: string;
  icon: IconName;
  label: string;
  onClick: () => void;
  badge?: number;
  active?: boolean;
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
      <path className="arc1" d="M29 14.600a10.900 10.900 0 0 1 0 15.700" fill="none" stroke="currentColor" strokeWidth="2.700" strokeLinecap="round" />
      <path className="arc2" d="M34.600 9.200a18.500 18.500 0 0 1 0 26.500" fill="none" stroke="currentColor" strokeWidth="2.700" strokeLinecap="round" />
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

/** 펼친 책 ('문법 사전'): 플립 실측 2026-11-14 — 46 상자 안에서 x 4~42, y 6.33~37.67. 두 쪽이 가운데 3.33 틈을 두고, 책등 쪽이 아래로 처진 모양 */
export function BigBook() {
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path d="M4 9.200Q4 6.400 6.800 6.400Q16 6.600 21.330 12.300V37.600Q15 33.600 5.600 33.300Q4 33.300 4 31.600z" fill="currentColor" />
      <path d="M42 9.200Q42 6.400 39.200 6.400Q30 6.600 24.670 12.300V37.600Q31 33.600 40.400 33.300Q42 33.300 42 31.600z" fill="currentColor" />
    </svg>
  );
}

/** '학습 완료' 표시: 붓으로 그은 듯 끝이 뾰족한 흰 체크 (플립 실측 2026-11-13: 단추 왼쪽 위에서 x 31.33~73.67, y 27.33~60) */
export function BigDone() {
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <path d="M32.900 7.600 43.400 15 36.670 20.800 30.670 27.800 24.670 35.800 21.700 40.300 14.370 32.800 8.370 27.800 3.670 24.800 0.900 23.400 3.670 21.700 8.670 18.700 13.970 15.500 16.970 20.800 20.670 27.500 24.370 20.800 27.670 14.800z" fill="currentColor" />
    </svg>
  );
}

/** 정답 후 하단 패널: 말풍선 + '^' / 도구 아이콘 줄 / 듣기평가 속도 · 다시 듣기 · 다음 문제 (말해보카). 말풍선은 패널 위(bubble-row)에 붙어 자판 자리에서 37px 내려오며, 본문(after-body)만 아래에서 올라온다 */
export default function AfterPanel(p: AfterPanelProps) {
  return (
    <div className={`after ${p.className ?? ''}${p.moreOpen ? ' more-open' : ''}${p.listening ? ' hearing' : ''}`} style={{ '--more-rows': p.moreRows?.length ?? 0 } as CSSProperties}>
      {p.moreOpen && <div className="more-dim" onClick={p.onMore} />}
      {p.moreOpen && p.moreRows && (
        <div className="more-sheet">
          <div className="more-head">편집</div>
          {p.moreRows.map((row, r) => (
            <div className="more-row" key={r}>
              {[0, 1, 2, 3, 4].map((k) => {
                const a = row[k];
                return a ? (
                  <button key={a.key} className={`after-tool ${a.active ? 'active' : ''}`} onClick={a.onClick}>
                    <span className="after-tool-icon">
                      <Icon name={a.icon} size={24} />
                    </span>
                    <span>{a.label}</span>
                  </button>
                ) : (
                  <span key={k} className="after-tool empty" aria-hidden="true" />
                );
              })}
            </div>
          ))}
        </div>
      )}
      {p.above}
      <div className="bubble-row">
        {p.bubbleExtra}
        {!p.noBubble && (p.listening || !p.hideBubble) && (
          <button className={`bubble ${p.answerIsWord && !p.listening ? 'link' : ''}${p.flatBubble ? ' flat' : ''}${p.listening ? ' hearing' : ''}`} lang="en" onClick={p.onBubble}>
            {p.listening ? (
              <span className="dots">
                <i />
              </span>
            ) : (
              p.answer
            )}
          </button>
        )}
        <button className="more-btn" onClick={p.onMore} aria-label={p.moreOpen ? '닫기' : '더 보기'}>
          <svg viewBox="0 0 18 18" aria-hidden="true">
            {p.moreOpen ? (
              <path d="M4.500 4.500l9 9M13.500 4.500l-9 9" fill="none" stroke="currentColor" strokeWidth="1.600" strokeLinecap="round" />
            ) : (
              <polyline points="3.5,11.5 9,6 14.5,11.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
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
          {p.tools ? (
            p.tools.map((t) => <Tool key={t.key} icon={t.icon} label={t.label} onClick={t.onClick} badge={t.badge} active={t.active} />)
          ) : (
            <>
          <Tool icon="quote" label="다른 예문" onClick={p.onExamples} active={p.examplesOpen} />
          <Tool icon="notew" label="오답 노트" onClick={p.onWrongs} badge={p.wrongCount} active={p.wrongsOpen} />
          <Tool icon="micFill" label="말해보기" onClick={p.onSay} />
          <Tool icon="book" label="단어 정보" onClick={p.onInfo} />
          <Tool icon="bookmark" label="내 단어장" onClick={p.onWordbook} active={p.inWordbook} />
            </>
          )}
        </div>
      )}
      <div className="after-big">
        {p.bigFirst ? (
          <button className="big-btn" onClick={p.bigFirst.onClick}>
            {p.bigFirst.icon}
            <span>{p.bigFirst.label}</span>
          </button>
        ) : (
          <button className="big-btn" onClick={p.onSlow}>
            <BigTurtle />
            <span>듣기평가 속도</span>
          </button>
        )}
        <button className={`big-btn${p.speaking ? ' speaking' : ''}`} onClick={p.onReplay}>
          <BigSpeaker />
          <span>다시 듣기</span>
        </button>
        <button className={`big-btn next ${p.finish ? 'fin' : ''}`} onClick={p.onNext}>
          {p.finish ? <BigDone /> : <BigPlay />}
          <span>{p.finish ? '학습 완료' : '다음 문제'}</span>
        </button>
      </div>
      </div>
    </div>
  );
}
