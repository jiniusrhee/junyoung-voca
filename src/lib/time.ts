/** 말해보카처럼 하루의 경계는 새벽 4시 */
export const DAY_START_HOUR = 4;
/** 하루 이 문제 수 이상 풀면 연속 학습일 유지 */
export const STREAK_MIN_QUESTIONS = 5;

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function studyDateOf(now: Date = new Date()): string {
  return formatDate(new Date(now.getTime() - DAY_START_HOUR * 3_600_000));
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, m - 1, d, 12);
  t.setDate(t.getDate() + days);
  return formatDate(t);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function formatRelative(due: Date, now: Date = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 30_000) return '지금';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}분 후`;
  const hr = Math.round(ms / 3_600_000);
  if (hr < 24) return `${hr}시간 후`;
  const day = Math.round(ms / 86_400_000);
  if (day < 30) return `${day}일 후`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}개월 후`;
  return `${Math.round(day / 365)}년 후`;
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}
