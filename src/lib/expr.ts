import { db } from '../db';
import type { ExprItem, MCardRow } from '../types';
import { levenshtein, normalize } from './text';

export interface ExprQuestion {
  item: ExprItem;
  isNew: boolean;
  card: MCardRow | null;
}

export type ExprEval =
  | { kind: 'correct' }
  | { kind: 'alt'; tone: 'green' | 'yellow' | 'red'; msg: string; bonus: boolean }
  | { kind: 'typo' }
  | { kind: 'wrong' };

const TONE = { ok: 'green', near: 'yellow', wrong: 'red' } as const;

export function evalExpr(input: string, item: ExprItem): ExprEval {
  const i = normalize(input);
  const a = normalize(item.answer);
  if (!i) return { kind: 'wrong' };
  if (i === a) return { kind: 'correct' };
  const alt = item.alts?.find((x) => normalize(x.w) === i);
  if (alt) return { kind: 'alt', tone: TONE[alt.t], msg: alt.m, bonus: alt.t === 'ok' };
  if (levenshtein(i, a) <= (a.length >= 10 ? 2 : 1)) return { kind: 'typo' };
  return { kind: 'wrong' };
}

/** 입력한 단어가 정답 단어와 같은지 칸별로 */
export function wordMatches(input: string, answer: string): boolean[] {
  const a = answer.trim().split(/\s+/).map((w) => normalize(w));
  const t = input.replace(/^\s+/, '').split(' ');
  return a.map((w, k) => !!t[k] && normalize(t[k]) === w);
}

/** 힌트: 각 단어의 첫 글자 */
export function exprHint(answer: string): string {
  return answer
    .split(/\s+/)
    .map((w) => w[0] + '_'.repeat(Math.max(0, w.length - 1)))
    .join(' ');
}

/** 표현 출제: 복습 기한이 된 문제 먼저(2:1), 새 문제는 코스 순서대로 */
export class ExprPicker {
  private seen = new Set<string>();
  private recent: string[] = [];
  private streak = 0;
  constructor(private course: string) {}

  async init() {
    this.seen = new Set((await db.mcards.where('mode').equals('expr').toArray()).map((c) => c.itemId));
  }

  note(id: string) {
    this.seen.add(id);
    this.recent.push(id);
    if (this.recent.length > 2) this.recent.shift();
  }

  async next(now: Date = new Date()): Promise<ExprQuestion | null> {
    const due = (await db.mcards.where('[mode+due]').between(['expr', new Date(0)], ['expr', now], true, true).toArray()).filter(
      (c) => !this.recent.includes(c.itemId),
    );
    const fresh = await this.pickNew();
    if (due.length && (this.streak < 2 || !fresh)) {
      this.streak++;
      const item = await db.eitems.get(due[0].itemId);
      if (item) return { item, isNew: false, card: due[0] };
      await db.mcards.delete(due[0].id);
      return this.next(now);
    }
    if (fresh) {
      this.streak = 0;
      return { item: fresh, isNew: true, card: null };
    }
    return null;
  }

  private async pickNew(): Promise<ExprItem | null> {
    const courses = await db.ecourses.orderBy('order').toArray();
    const ordered = [this.course, ...courses.map((c) => c.id).filter((c) => c !== this.course)];
    for (const c of ordered) {
      const items = (await db.eitems.where('course').equals(c).sortBy('order')).filter((it) => !this.seen.has(it.id) && !this.recent.includes(it.id));
      if (items.length) return items[0];
    }
    return null;
  }
}

/** 코스 진행률: 학습한 문제 / 전체 */
export async function courseProgress(): Promise<Map<string, { done: number; total: number }>> {
  const seen = new Set((await db.mcards.where('mode').equals('expr').toArray()).map((c) => c.itemId));
  const out = new Map<string, { done: number; total: number }>();
  for (const it of await db.eitems.toArray()) {
    const p = out.get(it.course) ?? { done: 0, total: 0 };
    p.total += 1;
    if (seen.has(it.id)) p.done += 1;
    out.set(it.course, p);
  }
  return out;
}
