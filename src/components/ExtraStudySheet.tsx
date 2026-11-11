import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { State } from 'ts-fsrs';
import { db } from '../db';
import { HBookOpen, HStar } from './HomeIcons';
import Mascot from './Mascot';

interface Props {
  todayTotal: number;
  /** 오늘 목표 */
  goal: number;
  /** 목표를 채웠으면 추가 학습(목표 변경 가능), 아니면 오늘의 학습 */
  met: boolean;
  onClose: () => void;
  onStart: (target: number) => void;
}

/* 고리 (플립 실측 2026-11-11): 지름 210.33, 선 7.33, 6시 방향에서 시계 방향으로 320도 (오른쪽 아래 40도는 비어 있고 그 자리에 '21/30' 이 놓인다) */
const R = 101.5;
const C = 105.167;
const SWEEP = 320;
export const RING_LEN = (2 * Math.PI * R * SWEEP) / 360;
const END = { x: C + R * Math.cos((50 * Math.PI) / 180), y: C + R * Math.sin((50 * Math.PI) / 180) };
const ARC = `M ${C} ${C + R} A ${R} ${R} 0 1 1 ${END.x.toFixed(3)} ${END.y.toFixed(3)}`;

/** 돌아가는 화살표 두 개 ('변경' 알약): 13 x 11 */
function Swap() {
  return (
    <svg width="13" height="11" viewBox="0 0 13 11" aria-hidden="true">
      <path d="M2.000 4.600a4.600 4.600 0 0 1 8.300-1.900M11.000 6.400a4.600 4.600 0 0 1-8.300 1.900" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
      <path d="M11.300 0.300v3.000H8.300zM1.700 10.700V7.700h3.000z" fill="currentColor" stroke="currentColor" strokeWidth="0.600" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * 홈의 큰 보라 버튼을 누르면 뜨는 어휘 학습 시작 창.
 * 치수는 모두 말해보카 플립 캡처에서 잰 값 (330 x 473, 화면 가운데). 스타일은 styles/startpop.css.
 */
export default function ExtraStudySheet({ todayTotal, goal, met, onClose, onStart }: Props) {
  /** 목표를 채운 뒤의 추가분: 한 번에 10개씩 (말해보카: 하루 목표 20 → 21개 학습 뒤 21/30) */
  const extra = 10;
  const nav = useNavigate();
  const counts = useLiveQuery(async () => {
    const now = new Date();
    const due = await db.cards.where('due').belowOrEqual(now).toArray();
    const [words, cards] = await Promise.all([db.words.count(), db.cards.count()]);
    return {
      fresh: Math.max(0, words - cards),
      review: due.filter((c) => c.state === State.Review).length,
      retry: due.filter((c) => c.state !== State.Review && c.lapses === 0).length,
      wrong: due.filter((c) => c.state !== State.Review && c.lapses > 0).length,
    };
  }, []);
  // 목표를 채운 뒤에는 목표에 추가분을 얹은 수가 다음 목표 (말해보카: 하루 목표 20, 21개 학습 → 21/30). 이미 넘었으면 한 번 더 얹는다
  let target = goal;
  if (met) {
    target = goal + extra;
    while (target <= todayTotal) target += extra;
  }
  const fill = Math.min(1, todayTotal / target);
  // 새로운 + 복습할 + 재도전 + 오늘 틀린 = 남은 목표 (새로운 단어는 그 나머지, 실제 새 단어 수를 넘지 않음)
  const left = Math.max(0, target - todayTotal);
  const wrong = Math.min(counts?.wrong ?? 0, left);
  const retry = Math.min(counts?.retry ?? 0, left - wrong);
  const review = Math.min(counts?.review ?? 0, left - wrong - retry);
  const fresh = Math.min(counts?.fresh ?? 0, left - wrong - retry - review);
  const rows: [string, number][] = [
    ['새로운 단어', fresh],
    ['복습할 단어', review],
    ['재도전 단어', retry],
    ['오늘 틀린 단어', wrong],
  ];

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="start-pop" onClick={(e) => e.stopPropagation()}>
        <div className="sp-head">
          <span>어휘 학습</span>
          <button className="sp-close" onClick={onClose} aria-label="닫기">
            <svg width="11.667" height="11.667" viewBox="0 0 11.667 11.667" aria-hidden="true">
              <path d="M0.800 0.800l10.067 10.067M10.867 0.800L0.800 10.867" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <span className="sp-chip">학습 코스</span>
        <p className="sp-course">통합 코스</p>
        <button className="sp-pill sp-pill-course" title="이 앱에는 통합 코스만 있어요">
          <Swap />
          변경
        </button>
        <i className="sp-dash" />
        <svg className="sp-ring" width="210.333" height="210.333" viewBox="0 0 210.333 210.333" aria-hidden="true">
          <path d={ARC} className="sp-ring-track" />
          {fill > 0 && <path d={ARC} className="sp-ring-fill" style={{ strokeDasharray: `${fill * RING_LEN} ${RING_LEN}` }} />}
        </svg>
        <ul className="sp-rows">
          {rows.map(([label, n]) => (
            <li key={label}>
              <span>{label}</span>
              <b lang="en">{n}</b>
              <i>개</i>
            </li>
          ))}
        </ul>
        {/* 말해보카에서는 '복습 단어 비율' 화면이 열린다 → 우리 앱에서는 그 설정이 있는 어휘 학습 설정으로 */}
        <button className="sp-pill sp-pill-goal" onClick={() => nav('/settings/vocab')} aria-label="학습 구성 변경">
          <Swap />
          변경
        </button>
        <div className="sp-mascot">
          <Mascot size={62} mood="cheer" />
        </div>
        <p className="sp-count" lang="en">
          <b>{todayTotal}</b>
          <span>/{target}</span>
        </p>
        <button className="sp-start" onClick={() => onStart(target)}>
          {met ? <HStar /> : <HBookOpen />}
          {met ? '추가 학습' : '오늘의 학습'}
        </button>
      </div>
    </div>
  );
}
