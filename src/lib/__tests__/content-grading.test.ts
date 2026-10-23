import { describe, expect, it } from 'vitest';
import type { ExprItem, TalkStory } from '../../types';
import { evalExpr } from '../expr';
import { gradeTalk } from '../talk';

const talkFiles = import.meta.glob<TalkStory>('../../../public/data/talk/*.json', { eager: true, import: 'default' });
const exprFiles = import.meta.glob<{ items: ExprItem[] }>('../../../public/data/expr/*.json', { eager: true, import: 'default' });

describe('실전 회화 데이터 채점', () => {
  const stories = Object.values(talkFiles);
  const lines = stories.flatMap((s) => s.episodes.flatMap((e) => e.lines.filter((l) => l.who === 'me').map((l) => ({ id: e.id, l }))));

  it('has content', () => {
    expect(lines.length).toBeGreaterThan(100);
  });

  it('gives 3 stars to every model and accepted answer, even at C2', () => {
    const bad: string[] = [];
    for (const { id, l } of lines) {
      for (const t of [l.answer!, ...(l.accept ?? [])]) {
        if (gradeTalk(t, l, 'C2').stars !== 3) bad.push(`${id}: ${t}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('gives 0 stars to an unrelated sentence', () => {
    const bad = lines.filter(({ l }) => gradeTalk('I like pizza very much.', l, 'A1').stars > 0).map(({ id, l }) => `${id}: ${l.answer}`);
    expect(bad).toEqual([]);
  });
});

describe('표현 데이터 채점', () => {
  const items = Object.values(exprFiles).flatMap((c) => c.items);

  it('has content', () => {
    expect(items.length).toBeGreaterThan(100);
  });

  it('accepts every answer and labels every alt', () => {
    const bad: string[] = [];
    for (const it of items) {
      if (evalExpr(it.answer, it).kind !== 'correct') bad.push(`${it.id}: answer`);
      for (const a of it.alts ?? []) {
        const r = evalExpr(a.w, it);
        if (r.kind !== 'alt') bad.push(`${it.id}: ${a.w} -> ${r.kind}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
