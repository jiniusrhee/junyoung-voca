import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/** 내 단어장: 이름 있는 단어장 여러 개 (말해보카 구조) */
export interface WordbookRow {
  id: string;
  name: string;
  /** 단어 id (최근 담은 것이 앞) */
  ids: string[];
  createdAt: number;
}

const KEY = 'wordbooks';

async function save(books: WordbookRow[]): Promise<void> {
  await db.kv.put({ key: KEY, value: books });
}

/** 단어장 목록. 예전 단일 단어장(kv 'wordbook')이 있으면 첫 단어장으로 옮긴다 */
export async function getWordbooks(): Promise<WordbookRow[]> {
  const books = ((await db.kv.get(KEY))?.value as WordbookRow[] | undefined) ?? [];
  const legacy = ((await db.kv.get('wordbook'))?.value as string[] | undefined) ?? [];
  if (!books.length && legacy.length) {
    const first: WordbookRow = { id: `wb-${Date.now()}`, name: '1. 내 단어장', ids: legacy, createdAt: Date.now() };
    await save([first]);
    await db.kv.delete('wordbook');
    return [first];
  }
  return books;
}

export function useWordbooks(): WordbookRow[] | undefined {
  return useLiveQuery(getWordbooks, []);
}

export function defaultBookName(n: number): string {
  return `${n}. 내 단어장`;
}

export async function createWordbook(name?: string): Promise<WordbookRow> {
  const books = await getWordbooks();
  const row: WordbookRow = { id: `wb-${Date.now()}`, name: (name ?? '').trim() || defaultBookName(books.length + 1), ids: [], createdAt: Date.now() };
  await save([...books, row]);
  return row;
}

export async function renameWordbook(id: string, name: string): Promise<void> {
  const books = await getWordbooks();
  await save(books.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b)));
}

export async function deleteWordbook(id: string): Promise<void> {
  await save((await getWordbooks()).filter((b) => b.id !== id));
}

/** 모든 단어장에 담긴 단어 id (최근 것이 앞) */
export async function getWordbook(): Promise<string[]> {
  const books = await getWordbooks();
  return [...new Set(books.flatMap((b) => b.ids))];
}

export function useWordbook(): string[] | undefined {
  return useLiveQuery(getWordbook, []);
}

/** 단어를 단어장에 넣거나 뺀다. bookId 가 없으면: 어딘가에 있으면 모두에서 빼고, 없으면 첫 단어장에 넣는다(없으면 만든다) */
export async function toggleWordbook(wordId: string, bookId?: string): Promise<boolean> {
  let books = await getWordbooks();
  if (bookId) {
    const b = books.find((x) => x.id === bookId);
    if (!b) return false;
    const has = b.ids.includes(wordId);
    await save(books.map((x) => (x.id === bookId ? { ...x, ids: has ? x.ids.filter((i) => i !== wordId) : [wordId, ...x.ids] } : x)));
    return !has;
  }
  const has = books.some((b) => b.ids.includes(wordId));
  if (has) {
    await save(books.map((b) => ({ ...b, ids: b.ids.filter((i) => i !== wordId) })));
    return false;
  }
  if (!books.length) {
    await createWordbook();
    books = await getWordbooks();
  }
  await save(books.map((b, i) => (i === 0 ? { ...b, ids: [wordId, ...b.ids] } : b)));
  return true;
}

export async function removeFromWordbook(bookId: string, wordId: string): Promise<void> {
  const books = await getWordbooks();
  await save(books.map((b) => (b.id === bookId ? { ...b, ids: b.ids.filter((i) => i !== wordId) } : b)));
}
