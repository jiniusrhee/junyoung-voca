import { type CSSProperties, useEffect, useState } from 'react';
import DinoScene from './DinoScene';
import { QBack, QGear, QHead, QStreak } from './QuizIcons';
import SeaScene from './SeaScene';
import { Backdrop, useLeaveGuard } from './StudyChrome';

/**
 * 어휘 퀴즈와 같은 틀을 쓰는 다른 학습 화면(문법 등)의 공통 조각.
 * 말해보카는 문법 학습도 어휘 퀴즈와 같은 머리줄·풍경·카드·정답 패널을 쓴다(플립 실측 2026-11-14).
 * 화면 뿌리에 `quiz-screen vocab-quiz` 클래스를 같이 주면 styles/quiz.css 의 규칙이 그대로 먹는다.
 */

/** 풍경(땅) + 물속. 하늘 테마에서는 옛 배경 */
export function QuizScene({ theme }: { theme: 'sky' | 'dino' }) {
  const [variant] = useState(() => Math.floor(Math.random() * 3));
  if (theme === 'sky') return <Backdrop theme="sky" />;
  return (
    <>
      {/* 물속: 풍경의 물가 아래와 자판·패널 뒤에 깔려 있다 (풍경 그림은 물가 아래가 뚫려 있으므로 물속을 먼저 그린다) */}
      <div className="sea-layer" aria-hidden="true">
        <SeaScene />
      </div>
      <div className="scene-layer dino-bg" aria-hidden="true">
        <DinoScene variant={variant} />
      </div>
    </>
  );
}

/** 머리줄: 뒤로 · 진행 막대(동그라미 + 채움 + 작은 공룡 + 숫자) · 톱니 */
export function QuizTop({ count, total, onLeave, onSettings }: { count: number; total: number; onLeave: () => void; onSettings: () => void }) {
  const guard = useLeaveGuard(onLeave);
  // 들어올 때 진행 막대가 0 에서 차오른다
  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBarReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const fill = Math.min(1, total ? count / total : 0);
  return (
    <header className="quiz-top">
      {guard.modal}
      <button className="qt-btn qt-back" onClick={guard.leave} aria-label="나가기">
        <QBack />
      </button>
      <div className={`quiz-progress${count === 0 ? ' zero' : ''}`} style={{ '--f': barReady ? fill : 0 } as CSSProperties}>
        <div className="progress-track">
          <div className="progress-fill" />
          <span className="progress-head" aria-hidden="true">
            <QHead />
          </span>
        </div>
        <span className={`trophy-badge ${count >= total ? 'gold' : ''}`}>
          <QStreak />
        </span>
        <span className="progress-label">
          {count}/{total}
        </span>
      </div>
      <button className="qt-btn qt-gear" onClick={onSettings} aria-label="설정">
        <QGear />
      </button>
    </header>
  );
}
