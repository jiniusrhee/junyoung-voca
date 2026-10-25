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

function span(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min}분`;
  const hr = Math.round(ms / 3_600_000);
  if (hr < 24) return `${hr}시간`;
  const day = Math.round(ms / 86_400_000);
  if (day < 30) return `${day}일`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month}개월`;
  return `${Math.round(day / 365)}년`;
}

export function formatRelative(due: Date, now: Date = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 30_000) return '지금';
  return `${span(ms)} 후`;
}

/** "3일 뒤 복습" 배지용 */
export function formatAfter(due: Date, now: Date = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 30_000) return '곧';
  return `${span(ms)} 뒤`;
}

/** "1일 전" 배지용 */
export function formatAgo(past: Date, now: Date = new Date()): string {
  const ms = now.getTime() - past.getTime();
  if (ms < 60_000) return '방금';
  return `${span(ms)} 전`;
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

export function formatClock(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** studyDate가 속한 주(월요일 시작, 말해보카 홈 연속 학습 줄과 같음)의 날짜 7개 */
export function weekOf(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d, 12).getDay();
  const monday = shiftDate(date, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}
