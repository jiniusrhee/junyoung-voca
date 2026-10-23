import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { State } from 'ts-fsrs';
import { db } from '../db';
import Icon from './Icon';
import Mascot from './Mascot';

interface Props {
  todayTotal: number;
  onClose: () => void;
  onStart: (target: number) => void;
}

/** 목표를 채운 뒤 '추가 어휘'를 누르면 뜨는 추가 학습 창 */
export default function ExtraStudySheet({ todayTotal, onClose, onStart }: Props) {
  const [extra, setExtra] = useState(20);
  const counts = useLiveQuery(async () => {
    const now = new Date();
    const due = await db.cards.where('due').belowOrEqual(now).toArray();
    const [words, cards] = await Promise.all([db.words.count(), db.cards.count()]);
    return {
      fresh: Math.max(0, words - cards),
      review: due.filter((c) => c.state === State.Review).length,
      retry: due.filter((c) => c.state !== State.Review).length,
    };
  }, []);
  const target = todayTotal + extra;

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
        </div>
        <div className="extra-body">
          <div className="extra-counts">
            <p>
              새로운 단어 <b>{counts?.fresh ?? 0}</b> 개
            </p>
            <p>
              복습할 단어 <b>{counts?.review ?? 0}</b> 개
            </p>
            <p>
              재도전 단어 <b>{counts?.retry ?? 0}</b> 개
            </p>
          </div>
          <div className="extra-mascot">
            <Mascot size={110} mood="cheer" />
          </div>
          <p className="extra-progress">
            <b>{todayTotal}</b>/{target}
          </p>
        </div>
        <div className="extra-foot">
          <div className="extra-stepper">
            <button onClick={() => setExtra((n) => Math.min(500, n + 20))} aria-label="20개 늘리기">
              <Icon name="caret" size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <span>
              <b>{extra}</b> 개
            </span>
            <button onClick={() => setExtra((n) => Math.max(10, n - 20))} aria-label="20개 줄이기">
              <Icon name="caret" size={18} />
            </button>
          </div>
          <button className="extra-start" onClick={() => onStart(target)}>
            <Icon name="star" size={22} /> 추가 학습
          </button>
        </div>
      </div>
    </div>
  );
}
