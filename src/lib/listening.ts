import { db } from '../db';
import type { MCardRow } from '../types';
import { fullSentence, normalize } from './text';

export const LISTEN_MAX = 50;
export const MAX_LISTENS = 3;

export interface ListenItem {
  id: string;
  en: string;
  ko: string;
  level: number;
}

export type ListenResult = 'perfect' | 'great' | 'good' | 'nice';

export const RESULT_TEXT: Record<ListenResult, { title: string; sub: string }> = {
  perfect: { title: 'Perfect!!', sub: '한번에 맞혔어요!' },
  great: { title: 'Great!!', sub: '두번 듣고 맞혔어요!' },
  good: { title: 'Good!', sub: '세번 듣고 맞혔어요!' },
  nice: { title: 'Nice Try', sub: '아쉽네요...' },
};

export function resultFor(listens: number, failed: boolean, hadWrong = false): ListenResult {
  if (failed) return 'nice';
  if (hadWrong) return 'good';
  if (listens <= 1) return 'perfect';
  if (listens === 2) return 'great';
  return 'good';
}

/** Perfect +2, Great 그대로, Good·Nice try -3 */
export function nextListenLevel(level: number, r: ListenResult): number {
  const d = r === 'perfect' ? 2 : r === 'great' ? 0 : -3;
  return Math.min(LISTEN_MAX, Math.max(1, level + d));
}

export function itemLevel(baseLevel30: number, words: number): number {
  return Math.min(LISTEN_MAX, Math.max(1, Math.round(baseLevel30 * 1.4 + (words - 6) * 1.2)));
}

/** 문장을 단어로 (표시용 원문, 비교용 정규화) */
export function listenWords(en: string): { show: string; key: string }[] {
  return en
    .trim()
    .split(/\s+/)
    .map((w) => ({ show: w, key: normalize(w.replace(/[.,!?;:"]/g, '')) }))
    .filter((w) => w.key);
}

/** 리스닝 문장 모음: 어휘 예문 + 문법 문장 */
export async function listenPool(): Promise<ListenItem[]> {
  const out: ListenItem[] = [];
  for (const w of await db.words.toArray()) {
    w.sentences.forEach((s, i) => {
      const en = fullSentence(s.en, s.answer);
      out.push({ id: `v:${w.id}:${i}`, en, ko: s.ko.replace(/\*\*/g, ''), level: itemLevel(w.level, en.split(/\s+/).length) });
    });
  }
  for (const s of await db.gsentences.toArray()) {
    out.push({ id: `g:${s.id}`, en: s.en, ko: s.ko, level: itemLevel(s.levelNum, s.en.split(/\s+/).length) });
  }
  return out;
}

export interface ListenQuestion {
  item: ListenItem;
  isNew: boolean;
  card: MCardRow | null;
}

export class ListenPicker {
  private pool: ListenItem[] = [];
  private byId = new Map<string, ListenItem>();
  private seen = new Set<string>();
  private recent: string[] = [];
  private streak = 0;
  constructor(public level: number) {}

  async init() {
    this.pool = await listenPool();
    this.byId = new Map(this.pool.map((p) => [p.id, p]));
    this.seen = new Set((await db.mcards.where('mode').equals('listening').toArray()).map((c) => c.itemId));
  }

  note(id: string) {
    this.seen.add(id);
    this.recent.push(id);
    if (this.recent.length > 3) this.recent.shift();
  }

  async counts(now: Date = new Date()) {
    const due = await db.mcards.where('[mode+due]').between(['listening', new Date(0)], ['listening', now], true, true).count();
    return { due, fresh: Math.max(0, this.pool.length - this.seen.size) };
  }

  async next(now: Date = new Date()): Promise<ListenQuestion | null> {
    const due = (await db.mcards.where('[mode+due]').between(['listening', new Date(0)], ['listening', now], true, true).toArray()).filter(
      (c) => !this.recent.includes(c.itemId) && this.byId.has(c.itemId),
    );
    const fresh = this.pickNew();
    if (due.length && (this.streak < 2 || !fresh)) {
      this.streak++;
      return { item: this.byId.get(due[0].itemId)!, isNew: false, card: due[0] };
    }
    if (fresh) {
      this.streak = 0;
      return { item: fresh, isNew: true, card: null };
    }
    return null;
  }

  private pickNew(): ListenItem | null {
    const unseen = this.pool.filter((p) => !this.seen.has(p.id) && !this.recent.includes(p.id));
    for (let w = 2; w <= LISTEN_MAX; w += 2) {
      const c = unseen.filter((p) => Math.abs(p.level - this.level) <= w);
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    return null;
  }
}
