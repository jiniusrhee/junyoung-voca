import { Rating, State, type Grade } from 'ts-fsrs';
import { db } from '../db';
import { computeStreak, grantRepairPen } from './stats';
import type { MCardRow, ModeDay, StudyMode, WrongNote } from '../types';
import { emptyFields, scheduleFields } from './scheduler';
import { studyDateOf } from './time';

export const emptyDay = (): ModeDay => ({ total: 0, newItems: 0, reviews: 0, correct: 0, timeMs: 0 });

export function cardId(mode: StudyMode, itemId: string): string {
  return `${mode}:${itemId}`;
}

export function newMCard(mode: StudyMode, itemId: string, now: Date = new Date()): MCardRow {
  return { id: cardId(mode, itemId), mode, itemId, ...emptyFields(now) };
}

export interface ModeOutcome {
  /** 리스닝: 다시 듣기 횟수(Perfect/Great/Good 구분용) */
  hints?: number;
  /** 실수 없이 한 번에 */
  clean: boolean;
  /** 틀린 횟수 */
  wrong: number;
  /** 정답 보기를 눌렀거나 끝내 못 맞힘 */
  failed: boolean;
  elapsedMs: number;
  wrongs?: WrongNote[];
  /** 목표 진행 수에 쳐 줄지 (기본: 쳐 준다). 문법은 한 번에 맞힌 문제만 */
  counts?: boolean;
  /**
   * 처음 본 문제를 한 번에 맞혔을 때 다음 복습까지의 날수 (어휘의 KNOWN_WORD_DAYS 와 같은 규칙).
   * 말해보카 문법 실측(2026-11-14): 새 문장을 한 번에 맞히면 '4개월 뒤 복습'.
   */
  firstCleanDays?: number;
}

/** 그날 그 모드에서 목표에 쳐 주는 수 */
export function modeSolved(m: ModeDay | undefined): number {
  return m?.solved ?? m?.total ?? 0;
}

export function gradeFor(o: ModeOutcome): Grade {
  if (o.failed || o.wrong >= 2) return Rating.Again;
  if (o.wrong === 1) return Rating.Hard;
  return o.elapsedMs < 6000 ? Rating.Easy : Rating.Good;
}

/** 문법·리스닝 등에서 한 문제를 끝냈을 때 기록 */
export async function recordModeAnswer(mode: StudyMode, itemId: string, o: ModeOutcome, goal: number, now: Date = new Date()) {
  const id = cardId(mode, itemId);
  const prev = await db.mcards.get(id);
  const isNew = !prev;
  const grade = gradeFor(o);
  let row = scheduleFields(prev ?? newMCard(mode, itemId, now), grade, now);
  if (isNew && o.clean && o.firstCleanDays) {
    const days = o.firstCleanDays;
    row = { ...row, due: new Date(now.getTime() + days * 86_400_000), stability: Math.max(row.stability, days), scheduled_days: days, state: State.Review, learning_steps: 0 };
  }
  const date = studyDateOf(now);
  const result = await db.transaction('rw', db.mcards, db.reviews, db.daily, async () => {
    await db.mcards.put(row);
    await db.reviews.add({
      wordId: itemId,
      studyMode: mode,
      ts: now.getTime(),
      studyDate: date,
      rating: grade,
      firstTry: o.clean,
      hints: o.hints ?? 0,
      showedAnswer: o.failed,
      wrongAttempts: o.wrong,
      mode: 'keyboard',
      elapsedMs: o.elapsedMs,
      isNew,
      wrongs: o.wrongs,
    });
    const d = (await db.daily.get(date)) ?? { date, total: 0, newWords: 0, reviews: 0, correct: 0, timeMs: 0 };
    const byMode = { ...(d.byMode ?? {}) };
    const m = { ...(byMode[mode] ?? emptyDay()) };
    const before = modeSolved(m);
    // counts 를 넘기는 모드(문법)는 그날 처음부터 solved 를 따로 센다 (안 넘기는 모드는 total 그대로)
    if (o.counts !== undefined || m.solved != null) m.solved = before + (o.counts === false ? 0 : 1);
    m.total += 1;
    if (isNew) m.newItems += 1;
    else m.reviews += 1;
    if (o.clean) m.correct += 1;
    m.timeMs += Math.min(o.elapsedMs, 5 * 60_000);
    byMode[mode] = m;
    await db.daily.put({ ...d, byMode });
    return { total: m.total, solved: modeSolved(m), metNow: before < goal && modeSolved(m) >= goal };
  });
  void computeStreak().then(grantRepairPen).catch(() => undefined);
  return { row, grade, isNew, ...result };
}

export function isLearning(row: MCardRow): boolean {
  return row.state === State.Learning || row.state === State.Relearning;
}

/** 다음 복습까지의 배지 문구 */
export function dueBadge(due: Date, now: Date = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms < 60 * 60_000) return '잠시 후 복습';
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return `${h}시간 뒤 복습`;
  const d = Math.round(ms / 86_400_000);
  if (d < 30) return `${d}일 뒤 복습`;
  return `${Math.round(d / 30)}개월 뒤 복습`;
}

export async function modeToday(mode: StudyMode): Promise<ModeDay> {
  return (await db.daily.get(studyDateOf()))?.byMode?.[mode] ?? emptyDay();
}

export async function toggleBookmark(mode: StudyMode, itemId: string): Promise<boolean> {
  const key = cardId(mode, itemId);
  if (await db.bookmarks.get(key)) {
    await db.bookmarks.delete(key);
    return false;
  }
  await db.bookmarks.put({ key, mode, itemId, ts: Date.now() });
  return true;
}
