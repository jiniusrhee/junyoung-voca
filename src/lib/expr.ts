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

/** 비교용: 소문자 · 문장 부호 없음 · 아포스트로피도 없음 (말해보카 자판은 thats 라고 쳐도 That's 로 받는다) */
export function bare(s: string): string {
  return normalize(s).replace(/'/g, '');
}

/**
 * 낱말 칸 · 말풍선에 보일 글자: 지금까지 친 글자가 정답 낱말의 앞부분과 같으면 정답의 꼴(대문자 · 아포스트로피)로 보여 준다.
 * thats → That's, tha → Tha. 다르면 친 그대로.
 */
export function shownWord(typed: string, target: string): string {
  const t = bare(typed);
  if (!t || !target) return typed;
  let n = 0;
  let cut = 0;
  for (; cut < target.length && n < t.length; cut++) if (/[a-z0-9]/i.test(target[cut])) n++;
  const head = target.slice(0, cut);
  return bare(head) === t ? head : typed;
}

export function evalExpr(input: string, item: ExprItem): ExprEval {
  const i = bare(input);
  const a = bare(item.answer);
  if (!i) return { kind: 'wrong' };
  if (i === a) return { kind: 'correct' };
  const alt = item.alts?.find((x) => bare(x.w) === i);
  if (alt) return { kind: 'alt', tone: TONE[alt.t], msg: alt.m, bonus: alt.t === 'ok' };
  if (levenshtein(i, a) <= (a.length >= 10 ? 2 : 1)) return { kind: 'typo' };
  return { kind: 'wrong' };
}

/** 입력한 단어가 정답 단어와 같은지 칸별로 */
export function wordMatches(input: string, answer: string): boolean[] {
  const a = answer.trim().split(/\s+/).map((w) => bare(w));
  const t = input.replace(/^\s+/, '').split(' ');
  return a.map((w, k) => !!t[k] && bare(t[k]) === w);
}

/**
 * 힌트 보기로 채워 주는 글자: 첫 낱말의 앞 2글자 (말해보카 플립 실측: What → Wh, Is → Is — 어휘의 힌트와 같은 '앞 2글자').
 * 두 글자로 낱말이 끝나면 띄어쓰기까지 붙여 다음 칸으로 넘어간다('Is ').
 */
export function exprPrefix(answer: string): string {
  const w = answer.trim().split(/\s+/)[0] ?? '';
  const head = w.slice(0, 2);
  return head.length >= w.length && answer.trim().includes(' ') ? `${head} ` : head;
}

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
  /** list 를 주면 그 문장들만 순서대로 출제 (히스토리 학습) */
  constructor(
    private course: string,
    private list: string[] | null = null,
  ) {}

  async init() {
    this.seen = new Set((await db.mcards.where('mode').equals('expr').toArray()).map((c) => c.itemId));
  }

  note(id: string) {
    this.seen.add(id);
    this.recent.push(id);
    if (this.recent.length > 2) this.recent.shift();
  }

  async next(now: Date = new Date()): Promise<ExprQuestion | null> {
    if (this.list) {
      const id = this.list.shift();
      if (!id) return null;
      const item = await db.eitems.get(id);
      if (!item) return this.next(now);
      return { item, isNew: false, card: (await db.mcards.get(`expr:${id}`)) ?? null };
    }
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
