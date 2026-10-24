import { useState, type ReactNode } from 'react';
import { STREAK_MIN_QUESTIONS, studyDateOf } from '../lib/time';
import { dayTotal } from '../lib/stats';
import { db } from '../db';
import Icon, { type IconName } from './Icon';

/** 학습 화면 배경 (하늘 / 공룡 테마) */
export function Backdrop({ theme }: { theme: 'sky' | 'dino' }) {
  if (theme === 'sky') return <div className="quiz-bg-deco" />;
  return (
    <svg className="dino-bg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3dc" />
          <stop offset="1" stopColor="#d9efe6" />
        </linearGradient>
        <linearGradient id="dsea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fa9a4" />
          <stop offset="1" stopColor="#2f7d86" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#dsky)" />
      <path d="M0 470 L60 400 L120 455 L190 380 L260 450 L330 395 L390 440 V560 H0Z" fill="#a9d6c4" opacity="0.8" />
      <path d="M0 520 Q100 470 200 515 T390 505 V600 H0Z" fill="#8fc6a6" />
      {/* 스테고사우루스 */}
      <g fill="#3f7f7c" transform="translate(42 520)">
        <ellipse cx="40" cy="20" rx="38" ry="16" />
        <path d="M10 8 l6 -14 l6 12 l6 -16 l6 14 l6 -16 l6 14 l6 -12 l6 12z" fill="#2f6b68" />
        <rect x="16" y="28" width="7" height="12" rx="3" />
        <rect x="56" y="28" width="7" height="12" rx="3" />
        <path d="M76 18 q22 -2 30 10 q-10 2 -30 0z" />
        <path d="M2 18 q-14 4 -22 14 q14 -2 24 -8z" />
      </g>
      {/* 목긴 공룡 */}
      <g fill="#4f8d58" transform="translate(268 430)">
        <ellipse cx="60" cy="88" rx="46" ry="22" />
        <path d="M30 80 Q20 20 2 6 q-6 -4 -2 -8 q14 -2 22 10 Q42 40 50 76z" />
        <rect x="34" y="100" width="10" height="22" rx="4" />
        <rect x="74" y="100" width="10" height="22" rx="4" />
        <path d="M104 86 q30 4 40 18 q-20 0 -42 -8z" />
      </g>
      <path d="M0 580 Q100 560 200 575 T390 570 V600 H0Z" fill="#6a9a68" />
      <rect y="596" width="390" height="248" fill="url(#dsea)" />
      <path d="M0 600 Q40 590 80 600 T160 600 T240 600 T320 600 T400 600" stroke="#bfe0dc" strokeWidth="3" fill="none" opacity="0.6" />
      {/* 바다 생물 실루엣 */}
      <g fill="#1f5e66" opacity="0.75">
        <path d="M250 700 q40 -60 100 -50 q-30 10 -40 30 q30 10 50 40 q-50 -10 -80 0z" />
        <circle cx="70" cy="690" r="14" />
        <path d="M56 690 q-12 10 -6 20 q8 -10 14 -10z" />
      </g>
      <g fill="#174f57" opacity="0.6">
        <path d="M0 844 V780 q20 -40 30 0 q10 -50 25 0 q12 -30 22 0 V844z" />
        <path d="M330 844 V790 q14 -30 22 0 q10 -40 20 0 q8 -20 18 0 V844z" />
      </g>
    </svg>
  );
}

/** 학습 화면 상단: 뒤로 + 오늘 진행 막대 + 설정 */

/** 학습 중 나가기: 오늘 5문제 미만이면 말해보카처럼 한 번 붙잡는다 */
export function useLeaveGuard(onLeave: () => void): { leave: () => void; modal: ReactNode } {
  const [ask, setAsk] = useState(false);
  const leave = () => {
    void db.daily.get(studyDateOf()).then((row) => {
      if (dayTotal(row) < STREAK_MIN_QUESTIONS) setAsk(true);
      else onLeave();
    });
  };
  const modal = ask ? (
    <div className="modal-dim" onClick={() => setAsk(false)}>
      <div className="opt-sheet leave-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>이대로 가시게요?</h3>
        <p className="help-text">
          {STREAK_MIN_QUESTIONS}문제를 풀어야
          <br />
          연속 학습을 달성할 수 있어요!
        </p>
        <div className="opt-actions">
          <button className="btn gray big" onClick={onLeave}>
            나가기
          </button>
          <button className="btn primary big" onClick={() => setAsk(false)}>
            이어서 하기
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { leave, modal };
}

/** 학습 화면 상단: 진행 배지 아이콘은 모드별 (어휘 트로피, 리스닝 헤드폰 등 — 말해보카) */
export function StudyTop({ count, total, onBack, onSettings, icon = 'drop' }: { count: number; total: number; onBack: () => void; onSettings?: () => void; icon?: IconName }) {
  const fill = Math.min(1, total ? count / total : 0);
  const guard = useLeaveGuard(onBack);
  return (
    <header className="quiz-top">
      {guard.modal}
      <button className="icon-btn light" onClick={guard.leave} aria-label="나가기">
        <Icon name="back" size={24} />
      </button>
      <div className="quiz-progress">
        <span className={`trophy-badge ${count >= total ? 'gold' : ''}`}>
          <Icon name={icon} size={18} />
        </span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${fill * 100}%` }}>
            <span>
              {count}/{total}
            </span>
          </div>
        </div>
      </div>
      {onSettings ? (
        <button className="icon-btn light" onClick={onSettings} aria-label="설정">
          <Icon name="gear" size={24} />
        </button>
      ) : (
        <span className="icon-btn" />
      )}
    </header>
  );
}

export interface ToolItem {
  icon: IconName;
  label: string;
  onClick: () => void;
  badge?: number;
  active?: boolean;
  disabled?: boolean;
}

export interface BigItem {
  icon: IconName;
  label: string;
  onClick: () => void;
  primary?: boolean;
}

/** 정답 후 하단: 도구 줄 + 큰 버튼 3개 */
export function ToolPanel({ tools, big, bubble, extra }: { tools: ToolItem[]; big: BigItem[]; bubble?: ReactNode; extra?: ReactNode }) {
  return (
    <div className="after">
      {bubble && <div className="bubble-row">{bubble}</div>}
      {extra}
      <div className="after-tools" style={{ gridTemplateColumns: `repeat(${tools.length}, 1fr)` }}>
        {tools.map((t) => (
          <button key={t.label} className={`after-tool ${t.active ? 'active' : ''}`} onClick={t.onClick} disabled={t.disabled}>
            <span className="after-tool-icon">
              <Icon name={t.icon} size={24} />
              {t.badge ? <span className="tool-badge">{t.badge}</span> : null}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="after-big">
        {big.map((b) => (
          <button key={b.label} className={`big-btn ${b.primary ? 'next' : ''}`} onClick={b.onClick}>
            <Icon name={b.icon} size={34} />
            <span>{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** 학습 시작 팝업 공통 틀 */
export function StartSheet({ title, onClose, children, action }: { title: string; onClose: () => void; children: ReactNode; action: ReactNode }) {
  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="extra-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="extra-head">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={22} />
          </button>
        </div>
        {children}
        <div className="start-action">{action}</div>
      </div>
    </div>
  );
}
