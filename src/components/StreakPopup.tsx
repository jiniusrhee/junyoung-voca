import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { computeStreak, dayTotal, studied } from '../lib/stats';
import { STREAK_MIN_QUESTIONS, WEEKDAYS_KO, dayOfWeek, studyDateOf, weekOf } from '../lib/time';
import Icon from './Icon';

/** 그날 처음 5문제를 채우면 한 번 뜨는 "N 연속 학습!" (말해보카) */
export default function StreakPopup() {
  const today = studyDateOf();
  const row = useLiveQuery(() => db.daily.get(today), [today]);
  const shown = useLiveQuery(async () => (await db.kv.get('streakShown'))?.value as string | undefined, []);
  const [streak, setStreak] = useState<number | null>(null);
  const [week, setWeek] = useState<boolean[]>([]);
  const ready = row !== undefined && shown !== undefined && dayTotal(row) >= STREAK_MIN_QUESTIONS && shown !== today;

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const n = await computeStreak();
      const days = weekOf(today);
      const rows = await db.daily.bulkGet(days);
      setWeek(days.map((d, i) => d < today ? studied(rows[i]) || n > days.length : d === today));
      setStreak(n);
      await db.kv.put({ key: 'streakShown', value: today });
    })().catch(console.error);
  }, [ready, today]);

  if (streak == null) return null;
  const days = weekOf(today);
  return (
    <div className="streak-pop" onClick={() => setStreak(null)}>
      <div className="sp-flame">
        <Icon name="flame" size={150} />
      </div>
      <b className="sp-num">{streak}</b>
      <p className="sp-title">연속 학습!</p>
      <div className="sp-week">
        {days.map((d, i) => (
          <span key={d} className={week[i] && d <= today ? 'on' : ''}>
            {week[i] && d <= today ? <Icon name="check" size={22} /> : WEEKDAYS_KO[dayOfWeek(d)]}
          </span>
        ))}
      </div>
      <p className="sp-next">
        내일도 학습해서
        <br />
        {streak + 1}일 연속 학습을 달성하세요!
      </p>
      <button className="btn primary big sp-ok" onClick={() => setStreak(null)}>
        확인
      </button>
    </div>
  );
}
