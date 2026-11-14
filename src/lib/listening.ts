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
  /** 한국어 문장 위에 작게 보이는 상황 설명 (어휘 예문에서 온 것) */
  ctx?: string;
}

export type ListenResult = 'perfect' | 'great' | 'good' | 'nice';

export const RESULT_TEXT: Record<ListenResult, { title: string; sub: string }> = {
  perfect: { title: 'Perfect!!!', sub: '한 번 듣고 맞혔어요!' },
  great: { title: 'Great!!', sub: '두 번 듣고 맞혔어요!' },
  good: { title: 'Good!', sub: '세 번 듣고 맞혔어요!' },
  nice: { title: 'Nice Try', sub: '아쉽네요...' },
};

/**
 * listens = 들은 횟수 (처음 1번 + 다시 듣기 + 객관식 오답 때의 자동 재생).
 * 말해보카 플립 실측(2026-11-14): 1번 Perfect, 2번 Great, 3번 Good(추정). 다시 듣기를 다 써서 뜻이 보인 뒤(4번째)에는 끝까지 맞혀도 Nice Try, 정답 보기도 Nice Try.
 */
export function resultFor(listens: number, failed: boolean): ListenResult {
  if (failed || listens > MAX_LISTENS) return 'nice';
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

export interface ListenWord {
  /** 카드에 보이는 글자 (문장 부호 포함) */
  show: string;
  /** 비교용 (소문자, 문장 부호 없음, 아포스트로피는 남음) */
  key: string;
  /** 자판으로 칠 글자: 영문자만 (That's → thats, I'd → id — 말해보카 자판에는 아포스트로피가 없고 없이 쳐도 맞는다) */
  type: string;
  /** 보기 버튼의 글자: 문장 부호 없이, 문장 첫 낱말은 소문자로 (I 는 그대로) */
  btn: string;
}

/** 자판 입력 비교용: 영문자만 남긴다 */
export function typeKey(s: string): string {
  return s
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** 문장을 단어로 (표시용 원문, 비교용 정규화) */
export function listenWords(en: string): ListenWord[] {
  return en
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const bare = w.replace(/^["'(]+|[.,!?;:"')]+$/g, '');
      const lower = i === 0 && bare !== 'I' && !/^I'/.test(bare) ? bare.charAt(0).toLowerCase() + bare.slice(1) : bare;
      return { show: w, key: normalize(w.replace(/[.,!?;:"]/g, '')), type: typeKey(w), btn: lower };
    })
    .filter((w) => w.key);
}

/**
 * 객관식 보기의 순서 (말해보카 실측): 낱말을 앞에서부터 넷씩 묶어 묶음 안에서만 섞는다.
 * 처음 네 칸에는 첫 묶음이 놓이고, 맞힌 칸에는 이 순서의 다음 낱말이 들어온다 → 지금 맞혀야 할 낱말은 언제나 네 칸 안에 있다.
 */
export function mcOrder(n: number, rnd: () => number = Math.random): number[] {
  const out: number[] = [];
  for (let s = 0; s < n; s += 4) {
    const chunk = Array.from({ length: Math.min(4, n - s) }, (_, i) => s + i);
    for (let i = chunk.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [chunk[i], chunk[j]] = [chunk[j], chunk[i]];
    }
    out.push(...chunk);
  }
  return out;
}

/**
 * 카드 위 초록 막대가 찬 비율 (말해보카 실측: 9낱말 문장에서 낱말마다의 끝 x 를 잼).
 * 글자 수에 비례하고 맨 앞에 3.3글자만큼의 머리가 붙는다: (3.3 + 맞힌 글자 수) / (3.3 + 전체 글자 수).
 */
export function listenProgress(words: ListenWord[], done: number): number {
  if (done <= 0 || !words.length) return 0;
  if (done >= words.length) return 1;
  const len = (w: ListenWord) => Math.max(1, w.type.length);
  const total = words.reduce((a, w) => a + len(w), 0);
  const got = words.slice(0, done).reduce((a, w) => a + len(w), 0);
  return (3.3 + got) / (3.3 + total);
}

/**
 * 자판으로 친 글자가 지금 낱말(done 번째)부터 몇 낱말을 채우는가.
 * 한 낱말을 다 치는 순간 그 낱말이 카드로 올라간다(띄어쓰기는 필요 없다 — 말해보카 실측). 영문자가 없는 낱말(숫자 등)은 건너뛴다.
 */
export function typedMatch(words: ListenWord[], done: number, input: string): { take: number; rest: string } {
  let rest = typeKey(input);
  let take = 0;
  const skip = () => {
    while (words[done + take] && !words[done + take].type) take++;
  };
  skip();
  for (;;) {
    const w = words[done + take];
    if (!w || rest.length < w.type.length || !rest.startsWith(w.type)) break;
    rest = rest.slice(w.type.length);
    take++;
    skip();
  }
  return { take, rest };
}

/** 말로 답했을 때: 알아들은 낱말들이 지금 낱말부터 차례로 몇 개 맞는가 */
export function spokenMatch(words: ListenWord[], done: number, heard: string): number {
  const said = heard
    .split(/\s+/)
    .map(typeKey)
    .filter(Boolean);
  let take = 0;
  let k = 0;
  // 앞에서 이미 맞힌 낱말을 다시 말했으면 그만큼 건너뛴다
  const prev = words.slice(0, done).map((w) => w.type);
  while (k < said.length && k < prev.length && said[k] === prev[k]) k++;
  if (k < prev.length) k = 0;
  for (; k < said.length; k++) {
    let w = words[done + take];
    while (w && !w.type) {
      take++;
      w = words[done + take];
    }
    if (!w || said[k] !== w.type) break;
    take++;
  }
  return take;
}

/** 리스닝 문장 모음: 어휘 예문 + 문법 문장 */
export async function listenPool(): Promise<ListenItem[]> {
  const out: ListenItem[] = [];
  for (const w of await db.words.toArray()) {
    w.sentences.forEach((s, i) => {
      const en = fullSentence(s.en, s.answer);
      // 숫자가 든 문장은 뺀다: 자판에 숫자가 없고, 들리는 말(twenty)과 글자(20)가 달라 받아쓸 수 없다
      if (/[0-9]/.test(en)) return;
      out.push({ id: `v:${w.id}:${i}`, en, ko: s.ko.replace(/\*\*/g, ''), level: itemLevel(w.level, en.split(/\s+/).length), ctx: s.ctx });
    });
  }
  for (const s of await db.gsentences.toArray()) {
    if (/[0-9]/.test(s.en)) continue;
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
  /** list 를 주면 그 문장들만 순서대로 출제 (히스토리 학습) */
  constructor(
    public level: number,
    private list: string[] | null = null,
  ) {}

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
    if (this.list) {
      const id = this.list.shift();
      if (!id) return null;
      const item = this.byId.get(id);
      if (!item) return this.next(now);
      return { item, isNew: false, card: (await db.mcards.get(`listening:${id}`)) ?? null };
    }
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
