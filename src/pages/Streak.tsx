import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { getImported, importedRange, inRange } from '../lib/imported';
import { saveSettings, useSettings } from '../lib/settings';
import { computeStreak, getRepairedDays, goalMet, repairDay, studied } from '../lib/stats';
import { WEEKDAYS_KO, dayOfWeek, shiftDate, studyDateOf } from '../lib/time';

export const STREAK_GOALS = [7, 14, 30, 50, 100, 150, 200, 300, 365, 500, 700, 1000, 1500, 2000];
/** 이달의 학습 메달 기준(학습한 날 수) */
const MEDALS: { key: 'bronze' | 'silver' | 'gold'; days: number; label: string }[] = [
  { key: 'bronze', days: 10, label: '브론즈' },
  { key: 'silver', days: 20, label: '실버' },
  { key: 'gold', days: 26, label: '골드' },
];

/** 연속 학습 화면 (말해보카 홈 연속 학습 카드 → 월별 달력) */
export default function Streak() {
  const nav = useNavigate();
  const s = useSettings();
  const today = studyDateOf();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [goalOpen, setGoalOpen] = useState(false);
  const [help, setHelp] = useState<string | null>(null);
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const streak = useLiveQuery(() => computeStreak(), []);
  const imp = useLiveQuery(() => getImported(), []);
  const repaired = useLiveQuery(() => getRepairedDays(), []);
  const pens = useLiveQuery(async () => ((await db.kv.get('repairPens'))?.value as number | undefined) ?? 0, []);
  if (!s || !daily || streak == null) return <div className="screen" />;

  const byDate = new Map(daily.map((d) => [d.date, d]));
  const range = importedRange(imp);
  const did = (d: string) => studied(byDate.get(d)) || inRange(range, d) || !!repaired?.has(d);
  const trophy = (d: string) => goalMet(byDate.get(d), s.dailyGoal) || (!byDate.get(d) && inRange(range, d));
  const goal = s.streakGoal ?? (STREAK_GOALS.find((g) => g > streak) ?? streak + 100);
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const daysInMonth = new Date(y, m, 0).getDate();
  const lead = dayOfWeek(first);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const monthDone = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter((d) => d <= today && did(d)).length;
  const nextMedal = MEDALS.find((md) => monthDone < md.days);
  const medalText = nextMedal ? `${nextMedal.label}까지 ${nextMedal.days - monthDone}일 남음` : '골드 달성!';
  // 어제가 비어서 연속이 끊긴 경우에만 복구펜을 쓸 수 있다
  const yesterday = shiftDate(today, -1);
  const canRepair = (pens ?? 0) > 0 && !did(yesterday) && did(shiftDate(today, -2));
  const dLeft = Math.max(0, goal - streak);

  return (
    <div className="screen streak-page">
      <header className="streak-head">
        <button className="icon-btn light" onClick={() => setMonth((mm) => shiftMonth(mm, -1))} aria-label="이전 달">
          <Icon name="back" size={22} />
        </button>
        <div className="streak-ym">
          <span>{y}</span>
          <b>{m}</b>
        </div>
        <button className="icon-btn light" onClick={() => setMonth((mm) => (mm < today.slice(0, 7) ? shiftMonth(mm, 1) : mm))} aria-label="다음 달" disabled={month >= today.slice(0, 7)}>
          <Icon name="chevron" size={22} />
        </button>
        <span className="streak-mascot">
          <Mascot size={120} mood="cheer" />
        </span>
        <button className="streak-close" onClick={() => nav(-1)} aria-label="닫기">
          <Icon name="close" size={22} />
        </button>
      </header>

      <section className="s-card streak-sum">
        <div className="ss-left">
          <span>
            연속 학습일{' '}
            <i className="qmark" onClick={() => setHelp('하루에 5문제 이상 풀면 연속 학습일이 이어져요. 하루 기준은 새벽 4시예요.')}>
              ?
            </i>
          </span>
          <b>
            <Icon name="flame" size={30} /> {streak}
          </b>
        </div>
        <button className="ss-right" onClick={() => setGoalOpen(true)}>
          <span>
            <Icon name="ruby" size={16} /> 내 목표 <b>{goal}일</b>
          </span>
          <span className="ss-bar">
            <i style={{ width: `${Math.min(100, (streak / goal) * 100)}%` }} />
            <em>
              {streak}/{goal}
            </em>
          </span>
        </button>
      </section>

      <section className="s-card streak-cal">
        <div className="cal-head">
          {WEEKDAYS_KO.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div key={r} className="cal-row">
            {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <span key={i} className="cal-cell empty" />;
              const on = d <= today && did(d);
              const prev = on && i > 0 && cells[r * 7 + i - 1] != null && did(cells[r * 7 + i - 1]!);
              const next = on && i < 6 && cells[r * 7 + i + 1] != null && cells[r * 7 + i + 1]! <= today && did(cells[r * 7 + i + 1]!);
              const cls = ['cal-cell', on ? 'on' : '', on && !prev ? 'start' : '', on && !next ? 'end' : '', d === today ? 'today' : '', d > today ? 'future' : ''].filter(Boolean).join(' ');
              return (
                <span key={d} className={cls}>
                  {on ? (
                    <span className={`stamp ${trophy(d) ? 'gold' : 'star'}`}>
                      <Icon name={trophy(d) ? 'trophy' : 'star'} size={18} />
                    </span>
                  ) : (
                    <span className="cal-num">{Number(d.slice(8))}</span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
        <p className="cal-dleft">
          <Icon name="gift" size={16} /> D-{dLeft}
        </p>
      </section>

      <section className="s-card medal-card">
        <div className="medal-head">
          <b>
            이달의 학습 메달{' '}
            <i className="qmark" onClick={() => setHelp('이번 달에 학습한 날이 10일이면 브론즈, 20일이면 실버, 26일이면 골드예요.')}>
              ?
            </i>
          </b>
          <span>{medalText}</span>
        </div>
        <div className="medal-bar">
          <i style={{ width: `${Math.min(100, (monthDone / 26) * 100)}%` }} />
          {MEDALS.map((md) => (
            <span key={md.key} className={`medal ${md.key} ${monthDone >= md.days ? 'got' : ''}`} style={{ left: `${(md.days / 26) * 100}%` }}>
              <Icon name="medal" size={30} />
            </span>
          ))}
        </div>
      </section>

      <section className="s-card pen-card">
        <b>
          보유한 복구펜{' '}
          <i className="qmark" onClick={() => setHelp('연속 학습이 30일씩 이어질 때마다 복구펜을 1개 받아요. 하루를 놓쳐 연속이 끊기면 복구펜으로 어제를 채울 수 있어요.')}>
            ?
          </i>
        </b>
        <span className="pen-count">
          <Icon name="pencil" size={22} /> {pens ?? 0}
        </span>
        {canRepair && (
          <button className="btn primary pen-use" onClick={() => void repairDay(yesterday)}>
            복구펜으로 어제 채우기
          </button>
        )}
      </section>

      {help && (
        <div className="modal-dim" onClick={() => setHelp(null)}>
          <div className="opt-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="help-text">{help}</p>
            <button className="btn primary big" onClick={() => setHelp(null)}>
              확인
            </button>
          </div>
        </div>
      )}
      {goalOpen && (
        <div className="modal-dim" onClick={() => setGoalOpen(false)}>
          <div className="opt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>내 목표</h3>
            <div className="goal-grid">
              {STREAK_GOALS.map((g) => (
                <button
                  key={g}
                  className={`chip-btn ${goal === g ? 'active' : ''}`}
                  onClick={() => {
                    void saveSettings({ streakGoal: g });
                    setGoalOpen(false);
                  }}
                >
                  {g}일
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
