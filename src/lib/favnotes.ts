import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Tone } from '../types';

/** 내가 좋아하는 오답노트: 오답 말풍선의 ♥ 로 담은 설명 (말해보카 구조, 최대 500) */
export interface FavNote {
  /** `${wordId}#${sentenceIdx}#${w}` */
  key: string;
  wordId: string;
  sentenceIdx: number;
  w: string;
  tone: Tone;
  m: string;
  ts: number;
}

const KEY = 'favNotes';
export const FAV_NOTE_LIMIT = 500;

export async function getFavNotes(): Promise<FavNote[]> {
  return ((await db.kv.get(KEY))?.value as FavNote[] | undefined) ?? [];
}
export function useFavNotes(): FavNote[] | undefined {
  return useLiveQuery(getFavNotes, []);
}
export function favNoteKey(wordId: string, sentenceIdx: number, w: string): string {
  return `${wordId}#${sentenceIdx}#${w}`;
}
/** 담겨 있으면 빼고, 없으면 담는다. 담겼는지 반환 */
export async function toggleFavNote(n: Omit<FavNote, 'ts' | 'key'>): Promise<boolean> {
  const key = favNoteKey(n.wordId, n.sentenceIdx, n.w);
  const all = await getFavNotes();
  if (all.some((x) => x.key === key)) {
    await db.kv.put({ key: KEY, value: all.filter((x) => x.key !== key) });
    return false;
  }
  await db.kv.put({ key: KEY, value: [{ ...n, key, ts: Date.now() }, ...all].slice(0, FAV_NOTE_LIMIT) });
  return true;
}
export async function removeFavNote(key: string): Promise<void> {
  const all = await getFavNotes();
  await db.kv.put({ key: KEY, value: all.filter((x) => x.key !== key) });
}
