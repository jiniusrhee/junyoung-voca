import { db } from '../db';
import type { CardRow, DailyRow, FavoriteRow, KvRow, ReviewRow } from '../types';
import { studyDateOf } from './time';

interface Backup {
  version: 1 | 2;
  exportedAt: string;
  cards: CardRow[];
  reviews: ReviewRow[];
  daily: DailyRow[];
  kv: KvRow[];
  favorites?: FavoriteRow[];
}

export async function exportBackup(): Promise<void> {
  const data: Backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    daily: await db.daily.toArray(),
    kv: await db.kv.toArray(),
    favorites: await db.favorites.toArray(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `junyoung-voca-backup-${studyDateOf()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export async function importBackup(file: File): Promise<{ cards: number; reviews: number }> {
  const data = JSON.parse(await file.text()) as Partial<Backup>;
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    throw new Error('지원하지 않는 백업 파일');
  }
  const cards = data.cards.map((c) => ({
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  }));
  const reviews = data.reviews;
  const daily = data.daily ?? [];
  const kv = data.kv ?? [];
  const favorites = data.favorites ?? [];
  await db.transaction('rw', [db.cards, db.reviews, db.daily, db.kv, db.favorites], async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.daily.clear(), db.kv.clear(), db.favorites.clear()]);
    await db.cards.bulkAdd(cards);
    await db.reviews.bulkAdd(reviews);
    await db.daily.bulkAdd(daily);
    await db.kv.bulkAdd(kv);
    await db.favorites.bulkAdd(favorites);
  });
  return { cards: cards.length, reviews: reviews.length };
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviews, db.daily, db.kv, db.favorites], async () => {
    await Promise.all([db.cards.clear(), db.reviews.clear(), db.daily.clear(), db.kv.clear(), db.favorites.clear()]);
  });
}
