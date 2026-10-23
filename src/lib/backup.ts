import { db } from '../db';
import type { CardRow, DailyRow, KvRow, ReviewRow } from '../types';
import { studyDateOf } from './time';

interface Backup {
  version: 1;
  exportedAt: string;
  cards: CardRow[];
  reviews: ReviewRow[];
  daily: DailyRow[];
  kv: KvRow[];
}

export async function exportBackup(): Promise<void> {
  const data: Backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    cards: await db.cards.toArray(),
    reviews: await db.reviews.toArray(),
    daily: await db.daily.toArray(),
    kv: await db.kv.toArray(),
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
  if (data.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
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
  await db.transaction('rw', db.cards, db.reviews, db.daily, db.kv, async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.daily.clear();
    await db.kv.clear();
    await db.cards.bulkAdd(cards);
    await db.reviews.bulkAdd(reviews);
    await db.daily.bulkAdd(daily);
    await db.kv.bulkAdd(kv);
  });
  return { cards: cards.length, reviews: reviews.length };
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.cards, db.reviews, db.daily, db.kv, async () => {
    await db.cards.clear();
    await db.reviews.clear();
    await db.daily.clear();
    await db.kv.clear();
  });
}
