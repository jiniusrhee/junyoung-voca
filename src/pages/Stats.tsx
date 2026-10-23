import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { computeStreak, countKnownWords } from '../lib/stats';
import { formatDuration, shiftDate, shortDate, studyDateOf } from '../lib/time';

export default function Stats() {
  const settings = useSettings();
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const cardCount = useLiveQuery(() => db.cards.count(), []);
  const known = useLiveQuery(() => countKnownWords(), []);
  const streak = useLiveQuery(() => computeStreak(), []);

  if (!settings || !daily) {
    return (
      <div className="screen">
        <p className="muted">불러오는 중…</p>
      </div>
    );
  }

  const byDate = new Map(daily.map((d) => [d.date, d]));
  const today = studyDateOf();
  const days = Array.from({ length: 30 }, (_, i) => shiftDate(today, i - 29));
  const max = Math.max(settings.dailyGoal, ...days.map((d) => byDate.get(d)?.total ?? 0));
  const last7 = days.slice(-7).map((d) => byDate.get(d)).filter((d) => d !== undefined);
  const total7 = last7.reduce((s, d) => s + d.total, 0);
  const acc7 = total7 ? Math.round((last7.reduce((s, d) => s + d.correct, 0) / total7) * 100) : 0;
  const totalTime = daily.reduce((s, d) => s + d.timeMs, 0);
  const totalQ = daily.reduce((s, d) => s + d.total, 0);
  const W = 300;
  const H = 120;
  const bw = W / 30;
  const goalY = H - (settings.dailyGoal / max) * (H - 10);

  return (
    <div className="screen">
      <h1>통계</h1>
      <div className="stats-grid">
        <Tile label="연속 학습" value={`${streak ?? 0}일`} />
        <Tile label="학습한 단어" value={`${cardCount ?? 0}`} />
        <Tile label="아는 단어" value={`${known ?? 0}`} />
        <Tile label="7일 정답률" value={`${acc7}%`} />
        <Tile label="총 문제 수" value={`${totalQ}`} />
        <Tile label="총 학습 시간" value={formatDuration(totalTime)} />
      </div>
      <h3>최근 30일</h3>
      <div className="card">
        <svg viewBox={`0 0 ${W} ${H}`} className="bars" preserveAspectRatio="none">
          {days.map((d, i) => {
            const t = byDate.get(d)?.total ?? 0;
            const h = (t / max) * (H - 10);
            return <rect key={d} x={i * bw + 1} y={H - h} width={bw - 2} height={h} className={t >= settings.dailyGoal ? 'bar-goal' : 'bar'} />;
          })}
          <line x1={0} x2={W} y1={goalY} y2={goalY} className="goal-line" />
        </svg>
        <div className="bars-axis muted small">
          <span>{shortDate(days[0])}</span>
          <span>{shortDate(days[29])}</span>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="tile-value">{value}</span>
      <span className="tile-label muted small">{label}</span>
    </div>
  );
}
