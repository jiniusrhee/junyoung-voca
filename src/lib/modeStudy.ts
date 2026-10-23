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
  /** 실수 없이 한 번에 */
  clean: boolean;
  /** 틀린 횟수 */
  wrong: number;
  /** 정답 보기를 눌렀거나 끝내 못 맞힘 */
  failed: boolean;
  elapsedMs: number;
  wrongs?: WrongNote[];
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
  const row = scheduleFields(prev ?? newMCard(mode, itemId, now), grade, now);
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
      hints: 0,
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
    const before = m.total;
    m.total += 1;
    if (isNew) m.newItems += 1;
    else m.reviews += 1;
    if (o.clean) m.correct += 1;
    m.timeMs += Math.min(o.elapsedMs, 5 * 60_000);
    byMode[mode] = m;
    await db.daily.put({ ...d, byMode });
    void computeStreak().then(grantRepairPen);
    return { total: m.total, metNow: before < goal && m.total >= goal };
  });
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
