import { describe, expect, it } from 'vitest';
import { bare, evalExpr, exprPrefix, shownWord, wordMatches } from '../expr';
import type { ExprItem } from '../../types';

const item = (answer: string, alts: ExprItem['alts'] = []): ExprItem => ({
  id: 't',
  course: 'c',
  pkey: 'c:p',
  partner: { en: '', ko: '' },
  en: '___!',
  answer,
  ko: '',
  alts,
  order: 0,
});

describe('expr', () => {
  it('compares without apostrophes or case (the in-app keyboard has no apostrophe after the first step)', () => {
    expect(bare("That's great news")).toBe('thats great news');
    expect(evalExpr('thats great news', item("That's great news")).kind).toBe('correct');
    expect(evalExpr("That's Great News", item("That's great news")).kind).toBe('correct');
    expect(wordMatches('thats grea', "That's great news")).toEqual([true, false, false]);
  });

  it('recognises registered alternatives the same way', () => {
    const it2 = item('can I get', [{ w: "I'd like", t: 'near', m: '설명' }]);
    const r = evalExpr('id like', it2);
    expect(r).toMatchObject({ kind: 'alt', tone: 'yellow', bonus: false });
    expect(evalExpr('zq', it2).kind).toBe('wrong');
  });

  it('shows a typed word in the shape of the answer while it still matches', () => {
    expect(shownWord('thats', "That's")).toBe("That's");
    expect(shownWord('tha', "That's")).toBe('Tha');
    expect(shownWord('that', "That's")).toBe('That');
    expect(shownWord('i', 'I')).toBe('I');
    // 다르면 친 그대로
    expect(shownWord('thas', "That's")).toBe('thas');
    expect(shownWord('', 'Is')).toBe('');
  });

  it('gives the first two letters of the first word as a hint (and moves on when that finishes the word)', () => {
    expect(exprPrefix('What do you')).toBe('Wh');
    expect(exprPrefix('Is this the bus to')).toBe('Is ');
    expect(exprPrefix("That's great news")).toBe('Th');
    expect(exprPrefix('No')).toBe('No');
  });
});
