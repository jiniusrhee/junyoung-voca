import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { CardRow } from '../types';
import { addDays } from './time';

/** 처음 본 단어를 힌트 없이 바로 맞히면 '이미 아는 단어'로 보고 이만큼 뒤에 다시 확인 */
export const KNOWN_WORD_DAYS = 180;
/** 복습 단어를 이 시간 안에 맞히면 Easy */
export const FAST_ANSWER_MS = 4000;

const scheduler = fsrs(
  generatorParameters({
    enable_fuzz: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  }),
);

export interface Outcome {
  firstTry: boolean;
  hints: number;
  showedAnswer: boolean;
  wrongAttempts: number;
  elapsedMs: number;
}

/** 어떤 모드든 FSRS 카드 필드에 등급을 적용 */
export function scheduleFields<T extends Omit<Card, 'state'> & { state: number }>(row: T, grade: Grade, now: Date = new Date()): T {
  const { card } = scheduler.next({ ...row, state: row.state as State } as Card, now, grade);
  return { ...row, ...card };
}

export function emptyFields(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

export function newCardRow(wordId: string, now: Date = new Date()): CardRow {
  const c = createEmptyCard(now);
  return { wordId, ...c };
}

function toCard(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review,
  };
}

export function gradeOf(o: Outcome, row: CardRow): Grade {
  if (o.showedAnswer || o.wrongAttempts >= 2) return Rating.Again;
  if (o.hints > 0 || o.wrongAttempts === 1) return Rating.Hard;
  if (row.state === State.Review && o.elapsedMs < FAST_ANSWER_MS) return Rating.Easy;
  return Rating.Good;
}

export function isKnownOnFirstSight(row: CardRow, o: Outcome): boolean {
  return row.state === State.New && row.reps === 0 && o.firstTry && o.hints === 0 && !o.showedAnswer;
}

export function applyReview(
  row: CardRow,
  o: Outcome,
  now: Date = new Date(),
): { row: CardRow; grade: Grade; known: boolean } {
  const card = toCard(row);
  if (isKnownOnFirstSight(row, o)) {
    const { card: next } = scheduler.next(card, now, Rating.Easy);
    return {
      row: {
        ...row,
        ...next,
        due: addDays(now, KNOWN_WORD_DAYS),
        stability: Math.max(next.stability, KNOWN_WORD_DAYS),
        scheduled_days: KNOWN_WORD_DAYS,
        state: State.Review,
        learning_steps: 0,
        known: true,
      },
      grade: Rating.Easy,
      known: true,
    };
  }
  const grade = gradeOf(o, row);
  const { card: next } = scheduler.next(card, now, grade);
  return { row: { ...row, ...next, known: row.known ?? false }, grade, known: false };
}

/** 말해보카 학습 통계의 숙련도 4단계 */
export type Mastery = 'strong' | 'solid' | 'fresh' | 'shaky';

export const MASTERY_KO: Record<Mastery, string> = {
  strong: '매우 숙달된 단어',
  solid: '숙달된 단어',
  fresh: '아직 서툰 단어',
  shaky: '재학습 필요 단어',
};

export const MASTERY_ORDER: Mastery[] = ['strong', 'solid', 'fresh', 'shaky'];

export function masteryOf(row: CardRow): Mastery {
  if (row.known && row.lapses === 0) return 'strong';
  if (row.state === State.Review && row.stability >= 90) return 'strong';
  if (row.state === State.Review && row.stability >= 21) return 'solid';
  if (row.lapses >= 1) return 'shaky';
  return 'fresh';
}

export function isKnownOrSolid(row: CardRow): boolean {
  const m = masteryOf(row);
  return m === 'solid' || m === 'strong';
}
