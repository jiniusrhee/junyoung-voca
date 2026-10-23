import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/** 내 단어장: 사용자가 직접 담은 단어 id 목록 (최근 것이 앞) */
export async function getWordbook(): Promise<string[]> {
  return ((await db.kv.get('wordbook'))?.value as string[] | undefined) ?? [];
}

export function useWordbook(): string[] | undefined {
  return useLiveQuery(getWordbook, []);
}

export async function toggleWordbook(wordId: string): Promise<boolean> {
  const list = await getWordbook();
  const has = list.includes(wordId);
  const next = has ? list.filter((x) => x !== wordId) : [wordId, ...list];
  await db.kv.put({ key: 'wordbook', value: next });
  return !has;
}
