import { db } from '../db';
import { isKnownOrSolid } from './scheduler';
import { STREAK_MIN_QUESTIONS, shiftDate, studyDateOf } from './time';

export async function computeStreak(now: Date = new Date()): Promise<number> {
  const rows = await db.daily.toArray();
  const totals = new Map(rows.map((r) => [r.date, r.total]));
  let date = studyDateOf(now);
  // 오늘 아직 기준을 못 채웠으면 어제부터 센다 (오늘은 아직 끊긴 게 아님)
  if ((totals.get(date) ?? 0) < STREAK_MIN_QUESTIONS) date = shiftDate(date, -1);
  let streak = 0;
  while ((totals.get(date) ?? 0) >= STREAK_MIN_QUESTIONS) {
    streak++;
    date = shiftDate(date, -1);
  }
  return streak;
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
