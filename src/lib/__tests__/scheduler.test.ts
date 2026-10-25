import { describe, expect, it } from 'vitest';
import { Rating, State } from 'ts-fsrs';
import { KNOWN_WORD_DAYS, applyReview, gradeOf, masteryOf, newCardRow, type Outcome } from '../scheduler';

const now = new Date(2026, 9, 23, 10, 0, 0);
const clean: Outcome = { firstTry: true, hints: 0, showedAnswer: false, wrongAttempts: 0, elapsedMs: 3000 };

describe('scheduler', () => {
  it('treats a new word answered cleanly as already known', () => {
    const { row, known } = applyReview(newCardRow('x', now), clean, now);
    expect(known).toBe(true);
    expect(row.state).toBe(State.Review);
    const days = (row.due.getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(KNOWN_WORD_DAYS - 0.01);
    expect(masteryOf(row)).toBe('strong');
  });

  it('brings a failed new word back within minutes', () => {
    const { row, grade, known } = applyReview(newCardRow('x', now), { ...clean, firstTry: false, showedAnswer: true }, now);
    expect(known).toBe(false);
    expect(grade).toBe(Rating.Again);
    expect(row.due.getTime() - now.getTime()).toBeLessThanOrEqual(6 * 60_000);
    expect(row.state).toBe(State.Learning);
    expect(masteryOf(row)).toBe('fresh');
  });

  it('grades hints, reveals and retries like 말해보카', () => {
    const row = newCardRow('x', now);
    expect(gradeOf({ ...clean, hints: 1 }, row)).toBe(Rating.Hard);
    expect(gradeOf({ ...clean, showedAnswer: true }, row)).toBe(Rating.Again);
    // 처음 보는 단어: 오답 뒤 정답은 5분 뒤 다시 (Again)
    expect(gradeOf({ ...clean, firstTry: false, wrongAttempts: 1 }, row)).toBe(Rating.Again);
    // 복습 단어: 오답 뒤 정답은 다음 단계로 (Good)
    const reviewed = applyReview(row, { ...clean, showedAnswer: true }, now).row;
    expect(gradeOf({ ...clean, firstTry: false, wrongAttempts: 1 }, reviewed)).toBe(Rating.Good);
  });

  it('marks a known word as shaky after a lapse', () => {
    const first = applyReview(newCardRow('x', now), clean, now).row;
    const later = new Date(now.getTime() + 200 * 86_400_000);
    const { row } = applyReview(first, { ...clean, firstTry: false, showedAnswer: true }, later);
    expect(row.lapses).toBe(1);
    expect(masteryOf(row)).toBe('shaky');
  });
});
