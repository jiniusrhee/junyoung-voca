export const MIN_LEVEL = 1;
export const MAX_LEVEL = 30;
export const LEVEL_TEST_QUESTIONS = 20;

export const clampLevel = (n: number): number => Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, n));

/** 레벨 테스트 단계 크기: 처음엔 크게, 뒤로 갈수록 작게 */
export function testStepSize(askedSoFar: number): number {
  return askedSoFar <= 8 ? 3 : askedSoFar <= 14 ? 2 : 1;
}

export interface TestRecord {
  level: number;
  correct: boolean;
}

export function nextTestLevel(level: number, askedAfter: number, correct: boolean): number {
  const step = testStepSize(askedAfter);
  return clampLevel(level + (correct ? step : -step));
}

export function finalLevelFrom(history: TestRecord[]): number {
  if (!history.length) return 10;
  const tail = history.slice(-10);
  const avg = tail.reduce((s, h) => s + h.level + (h.correct ? 0.5 : -0.5), 0) / tail.length;
  return clampLevel(Math.round(avg));
}

/** 최근 새 단어 중 '이미 알던' 비율로 레벨을 조정 */
export function suggestLevelChange(level: number, recentNewWordKnownRate: number): number {
  if (recentNewWordKnownRate >= 0.85) return clampLevel(level + 1);
  if (recentNewWordKnownRate <= 0.3) return clampLevel(level - 1);
  return level;
}

export function newWordRange(level: number, difficulty: 'easy' | 'normal' | 'hard'): [number, number] {
  if (difficulty === 'easy') return [clampLevel(level - 2), level];
  if (difficulty === 'hard') return [level, clampLevel(level + 2)];
  return [clampLevel(level - 1), clampLevel(level + 1)];
}
