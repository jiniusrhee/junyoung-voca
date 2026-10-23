import { describe, expect, it } from 'vitest';
import { bestStreak, estimateVocab, goalMet } from '../stats';
import { formatAfter, formatAgo, weekOf } from '../time';

const day = (date: string, total: number, goal?: number) => ({ date, total, newWords: total, reviews: 0, correct: 0, timeMs: 0, goal });

describe('stats', () => {
  it('finds the longest run of studied days', () => {
    expect(bestStreak([day('2026-10-01', 10), day('2026-10-02', 6), day('2026-10-03', 2), day('2026-10-04', 9)])).toBe(2);
    expect(bestStreak([])).toBe(0);
  });

  it('judges the daily goal with the goal saved that day', () => {
    expect(goalMet(day('2026-10-01', 20, 20), 50)).toBe(true);
    expect(goalMet(day('2026-10-01', 20), 50)).toBe(false);
  });

  it('estimates vocabulary within the level band', () => {
    expect(estimateVocab(10, 0.5)).toBe(2600);
    expect(estimateVocab(1, null)).toBe(110);
  });

  it('formats badge times', () => {
    const now = new Date(2026, 9, 23, 12);
    expect(formatAfter(new Date(now.getTime() + 3 * 86_400_000), now)).toBe('3일 뒤');
    expect(formatAfter(new Date(now.getTime() + 60 * 86_400_000), now)).toBe('2개월 뒤');
    expect(formatAgo(new Date(now.getTime() - 86_400_000), now)).toBe('1일 전');
  });

  it('builds a Sunday-first week', () => {
    const w = weekOf('2026-10-23');
    expect(w[0]).toBe('2026-10-18');
    expect(w[6]).toBe('2026-10-24');
  });
});
