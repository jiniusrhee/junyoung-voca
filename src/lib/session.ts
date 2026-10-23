import { State } from 'ts-fsrs';
import { db } from '../db';
import type { CardRow, Settings, StoredWord } from '../types';
import { LEVEL_TEST_QUESTIONS, MAX_LEVEL, MIN_LEVEL, finalLevelFrom, newWordRange, nextTestLevel, type TestRecord } from './levelLogic';

export interface Question {
  word: StoredWord;
  sentenceIdx: number;
  isNew: boolean;
  card: CardRow | null;
}

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const byDue = (a: CardRow, b: CardRow) => a.due.getTime() - b.due.getTime();

/**
 * 오늘의 학습 출제 순서:
 * 1) 학습 단계(1분/10분)에서 돌아온 카드  2) 복습 기한이 된 카드와 새 단어를 2:1로 섞기
 * 3) 둘 다 없으면 아직 기한이 안 된 학습 단계 카드를 조금 일찍 당겨서 출제
 */
export class StudyPicker {
  private cardIds = new Set<string>();
  private recent: string[] = [];
  private reviewStreak = 0;

  constructor(
    private level: number,
    private difficulty: Settings['newWordDifficulty'],
  ) {}

  async init(): Promise<void> {
    const keys = (await db.cards.toCollection().primaryKeys()) as string[];
    this.cardIds = new Set(keys);
  }

  setLevel(level: number): void {
    this.level = level;
  }

  noteAnswered(wordId: string): void {
    this.cardIds.add(wordId);
    this.recent.push(wordId);
    if (this.recent.length > 2) this.recent.shift();
  }

  async next(now: Date = new Date()): Promise<Question | null> {
    const due = (await db.cards.where('due').belowOrEqual(now).toArray())
      .filter((c) => !this.recent.includes(c.wordId))
      .sort(byDue);
    const learning = due.filter((c) => c.state === State.Learning || c.state === State.Relearning);
    if (learning.length) return this.review(learning[0]);

    const reviews = due.filter((c) => c.state === State.Review);
    const fresh = await this.pickNew();
    if (reviews.length && (this.reviewStreak < 2 || !fresh)) {
      this.reviewStreak++;
      return this.review(reviews[0]);
    }
    if (fresh) {
      this.reviewStreak = 0;
      return fresh;
    }
    if (reviews.length) return this.review(reviews[0]);

    const pending = (await db.cards.where('state').anyOf([State.Learning, State.Relearning]).toArray())
      .filter((c) => !this.recent.includes(c.wordId))
      .sort(byDue);
    if (pending.length) return this.review(pending[0]);
    return null;
  }

  private async review(card: CardRow): Promise<Question | null> {
    const word = await db.words.get(card.wordId);
    if (!word) {
      // 팩에서 삭제된 단어의 카드가 남아 있으면 정리
      await db.cards.delete(card.wordId);
      this.cardIds.delete(card.wordId);
      return this.next();
    }
    const n = Math.max(1, word.sentences.length);
    return { word, sentenceIdx: card.reps % n, isNew: false, card };
  }

  private async pickNew(): Promise<Question | null> {
    const book = ((await db.kv.get('wordbook'))?.value as string[] | undefined) ?? [];
    for (const id of [...book].reverse()) {
      if (this.cardIds.has(id)) continue;
      const w = await db.words.get(id);
      if (w) return { word: w, sentenceIdx: 0, isNew: true, card: null };
    }
    const [lo, hi] = newWordRange(this.level, this.difficulty);
    for (let widen = 0; widen < MAX_LEVEL; widen++) {
      const from = Math.max(MIN_LEVEL, lo - widen);
      const to = Math.min(MAX_LEVEL, hi + widen);
      const cands = (await db.words.where('level').between(from, to, true, true).toArray()).filter(
        (w) => !this.cardIds.has(w.id),
      );
      if (cands.length) return { word: pickRandom(cands), sentenceIdx: 0, isNew: true, card: null };
      if (from === MIN_LEVEL && to === MAX_LEVEL) break;
    }
    return null;
  }
}

/** 첫 실행 레벨 테스트: 맞히면 올라가고 틀리면 내려가는 적응형 20문제 */
export class LevelTest {
  level = 10;
  asked = 0;
  private history: TestRecord[] = [];
  private used = new Set<string>();
  private cardIds = new Set<string>();

  get done(): boolean {
    return this.asked >= LEVEL_TEST_QUESTIONS;
  }

  async init(): Promise<void> {
    this.cardIds = new Set((await db.cards.toCollection().primaryKeys()) as string[]);
  }

  async pick(): Promise<Question | null> {
    for (let d = 0; d < MAX_LEVEL; d++) {
      const levels = d === 0 ? [this.level] : [this.level - d, this.level + d];
      for (const lvl of levels) {
        if (lvl < MIN_LEVEL || lvl > MAX_LEVEL) continue;
        const cands = (await db.words.where('level').equals(lvl).toArray()).filter(
          (w) => !this.used.has(w.id) && !this.cardIds.has(w.id),
        );
        if (cands.length) {
          const w = pickRandom(cands);
          this.used.add(w.id);
          return { word: w, sentenceIdx: 0, isNew: true, card: null };
        }
      }
    }
    return null;
  }

  record(correct: boolean): void {
    this.history.push({ level: this.level, correct });
    this.asked += 1;
    this.level = nextTestLevel(this.level, this.asked, correct);
  }

  finalLevel(): number {
    return finalLevelFrom(this.history);
  }
}
