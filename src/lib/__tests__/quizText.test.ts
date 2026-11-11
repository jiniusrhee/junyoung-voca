import { describe, expect, it } from 'vitest';
import type { WordSentence } from '../../types';
import { evaluate, feedbackFor, fullSentence, hintPrefix, layoutSentence, revealPrefix, speechMatchRate, splitInput, typoOf, typoTolerance } from '../text';

const s: WordSentence = {
  en: "He'll ___ say yes.",
  ko: '걔 **아마** 좋다고 할 거야.',
  answer: 'probably',
  alts: [
    { w: 'maybe', t: 'near', m: '확률이 반반쯤일 때 maybe라고 해요.' },
    { w: 'perhaps', t: 'wrong', m: 'perhaps는 맨 앞에 와야 자연스러워요.' },
    { w: 'likely', t: 'ok', m: 'likely도 맞지만 더 자주 쓰는 표현을 생각해 보세요.' },
  ],
};

describe('quiz text helpers', () => {
  it('expands one blank into one box per answer word', () => {
    const segs = layoutSentence("Let's ___ in the morning.", 'take off');
    expect(segs.filter((x) => x.kind === 'blank')).toHaveLength(2);
    expect(segs[0]).toEqual({ kind: 'text', text: "Let's " });
  });

  it('splits hyphenated answers into one box per segment with the hyphen between (말해보카)', () => {
    const segs = layoutSentence('She is an ___ actress.', 'up-and-coming');
    expect(segs).toEqual([
      { kind: 'text', text: 'She is an ' },
      { kind: 'blank', idx: 0 },
      { kind: 'text', text: '-' },
      { kind: 'blank', idx: 1 },
      { kind: 'text', text: '-' },
      { kind: 'blank', idx: 2 },
      { kind: 'text', text: ' actress.' },
    ]);
    expect(fullSentence('She is an ___ actress.', 'up-and-coming')).toBe('She is an up-and-coming actress.');
    expect(evaluate('up and coming', { en: 'She is an ___ actress.', ko: '', answer: 'up-and-coming' } as never, 'up-and-coming')).toEqual({ kind: 'correct' });
  });

  it('maps multiple blanks to answer words in order', () => {
    const segs = layoutSentence("Let's ___ ___ ten-minute ___.", 'take a break');
    expect(segs.filter((x) => x.kind === 'blank').map((x) => (x.kind === 'blank' ? x.idx : -1))).toEqual([0, 1, 2]);
    expect(fullSentence("Let's ___ ___ ten-minute ___.", 'take a break')).toBe("Let's take a ten-minute break.");
    expect(fullSentence("He'll ___ say yes.", 'probably')).toBe("He'll probably say yes.");
  });

  it('splits typed input across blanks', () => {
    expect(splitInput('take a', 3)).toEqual(['take', 'a', '']);
    expect(splitInput('take a break now', 3)).toEqual(['take', 'a', 'break now']);
    expect(splitInput('', 2)).toEqual(['', '']);
  });

  it('evaluates answers against alternative explanations', () => {
    expect(evaluate('Probably', s, 'probably')).toEqual({ kind: 'correct' });
    const near = evaluate('maybe', s, 'probably');
    expect(near.kind).toBe('alt');
    if (near.kind === 'alt') expect(feedbackFor(near)).toMatchObject({ tone: 'yellow', bonus: false });
    const ok = evaluate('likely', s, 'probably');
    if (ok.kind === 'alt') expect(feedbackFor(ok)).toMatchObject({ tone: 'green', bonus: true });
    expect(evaluate('probaly', s, 'probably').kind).toBe('typo');
    expect(evaluate('banana', s, 'probably').kind).toBe('wrong');
  });

  it('flags the base form when the sentence needs an inflection', () => {
    const past: WordSentence = { en: 'She ___ her goal.', ko: '그녀는 목표를 **이뤘다**.', answer: 'achieved' };
    expect(evaluate('achieve', past, 'achieve').kind).toBe('form');
  });

  it('reveals the first two letters as the first hint (말해보카)', () => {
    expect(hintPrefix('next to')).toBe('ne');
    expect(hintPrefix('us')).toBe('u');
    expect(hintPrefix('comprehensive')).toBe('co');
    expect(hintPrefix('shrink')).toBe('sh');
    expect(hintPrefix('architecture')).toBe('ar');
  });

  it('judges typos per box and scales the tolerance with length (말해보카 2026-11-10)', () => {
    expect(typoTolerance('unit')).toBe(1);
    expect(typoTolerance('avoidable')).toBe(3);
    expect(typoTolerance('transferring')).toBe(3);
    const multi = { en: 'Oh, ___!', ko: '', answer: 'what a relief' } as never;
    const e = evaluate('what a relie', multi, 'relief');
    expect(e.kind).toBe('typo');
    if (e.kind === 'typo') {
      expect(e.distance).toBe(1);
      expect(e.mask.map((m) => m.text).join('')).toBe('relie_');
    }
    expect(evaluate('anix', { en: '___ 6.', ko: '', answer: 'unit' } as never, 'unit').kind).toBe('wrong');
    expect(evaluate('tronsfarrang', { en: '___', ko: '', answer: 'transferring' } as never, 'transfer').kind).toBe('typo');
    expect(typoOf('what', 'what a relief')).toBeNull();
  });

  it('reveals letters across boxes for hints (hint +2, bonus +1)', () => {
    expect(revealPrefix('take shape', 2)).toBe('ta');
    expect(revealPrefix('take shape', 5)).toBe('take s');
    expect(revealPrefix('up-and-coming', 3)).toBe('up a');
    expect(revealPrefix('us', 2)).toBe('u');
    expect(revealPrefix('transferring', 3)).toBe('tra');
  });

  it('scores spoken sentences by matched words', () => {
    expect(speechMatchRate("he'll probably say yes", "He'll probably say yes.")).toBe(1);
    expect(speechMatchRate('he probably say', "He'll probably say yes.")).toBe(0.5);
  });
});
