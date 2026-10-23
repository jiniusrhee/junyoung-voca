import Dexie, { type EntityTable } from 'dexie';
import type { BookmarkRow, CardRow, DailyRow, ExprCourse, ExprItem, ExprPattern, FavoriteRow, GrammarSentence, GrammarTopic, KvRow, MCardRow, PackRow, ReviewRow, StoredWord, TalkStory } from './types';

export const db = new Dexie('junyoung-voca') as Dexie & {
  words: EntityTable<StoredWord, 'id'>;
  cards: EntityTable<CardRow, 'wordId'>;
  reviews: EntityTable<ReviewRow, 'id'>;
  daily: EntityTable<DailyRow, 'date'>;
  packs: EntityTable<PackRow, 'file'>;
  kv: EntityTable<KvRow, 'key'>;
  favorites: EntityTable<FavoriteRow, 'key'>;
  gtopics: EntityTable<GrammarTopic, 'id'>;
  gsentences: EntityTable<GrammarSentence, 'id'>;
  mcards: EntityTable<MCardRow, 'id'>;
  bookmarks: EntityTable<BookmarkRow, 'key'>;
  ecourses: EntityTable<ExprCourse, 'id'>;
  epatterns: EntityTable<ExprPattern, 'key'>;
  eitems: EntityTable<ExprItem, 'id'>;
  tstories: EntityTable<TalkStory, 'id'>;
};

db.version(1).stores({
  words: 'id, level, pack',
  cards: 'wordId, due, state',
  reviews: '++id, wordId, ts, studyDate',
  daily: 'date',
  packs: 'file',
  kv: 'key',
});

db.version(2).stores({
  favorites: 'key, wordId, ts',
});

db.version(4).stores({
  ecourses: 'id, order, pack',
  epatterns: 'key, course, order',
  eitems: 'id, course, pkey, order',
  tstories: 'id, category, order, pack',
});

db.version(3).stores({
  gtopics: 'id, levelNum, pack, order',
  gsentences: 'id, topic, levelNum, pack',
  mcards: 'id, mode, due, state, [mode+due], [mode+state]',
  bookmarks: 'key, mode, ts',
});
