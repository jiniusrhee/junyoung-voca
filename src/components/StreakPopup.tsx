import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../db';
import { useKeptQuery } from '../lib/liveCache';
import { isStudy } from '../lib/pageTransition';
import { computeStreak, dayTotal, studied } from '../lib/stats';
import { STREAK_MIN_QUESTIONS, WEEKDAYS_KO, dayOfWeek, studyDateOf, weekOf } from '../lib/time';

/**
 * 그날의 연속 학습을 처음 달성하고 학습 화면에서 나올 때 한 번 뜨는 "N 연속 학습!" 화면.
 * 말해보카 플립 실측(2026-11-14): '학습 완료'를 누르면 학습 화면 위로 거의 검게 덮이고(가운데 위가 붉게 빛남)
 * 꺼진 불꽃과 어제 숫자가 0.3초쯤 보인 뒤 불이 붙으며 숫자가 오늘 것으로 바뀐다. 아래에는 이번 주 요일 동그라미(한 날은 주황 + 체크),
 * 가는 선, "내일도 학습해서 / N+1일 연속 학습을 달성하세요!", 맨 아래에 '확인'.
 * (실제 앱의 SNS 공유 단추와 그 뒤의 포인트·리그 화면은 만들지 않는다.)
 * 학습 중에는 뜨지 않는다 — 학습 화면에서 나온 뒤(홈 등)에 뜬다.
 */
export default function StreakPopup() {
  const today = studyDateOf();
  const loc = useLocation();
  const daily = useKeptQuery('daily', () => db.daily.toArray());
  const row = daily?.find((d) => d.date === today);
  const shown = useLiveQuery(async () => ((await db.kv.get('streakShown'))?.value as string | undefined) ?? '', []);
  const [streak, setStreak] = useState<number | null>(null);
  const [week, setWeek] = useState<boolean[]>([]);
  /** 불이 붙었는가 (뜨고 0.3초 뒤) */
  const [lit, setLit] = useState(false);
  const ready = daily !== undefined && shown !== undefined && dayTotal(row) >= STREAK_MIN_QUESTIONS && shown !== today && !isStudy(loc.pathname);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      const n = await computeStreak();
      const days = weekOf(today);
      const rows = await db.daily.bulkGet(days);
      if (!alive) return;
      setWeek(days.map((d, i) => (d < today ? studied(rows[i]) || n > days.length : d === today)));
      setLit(false);
      setStreak(n);
      document.body.dataset.streakPop = '1';
      await db.kv.put({ key: 'streakShown', value: today });
    })().catch(console.error);
    return () => {
      alive = false;
    };
  }, [ready, today]);

  useEffect(() => {
    if (streak == null) return;
    const t = window.setTimeout(() => setLit(true), 320);
    return () => window.clearTimeout(t);
  }, [streak]);

  const close = () => {
    setStreak(null);
    delete document.body.dataset.streakPop;
    window.dispatchEvent(new Event('streakpop-closed'));
  };

  if (streak == null) return null;
  const days = weekOf(today);
  return (
    <div
      className={`modal-dim streak-pop2${lit ? ' lit' : ''}`}
      // 폰의 뒤로 가기(nativeBack 이 .modal-dim 을 click() 한다 — detail 0)로는 닫히고, 손으로 바탕을 눌러서는 닫히지 않는다
      onClick={(e) => {
        if (e.target === e.currentTarget && e.detail === 0) close();
      }}
    >
      <div className="st-flame" aria-hidden="true">
        <svg viewBox="0 0 40.667 48.667">
          <path
            className="st-flame-body"
            d="M17.500 0.300c3.800 2.600 7.400 7.500 8.800 11.900 1.200-1.300 2.900-2.600 4.500-2.600 2.200 0 9.867 8.900 9.867 18.700 0 11.200-9.100 20.367-20.333 20.367S0 39.500 0 28.300C0 16.000 10.500 5.500 15.500 1.000c0.700-0.600 1.400-0.900 2.000-0.700z"
          />
          <path className="st-flame-core" d="M20.600 20.100c1.400 0 7.800 6.400 7.800 11.500a8 8 0 0 1-16 0c0-5.100 6.800-11.500 8.200-11.500z" />
        </svg>
        <i className="st-spark s1" />
        <i className="st-spark s2" />
      </div>
      <b className="st-num" lang="en">
        {lit ? streak : Math.max(0, streak - 1)}
      </b>
      <p className="st-title">연속 학습!</p>
      <div className="st-panel">
        <div className="st-week">
          {days.map((d, i) => {
            const on = week[i] && d <= today;
            return (
              <span key={d} className={on ? 'on' : ''}>
                {on ? (
                  <svg viewBox="0 0 29 29" aria-hidden="true">
                    <path d="M8.300 14.800l4.300 4.200 8.100-8.300" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  WEEKDAYS_KO[dayOfWeek(d)]
                )}
              </span>
            );
          })}
        </div>
        <p className="st-next">
          내일도 학습해서
          <br />
          <span lang="en">{streak + 1}</span>일 연속 학습을 달성하세요!
        </p>
      </div>
      <button className="st-ok" onClick={close}>
        확인
      </button>
    </div>
  );
}
