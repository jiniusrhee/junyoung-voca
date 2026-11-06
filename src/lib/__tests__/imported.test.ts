import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { applyImported, importedRange, inRange, getImported } from '../imported';
import { getSettings } from '../settings';
import { computeStreak, displayVocab } from '../stats';
import type { ImportedProgress } from '../../types';

const prog: ImportedProgress = {
  source: '말해보카',
  asOf: '2026-10-23',
  streak: { days: 440, asOf: '2026-10-23' },
  levels: { vocab: 30, grammar: 16, listening: 41 },
  vocabSize: 20489,
  learnedWords: ['Abandon', 'thrive'],
};

describe('imported progress', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.words.bulkPut([
      { id: 'w1', word: 'abandon', pos: 'v', level: 12, meanings: ['버리다'], sentences: [], pack: 'p' },
      { id: 'w2', word: 'cat', pos: 'n', level: 1, meanings: ['고양이'], sentences: [], pack: 'p' },
    ]);
  });

  it('applies levels and marks known words', async () => {
    await applyImported(prog, new Date('2026-10-24T12:00:00'));
    const s = await getSettings();
    expect(s.level).toBe(30);
    expect(s.listeningLevel).toBe(41);
    const cards = await db.cards.toArray();
    expect(cards.map((c) => c.wordId)).toEqual(['w1']);
    expect(cards[0].known).toBe(true);
    // 다시 적용해도 카드가 늘지 않는다
    await applyImported(prog);
    expect(await db.cards.count()).toBe(1);
  });

  it('continues the streak from the imported range', async () => {
    await applyImported(prog, new Date('2026-10-24T12:00:00'));
    const r = importedRange(prog)!;
    expect(r.from).toBe('2025-08-10');
    expect(inRange(r, '2026-10-23')).toBe(true);
    expect(inRange(r, '2026-10-24')).toBe(false);
    // 다음 날 아직 공부 안 했으면 440일, 그다음 날은 끊김
    expect(await computeStreak(new Date('2026-10-24T12:00:00'))).toBe(440);
    expect(await computeStreak(new Date('2026-10-25T12:00:00'))).toBe(0);
    await db.daily.put({ date: '2026-10-24', total: 10, newWords: 5, reviews: 5, correct: 8, timeMs: 60000 });
    expect(await computeStreak(new Date('2026-10-24T12:00:00'))).toBe(441);
  });

  it('extends an imported streak up to the day before first use', async () => {
    // 10/23 기준 440일 기록을 11/7에 처음 들여오면, 그 사이 14일도 이어진 것으로 보아 11/6까지 454일
    await applyImported(prog, new Date('2026-11-07T12:00:00'));
    const imp = await getImported();
    expect(imp?.streak).toEqual({ days: 454, asOf: '2026-11-06' });
    expect(await computeStreak(new Date('2026-11-07T12:00:00'))).toBe(454);
    // 두 번째 적용(갱신)에서는 더 늘리지 않는다
    await applyImported(prog, new Date('2026-12-01T12:00:00'));
    expect((await getImported())?.streak?.days).toBe(440);
  });

  it('shows the imported vocabulary size until a newer test', () => {
    expect(displayVocab(30, null, prog, null)).toBe(20489);
    expect(displayVocab(30, null, prog, '2026-10-01')).toBe(20489);
    expect(displayVocab(30, 0.7, prog, '2026-11-01')).not.toBe(20489);
  });
});
