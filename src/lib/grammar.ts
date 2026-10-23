import { db } from '../db';
import type { GrammarSentence, MCardRow } from '../types';
import { cardId } from './modeStudy';

export interface Tokenized {
  tokens: string[];
  end: string;
}

export function tokenize(en: string): Tokenized {
  const m = en.trim().match(/^(.*?)([.?!])$/);
  if (!m) return { tokens: en.trim().split(/\s+/), end: '' };
  return { tokens: m[1].trim().split(/\s+/), end: m[2] };
}

export interface WordCard {
  id: number;
  text: string;
}

const isProperish = (w: string, first: boolean) => w === 'I' || /^I'/.test(w) || (!first && /^[A-Z]/.test(w));

/** 카드 글자: 문장 첫 단어는 소문자로 (I, 고유명사 제외), 알파벳순 정렬 */
export function buildCards(s: GrammarSentence): WordCard[] {
  const { tokens } = tokenize(s.en);
  const texts = tokens.map((w, i) => {
    if (i === 0 && !isProperish(w, true) && !keepFirstCap(w, s)) return w.charAt(0).toLowerCase() + w.slice(1);
    return w;
  });
  const all = [...texts, ...s.distractors];
  return all
    .map((text) => ({ text }))
    .sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()) || a.text.localeCompare(b.text))
    .map((c, i) => ({ id: i, text: c.text }));
}

/** 첫 단어가 고유명사인지: 같은 단어가 문장 중간에서도 대문자로 나오거나, 흔한 소문자 단어가 아니면 유지 */
function keepFirstCap(w: string, s: GrammarSentence): boolean {
  const rest = tokenize(s.en).tokens.slice(1);
  if (rest.includes(w)) return true;
  return /^[A-Z][a-z]+$/.test(w) && PROPER_FIRST.has(w);
}
const PROPER_FIRST = new Set(['Tom', 'Jane', 'Mina', 'Jisu', 'Minho', 'Seoul', 'Korea', 'Paris', 'London', 'John', 'Mary', 'Sarah', 'David', 'Emma', 'Jake', 'Busan', 'Japan', 'America', 'Mike', 'Anna', 'Chris', 'Kevin', 'Lisa', 'Sam', 'Ben', 'Amy', 'Alex', 'Jenny', 'Peter', 'Tony', 'Eric', 'Sora', 'Yuna', 'Junho']);

/** 화면 표시용: 답 줄의 첫 단어는 대문자로 */
export function displayAnswer(words: string[]): string[] {
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w));
}

export type Mark = 'wrong' | 'swap' | null;

export interface GrammarCheck {
  status: 'correct' | 'extra' | 'missing' | 'order' | 'empty';
  /** 정답이 된 문장 (모범답안 또는 복수정답) */
  matched?: string;
  marks: Mark[];
  /** ⊕ 표시할 카드 id */
  plus: number[];
  message: string;
}

const norm = (w: string) => w.toLowerCase();

function multisetDiff(a: string[], b: string[]): string[] {
  const pool = b.map(norm);
  const out: string[] = [];
  for (const w of a) {
    const i = pool.indexOf(norm(w));
    if (i >= 0) pool.splice(i, 1);
    else out.push(w);
  }
  return out;
}

