import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { studyDateOf } from './time';

/** 앱 내 알림함 항목 (말해보카 알림함: 날짜별 카드, 최근 30일) */
export interface InboxItem {
  id: string;
  /** 학습일 기준 날짜 YYYY-MM-DD */
  date: string;
  /** HH:MM */
  time: string;
  title: string;
  body: string;
  /** 누르면 갈 곳 */
  to?: string;
}

const KEY = 'inbox';
const DAYS = 30;

export async function getInbox(): Promise<InboxItem[]> {
  const all = ((await db.kv.get(KEY))?.value as InboxItem[] | undefined) ?? [];
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
  return all.filter((i) => i.date >= cutoff).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

export function useInbox(): InboxItem[] | undefined {
  return useLiveQuery(getInbox, []);
}

/** 알림함에 한 줄 추가 (같은 날 같은 제목은 한 번만) */
export async function pushInbox(title: string, body: string, to?: string): Promise<void> {
  const all = ((await db.kv.get(KEY))?.value as InboxItem[] | undefined) ?? [];
  const date = studyDateOf();
  if (all.some((i) => i.date === date && i.title === title)) return;
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const item: InboxItem = { id: `${Date.now()}`, date, time, title, body, to };
  await db.kv.put({ key: KEY, value: [item, ...all].slice(0, 200) });
}
