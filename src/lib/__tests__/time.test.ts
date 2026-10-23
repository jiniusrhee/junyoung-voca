import { describe, expect, it } from 'vitest';
import { formatRelative, shiftDate, studyDateOf } from '../time';

describe('time', () => {
  it('rolls the study date over at 04:00', () => {
    expect(studyDateOf(new Date(2026, 9, 23, 3, 59))).toBe('2026-10-22');
    expect(studyDateOf(new Date(2026, 9, 23, 4, 0))).toBe('2026-10-23');
  });

  it('shifts dates across month boundaries', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('formats relative due times in Korean', () => {
    const now = new Date();
    expect(formatRelative(now, now)).toBe('지금');
    expect(formatRelative(new Date(now.getTime() + 10 * 60_000), now)).toBe('10분 후');
    expect(formatRelative(new Date(now.getTime() + 3 * 86_400_000), now)).toBe('3일 후');
    expect(formatRelative(new Date(now.getTime() + 180 * 86_400_000), now)).toBe('6개월 후');
  });
});