/** 사용자가 고른 카드 순서를 정답들과 비교 */
export function checkGrammar(s: GrammarSentence, picked: WordCard[], cards: WordCard[]): GrammarCheck {
  const user = picked.map((c) => c.text);
  if (!user.length) return { status: 'empty', marks: [], plus: [], message: '' };
  const candidates = [s.en, ...(s.alts ?? []).map((a) => a.en)];
  for (const en of candidates) {
    const t = tokenize(en).tokens;
    if (t.length === user.length && t.every((w, i) => norm(w) === norm(user[i]))) {
      return { status: 'correct', matched: en, marks: user.map(() => null), plus: [], message: '' };
    }
  }
  // 가장 가까운 정답 기준으로 피드백
  let best = tokenize(s.en).tokens;
  let bestScore = Infinity;
  for (const en of candidates) {
    const t = tokenize(en).tokens;
    const score = multisetDiff(user, t).length * 2 + multisetDiff(t, user).length;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  const extra = multisetDiff(user, best);
  const missing = multisetDiff(best, user);
  const unused = cards.filter((c) => !picked.some((p) => p.id === c.id));
  const plus: number[] = [];
  for (const w of missing) {
    const c = unused.find((u) => norm(u.text) === norm(w) && !plus.includes(u.id));
    if (c) plus.push(c.id);
  }
  if (extra.length) {
    const pool = [...extra.map(norm)];
    const marks: Mark[] = user.map((w) => {
      const i = pool.indexOf(norm(w));
      if (i >= 0) {
        pool.splice(i, 1);
        return 'wrong';
      }
      return null;
    });
    return { status: 'extra', marks, plus, message: '표시된 단어들을 옮겨서 문장을 다시 만들어 보세요.' };
  }
  if (missing.length) {
    return {
      status: 'missing',
      marks: user.map(() => null),
      plus,
      message: `아래 보기에서 ${missing.length}개 단어를 더 사용해서 문장을 완성해 보세요.`,
    };
  }
  const marks: Mark[] = user.map((w, i) => (norm(w) === norm(best[i]) ? null : 'swap'));
  return { status: 'order', marks, plus: [], message: '단어의 순서를 바꿔보세요.' };
}

/** 정답 문장 속 다른 단어를 빨간색으로 보여주기 위해, 모범답안과 다른 위치 */
export function diffWords(base: string, other: string): { w: string; diff: boolean }[] {
  const a = tokenize(base).tokens.map(norm);
  const b = tokenize(other);
  return b.tokens.map((w, i) => ({ w: i === b.tokens.length - 1 ? w + b.end : w, diff: a[i] !== norm(w) }));
}

export interface GrammarQuestion {
  s: GrammarSentence;
  isNew: boolean;
  card: MCardRow | null;
}

/** 문법 출제: 복습 기한이 된 문장 먼저(2:1), 새 문장은 내 문법 레벨 주변 주제 순서대로 */
export class GrammarPicker {
  private seen = new Set<string>();
  private recent: string[] = [];
  private streak = 0;
  constructor(private level: number) {}

  async init() {
    const ids = (await db.mcards.where('mode').equals('grammar').toArray()).map((c) => c.itemId);
    this.seen = new Set(ids);
  }

  note(id: string) {
    this.seen.add(id);
    this.recent.push(id);
    if (this.recent.length > 2) this.recent.shift();
  }

  async counts(now: Date = new Date()) {
    const due = await db.mcards.where('[mode+due]').between(['grammar', new Date(0)], ['grammar', now], true, true).count();
    const total = await db.gsentences.count();
    return { due, fresh: Math.max(0, total - this.seen.size) };
  }

  async next(now: Date = new Date()): Promise<GrammarQuestion | null> {
    const due = (await db.mcards.where('[mode+due]').between(['grammar', new Date(0)], ['grammar', now], true, true).toArray()).filter(
      (c) => !this.recent.includes(c.itemId),
    );
    const fresh = await this.pickNew();
    if (due.length && (this.streak < 2 || !fresh)) {
      this.streak++;
      const c = due[0];
      const s = await db.gsentences.get(c.itemId);
      if (s) return { s, isNew: false, card: c };
      await db.mcards.delete(c.id);
      return this.next(now);
    }
    if (fresh) {
      this.streak = 0;
      return fresh;
    }
    return null;
  }

  private async pickNew(): Promise<GrammarQuestion | null> {
    const topics = await db.gtopics.orderBy('order').toArray();
    const near = [...topics].sort((a, b) => Math.abs(a.levelNum - this.level) - Math.abs(b.levelNum - this.level) || a.order - b.order);
    for (const t of near) {
      const list = (await db.gsentences.where('topic').equals(t.id).toArray()).filter((s) => !this.seen.has(s.id));
      if (list.length) {
        list.sort((a, b) => a.id.localeCompare(b.id));
        return { s: list[0], isNew: true, card: null };
      }
    }
    return null;
  }
}

export async function grammarCard(itemId: string) {
  return db.mcards.get(cardId('grammar', itemId));
}
