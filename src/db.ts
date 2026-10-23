import Dexie, { type EntityTable } from 'dexie';
import type { CardRow, DailyRow, KvRow, PackRow, ReviewRow, StoredWord } from './types';

export const db = new Dexie('junyoung-voca') as Dexie & {
  words: EntityTable<StoredWord, 'id'>;
  cards: EntityTable<CardRow, 'wordId'>;
  reviews: EntityTable<ReviewRow, 'id'>;
  daily: EntityTable<DailyRow, 'date'>;
  packs: EntityTable<PackRow, 'file'>;
  kv: EntityTable<KvRow, 'key'>;
};

db.version(1).stores({
  words: 'id, level, pack',
  cards: 'wordId, due, state',
  reviews: '++id, wordId, ts, studyDate',
  daily: 'date',
  packs: 'file',
  kv: 'key',
});
