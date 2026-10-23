import { db } from '../db';
import type { CardRow, ReviewRow, StoredWord } from '../types';
import { masteryOf } from './scheduler';
import { studyDateOf } from './time';

export type LearnedKind = 'daily' | 'recent' | 'most' | 'long' | 'known';
export const LEARNED_KINDS: { kind: LearnedKind; label: string }[] = [
  { kind: 'daily', label: '일별 학습 어휘' },
  { kind: 'recent', label: '최근에 잊어버린 어휘' },
  { kind: 'most', label: '역대 가장 많이 잊어버린 어휘' },
  { kind: 'long', label: '길게 기억했다 잊어버린 어휘' },
  { kind: 'known', label: '복습이 필요 없는 어휘' },
];

export interface LearnedRow {
  word: StoredWord;
  card?: CardRow;
  /** 그날(또는 최근)의 풀이 기록 */
  logs: ReviewRow[];
  note?: string;
}

const LIMIT = 30;
const isVocab = (r: ReviewRow) => !r.studyMode && !r.isTest;
export const fmtDate = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`;

async function hydrate(ids: string[], logs: ReviewRow[], notes?: Map<string, string>): Promise<LearnedRow[]> {
  const words = await db.words.bulkGet(ids);
  const cards = await db.cards.bulkGet(ids);
  const out: LearnedRow[] = [];
  ids.forEach((id, i) => {
    const w = words[i];
    if (w) out.push({ word: w, card: cards[i] ?? undefined, logs: logs.filter((l) => l.wordId === id), note: notes?.get(id) });
  });
  return out;
}

/** 그날 학습한 단어 (푼 순서) */
export async function dailyWords(date: string): Promise<LearnedRow[]> {
  const logs = (await db.reviews.where('studyDate').equals(date).filter(isVocab).toArray()).sort((a, b) => a.ts - b.ts);
  return hydrate([...new Set(logs.map((l) => l.wordId))], logs);
}

/** 최근에 잊어버린 어휘: 복습에서 틀린 순서대로 */
export async function recentLapses(): Promise<LearnedRow[]> {
  const logs = await db.reviews
    .orderBy('ts')
    .reverse()
    .filter((r) => isVocab(r) && !r.isNew && r.rating === 1)
    .limit(400)
    .toArray();
  const ids = [...new Set(logs.map((l) => l.wordId))].slice(0, LIMIT);
  const notes = new Map(ids.map((id) => [id, `${fmtDate(logs.find((l) => l.wordId === id)!.studyDate)} 잊음`]));
  return hydrate(ids, logs, notes);
}

/** 역대 가장 많이 잊어버린 어휘 */
export async function mostLapses(): Promise<LearnedRow[]> {
  const cards = (await db.cards.filter((c) => c.lapses >= 1).toArray()).sort((a, b) => b.lapses - a.lapses).slice(0, LIMIT);
  return hydrate(
    cards.map((c) => c.wordId),
    [],
    new Map(cards.map((c) => [c.wordId, `${c.lapses}번 잊음`])),
  );
}

/** 21일 이상 기억하다가 잊어버린 어휘 */
export async function longThenForgot(): Promise<LearnedRow[]> {
  const logs = (await db.reviews.filter(isVocab).toArray()).sort((a, b) => a.ts - b.ts);
  const last = new Map<string, number>();
  const hits: { id: string; gap: number; ts: number }[] = [];
  for (const l of logs) {
    const p = last.get(l.wordId);
    if (p != null && l.rating === 1 && !l.isNew) {
      const gap = (l.ts - p) / 86_400_000;
      if (gap >= 21) hits.push({ id: l.wordId, gap, ts: l.ts });
    }
    last.set(l.wordId, l.ts);
  }
  hits.sort((a, b) => b.ts - a.ts);
  const ids: string[] = [];
  const notes = new Map<string, string>();
  for (const h of hits) {
    if (notes.has(h.id)) continue;
    ids.push(h.id);
    notes.set(h.id, `${Math.round(h.gap)}일 기억하다 잊음`);
    if (ids.length >= LIMIT) break;
  }
  return hydrate(ids, [], notes);
}

/** 복습이 필요 없는 어휘: 매우 숙달된 단어 */
export async function noReviewNeeded(): Promise<LearnedRow[]> {
  const cards = (await db.cards.toArray()).filter((c) => masteryOf(c) === 'strong').sort((a, b) => (b.last_review?.getTime() ?? 0) - (a.last_review?.getTime() ?? 0));
  return hydrate(
    cards.map((c) => c.wordId),
    [],
  );
}

export function learnedList(kind: LearnedKind, date = studyDateOf()): Promise<LearnedRow[]> {
  switch (kind) {
    case 'daily':
      return dailyWords(date);
    case 'recent':
      return recentLapses();
    case 'most':
      return mostLapses();
    case 'long':
      return longThenForgot();
    default:
      return noReviewNeeded();
  }
}

export async function learnedCounts(): Promise<Record<LearnedKind, number>> {
  const [daily, recent, most, long, known] = await Promise.all([dailyWords(studyDateOf()), recentLapses(), mostLapses(), longThenForgot(), noReviewNeeded()]);
  return { daily: daily.length, recent: recent.length, most: most.length, long: long.length, known: known.length };
}

/** 풀이 기록 한 줄 */
export function logText(l: ReviewRow): string {
  if (l.showedAnswer) return '정답 보기';
  if (l.firstTry && l.hints === 0) return '한 번에 정답';
  if (l.firstTry) return `힌트 ${l.hints}번`;
  return `오답 ${l.wrongAttempts}번`;
}
