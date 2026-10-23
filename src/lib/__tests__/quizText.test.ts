import { describe, expect, it } from 'vitest';
import type { WordSentence } from '../../types';
import { evaluate, feedbackFor, fullSentence, hintPrefix, layoutSentence, speechMatchRate, splitInput } from '../text';

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

  it('reveals about a third of the answer as the first hint', () => {
    expect(hintPrefix('next to')).toBe('ne');
    expect(hintPrefix('us')).toBe('u');
    expect(hintPrefix('comprehensive')).toBe('comp');
  });

  it('scores spoken sentences by matched words', () => {
    expect(speechMatchRate("he'll probably say yes", "He'll probably say yes.")).toBe(1);
    expect(speechMatchRate('he probably say', "He'll probably say yes.")).toBe(0.5);
  });
});
