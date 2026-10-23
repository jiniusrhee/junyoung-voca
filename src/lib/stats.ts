import { db } from '../db';
import type { DailyRow, ImportedProgress, StudyMode } from '../types';
import { getImported, importedRange, inRange, type DayRange } from './imported';
import { isKnownOrSolid } from './scheduler';
import { STREAK_MIN_QUESTIONS, shiftDate, studyDateOf } from './time';

/** 그날 푼 문제 수 (mode 없으면 모든 모드 합) */
export function dayTotal(d: DailyRow | undefined, mode?: StudyMode): number {
  if (!d) return 0;
  if (mode === 'vocab') return d.total;
  if (mode) return d.byMode?.[mode]?.total ?? 0;
  return d.total + Object.values(d.byMode ?? {}).reduce((s, m) => s + (m?.total ?? 0), 0);
}

/** 그날 모든 모드의 학습 시간 */
export function dayTime(d: DailyRow | undefined): number {
  if (!d) return 0;
  return d.timeMs + Object.values(d.byMode ?? {}).reduce((s, m) => s + (m?.timeMs ?? 0), 0);
}

export function studied(d: DailyRow | undefined): boolean {
  return dayTotal(d) >= STREAK_MIN_QUESTIONS;
}

export function goalMet(d: DailyRow | undefined, currentGoal: number): boolean {
  return !!d && d.total >= (d.goal ?? currentGoal);
}

export async function computeStreak(now: Date = new Date()): Promise<number> {
  const rows = await db.daily.toArray();
  const range = importedRange(await getImported());
  const totals = new Map(rows.map((r) => [r.date, dayTotal(r)]));
  const ok = (d: string) => (totals.get(d) ?? 0) >= STREAK_MIN_QUESTIONS || inRange(range, d);
  let date = studyDateOf(now);
  // 오늘 아직 기준을 못 채웠으면 어제부터 센다 (오늘은 아직 끊긴 게 아님)
  if (!ok(date)) date = shiftDate(date, -1);
  let streak = 0;
  while (ok(date)) {
    streak++;
    date = shiftDate(date, -1);
  }
  return streak;
}

export function bestStreak(rows: DailyRow[], range?: DayRange | null): number {
  const set = new Set(rows.filter(studied).map((r) => r.date));
  if (range) for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) set.add(d);
  const days = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && shiftDate(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export async function countKnownWords(): Promise<number> {
  const cards = await db.cards.toArray();
  return cards.filter(isKnownOrSolid).length;
}

export async function countDue(now: Date = new Date()): Promise<number> {
  return db.cards.where('due').belowOrEqual(now).count();
}

export async function countAvailableNew(): Promise<number> {
  const [words, cards] = await Promise.all([db.words.count(), db.cards.count()]);
  return Math.max(0, words - cards);
}

/** 최근 7일 복습 문제 정답률(힌트 없이 한 번에 맞힌 비율) */
export async function reviewAccuracy(days = 7, now: Date = new Date(), mode: StudyMode = 'vocab'): Promise<number | null> {
  const from = shiftDate(studyDateOf(now), -(days - 1));
  const rows = await db.reviews
    .where('studyDate')
    .aboveOrEqual(from)
    .filter((r) => !r.isNew && !r.isTest && (r.studyMode ?? 'vocab') === mode)
    .toArray();
  if (!rows.length) return null;
  return rows.filter((r) => r.firstTry && r.hints === 0).length / rows.length;
}

/** 최근 새 단어 중 처음부터 알던 비율 (어휘 이해도) */
export async function comprehension(limit = 100): Promise<number | null> {
  const rows = await db.reviews.orderBy('ts').reverse().filter((r) => r.isNew).limit(limit).toArray();
  if (!rows.length) return null;
  return rows.filter((r) => r.firstTry && r.hints === 0).length / rows.length;
}

/** 레벨 경계에 해당하는 대략적인 빈도 순위 (레벨 n까지 익히면 상위 n번째 단어까지) */
const LEVEL_RANK = [0, 150, 300, 500, 700, 1000, 1300, 1600, 2000, 2400, 2800, 3300, 3800, 4300, 4900, 5500, 6100, 6800, 7500, 8200, 9000, 10000, 11000, 12000, 13000, 14000, 15000, 16500, 18000, 19500, 21000];

/** 레벨과 이해도로 아는 어휘 수를 대략 추정 */
export function estimateVocab(level: number, rate: number | null): number {
  const lv = Math.min(30, Math.max(1, level));
  const lo = LEVEL_RANK[lv - 1];
  const hi = LEVEL_RANK[lv];
  return Math.round((lo + (hi - lo) * (rate ?? 0.7)) / 10) * 10;
}

/** 화면에 보여줄 어휘 수: 들여온 기록이 더 최신이면 그 값, 아니면 추정치 */
export function displayVocab(level: number, rate: number | null, imp?: ImportedProgress | null, testDate?: string | null): number {
  if (imp?.vocabSize && (!testDate || testDate <= imp.asOf)) return imp.vocabSize;
  return estimateVocab(level, rate);
}

/** 어휘력 날짜 설명 */
export function vocabDateText(imp?: ImportedProgress | null, testDate?: string | null): string | null {
  if (testDate && (!imp || testDate > imp.asOf)) return `${testDate} 측정 결과`;
  if (imp?.vocabSize) return `${imp.asOf} ${imp.source} 기록`;
  return null;
}
