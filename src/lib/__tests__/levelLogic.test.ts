import { describe, expect, it } from 'vitest';
import { finalLevelFrom, newWordRange, nextTestLevel, suggestLevelChange } from '../levelLogic';

describe('levelLogic', () => {
  it('uses shrinking step sizes and clamps to 1..30', () => {
    expect(nextTestLevel(10, 1, true)).toBe(13);
    expect(nextTestLevel(10, 9, false)).toBe(8);
    expect(nextTestLevel(10, 15, true)).toBe(11);
    expect(nextTestLevel(30, 1, true)).toBe(30);
    expect(nextTestLevel(1, 1, false)).toBe(1);
  });

  it('averages the tail of the test history', () => {
    const h = Array.from({ length: 20 }, (_, i) => ({ level: 12, correct: i % 2 === 0 }));
    expect(finalLevelFrom(h)).toBe(12);
    expect(finalLevelFrom([])).toBe(10);
  });

  it('suggests level changes from the known-word rate', () => {
    expect(suggestLevelChange(10, 0.9)).toBe(11);
    expect(suggestLevelChange(10, 0.2)).toBe(9);
    expect(suggestLevelChange(10, 0.6)).toBe(10);
    expect(suggestLevelChange(30, 1)).toBe(30);
  });

  it('builds new-word ranges per difficulty', () => {
    expect(newWordRange(10, 'normal')).toEqual([9, 11]);
    expect(newWordRange(10, 'easy')).toEqual([8, 10]);
    expect(newWordRange(29, 'hard')).toEqual([29, 30]);
  });
});
