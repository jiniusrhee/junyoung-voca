import { db } from '../db';
import type { ImportedProgress, Settings } from '../types';
import { knownCardRow } from './scheduler';
import { saveSettings } from './settings';
import { shiftDate } from './time';

const KEY = 'imported';

/** 말해보카에서 옮겨온 기록 */
export async function getImported(): Promise<ImportedProgress | null> {
  return ((await db.kv.get(KEY))?.value as ImportedProgress | undefined) ?? null;
}

export interface DayRange {
  from: string;
  to: string;
}

/** 들여온 연속 학습 구간 */
export function importedRange(p: ImportedProgress | null | undefined): DayRange | null {
  if (!p?.streak || p.streak.days <= 0) return null;
  return { from: shiftDate(p.streak.asOf, -(p.streak.days - 1)), to: p.streak.asOf };
}

export function inRange(r: DayRange | null | undefined, date: string): boolean {
  return !!r && date >= r.from && date <= r.to;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z' -]/g, '').trim();

/** 들여온 '학습한 단어' 중 이 앱에 있는 단어를 아는 단어 카드로 만든다 (이미 카드가 있으면 건드리지 않음) */
export async function applyImportedKnown(p?: ImportedProgress | null): Promise<number> {
  const data = p ?? (await getImported());
  if (!data?.learnedWords?.length) return 0;
  const known = new Set(data.learnedWords.map(norm));
  const words = await db.words.toArray();
  const have = new Set((await db.cards.toCollection().primaryKeys()) as string[]);
  const now = new Date();
  const rows = words.filter((w) => !have.has(w.id) && known.has(norm(w.word))).map((w) => knownCardRow(w.id, now));
  if (rows.length) await db.cards.bulkAdd(rows);
  return rows.length;
}

/** 새 progress.json 을 받았을 때 한 번 적용: 레벨, 아는 단어 */
export async function applyImported(data: ImportedProgress): Promise<void> {
  await db.kv.put({ key: KEY, value: data });
  const patch: Partial<Settings> = {};
  if (data.levels?.vocab) patch.level = data.levels.vocab;
  if (data.levels?.grammar) patch.grammarLevel = data.levels.grammar;
  if (data.levels?.listening) {
    patch.listeningLevel = data.levels.listening;
    const best = ((await db.kv.get('listeningBest'))?.value as number | undefined) ?? 0;
    if (data.levels.listening > best) await db.kv.put({ key: 'listeningBest', value: data.levels.listening });
  }
  if (Object.keys(patch).length) await saveSettings(patch);
  if (data.repairPens != null && (await db.kv.get('repairPens')) == null) await db.kv.put({ key: 'repairPens', value: data.repairPens });
  await applyImportedKnown(data);
}
