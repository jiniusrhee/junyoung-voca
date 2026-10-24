import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/** 이름 있는 폴더 여러 개에 항목 id 를 담는 구조 (말해보카: 내 단어장, 문법 북마크). kv 키 하나에 폴더 배열로 저장 */
export interface FolderRow {
  id: string;
  name: string;
  /** 항목 id (최근 담은 것이 앞) */
  ids: string[];
  createdAt: number;
}

export const GRAMMAR_BOOKMARKS = 'gbookmarks';

async function save(key: string, rows: FolderRow[]): Promise<void> {
  await db.kv.put({ key, value: rows });
}

export async function getFolders(key: string): Promise<FolderRow[]> {
  return ((await db.kv.get(key))?.value as FolderRow[] | undefined) ?? [];
}

export function useFolders(key: string): FolderRow[] | undefined {
  return useLiveQuery(() => getFolders(key), [key]);
}

export async function createFolder(key: string, name: string): Promise<FolderRow> {
  const rows = await getFolders(key);
  const row: FolderRow = { id: `${key}-${Date.now()}`, name: name.trim() || `${rows.length + 1}. 북마크`, ids: [], createdAt: Date.now() };
  await save(key, [...rows, row]);
  return row;
}

export async function renameFolder(key: string, id: string, name: string): Promise<void> {
  const rows = await getFolders(key);
  await save(key, rows.map((r) => (r.id === id ? { ...r, name: name.trim() || r.name } : r)));
}

export async function deleteFolder(key: string, id: string): Promise<void> {
  await save(key, (await getFolders(key)).filter((r) => r.id !== id));
}

/** 어느 폴더에든 담긴 항목 id 집합 */
export async function folderItems(key: string): Promise<Set<string>> {
  return new Set((await getFolders(key)).flatMap((r) => r.ids));
}

/** 항목을 폴더에 넣거나 뺀다. folderId 가 없으면: 어딘가에 있으면 모두에서 빼고, 없으면 첫 폴더에 넣는다(없으면 '1. 북마크'를 만든다) */
export async function toggleInFolder(key: string, itemId: string, folderId?: string, defaultName = '1. 북마크'): Promise<boolean> {
  let rows = await getFolders(key);
  if (folderId) {
    const f = rows.find((x) => x.id === folderId);
    if (!f) return false;
    const has = f.ids.includes(itemId);
    await save(key, rows.map((x) => (x.id === folderId ? { ...x, ids: has ? x.ids.filter((i) => i !== itemId) : [itemId, ...x.ids] } : x)));
    return !has;
  }
  const has = rows.some((r) => r.ids.includes(itemId));
  if (has) {
    await save(key, rows.map((r) => ({ ...r, ids: r.ids.filter((i) => i !== itemId) })));
    return false;
  }
  if (!rows.length) {
    await createFolder(key, defaultName);
    rows = await getFolders(key);
  }
  await save(key, rows.map((r, i) => (i === 0 ? { ...r, ids: [itemId, ...r.ids] } : r)));
  return true;
}

export async function removeFromFolder(key: string, folderId: string, itemId: string): Promise<void> {
  const rows = await getFolders(key);
  await save(key, rows.map((r) => (r.id === folderId ? { ...r, ids: r.ids.filter((i) => i !== itemId) } : r)));
}
