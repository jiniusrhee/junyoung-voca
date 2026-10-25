import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { State } from 'ts-fsrs';
import { db } from '../db';
import Icon from './Icon';
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

/** 목표를 채운 뒤 '추가 어휘'를 누르면 뜨는 추가 학습 창 */
export default function ExtraStudySheet({ todayTotal, goal, met, onClose, onStart }: Props) {
  /** 추가 목표: 말해보카처럼 '변경'을 누를 때마다 20 → 50 → 100 → 10 개 순환 */
  const STEPS = [20, 50, 100, 10];
  const [extra, setExtra] = useState(STEPS[0]);
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
  const target = met ? todayTotal + extra : goal;
  const fill = Math.min(1, todayTotal / target);

  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="extra-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="extra-head">
          <span>어휘 학습</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="extra-course">
          <div>
            <span className="box-tag">학습 코스</span>
            <p className="extra-course-name">통합 코스</p>
          </div>
          <button className="change-btn" title="이 앱에는 통합 코스만 있어요">
            <Icon name="retry" size={16} /> 변경
          </button>
        </div>
        <div className="extra-body ring-body">
          <svg className="start-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="ring-track" />
            <circle cx="60" cy="60" r="52" className="ring-fill" style={{ strokeDasharray: `${fill * 326.7} 326.7` }} />
          </svg>
          <div className="extra-counts in-ring">
            <p>
              새로운 단어 <b>{counts?.fresh ?? 0}</b> 개
            </p>
            <p>
              복습할 단어 <b>{counts?.review ?? 0}</b> 개
            </p>
            <p>
              재도전 단어 <b>{counts?.retry ?? 0}</b> 개
            </p>
            <p>
              틀린 단어 <b>{counts?.wrong ?? 0}</b> 개
            </p>
            {met && (
              <button className="change-btn dark" onClick={() => setExtra((n) => STEPS[(STEPS.indexOf(n) + 1) % STEPS.length] ?? STEPS[0])} aria-label="추가 목표 변경">
                <Icon name="retry" size={16} /> 변경
              </button>
            )}
          </div>
          <div className="extra-mascot ring-mascot">
            <Mascot size={110} mood="cheer" />
          </div>
          <p className="extra-progress ring-progress">
            <b>{todayTotal}</b>/{target}
          </p>
        </div>
        <div className="extra-foot">
          <button className="extra-start" onClick={() => onStart(target)}>
            <Icon name={met ? 'star' : 'book'} size={22} /> {met ? '추가 학습' : '오늘의 학습'}
          </button>
        </div>
      </div>
    </div>
  );
}
