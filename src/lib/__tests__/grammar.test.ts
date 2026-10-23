import { describe, expect, it } from 'vitest';
import type { GrammarSentence } from '../../types';
import { buildCards, checkGrammar, diffWords, displayAnswer, tokenize, type WordCard } from '../grammar';

const s: GrammarSentence = {
  id: 'x-01',
  topic: 'x',
  ko: '그녀는 새로운 사람들을 만나는 것이 흥미진진하다고 생각해.',
  en: 'She finds it exciting to meet new people.',
  distractors: ['excited', 'is', 'was'],
  levelNum: 16,
  pack: 'p',
};

const pick = (cards: WordCard[], words: string[]) => {
  const used = new Set<number>();
  return words.map((w) => {
    const c = cards.find((k) => k.text.toLowerCase() === w.toLowerCase() && !used.has(k.id))!;
    used.add(c.id);
    return c;
  });
};

describe('grammar', () => {
  it('tokenizes and builds alphabetical cards with a lowercase first word', () => {
    expect(tokenize(s.en)).toEqual({ tokens: ['She', 'finds', 'it', 'exciting', 'to', 'meet', 'new', 'people'], end: '.' });
    const cards = buildCards(s);
    expect(cards.map((c) => c.text)).toEqual(['excited', 'exciting', 'finds', 'is', 'it', 'meet', 'new', 'people', 'she', 'to', 'was']);
    expect(displayAnswer(['she', 'finds'])).toEqual(['She', 'finds']);
  });

  it('keeps I capitalized on its card', () => {
    const cards = buildCards({ ...s, en: "I've already eaten.", distractors: ['ate'] });
    expect(cards.map((c) => c.text)).toContain("I've");
  });

  it('accepts the exact answer', () => {
    const cards = buildCards(s);
    const r = checkGrammar(s, pick(cards, ['she', 'finds', 'it', 'exciting', 'to', 'meet', 'new', 'people']), cards);
    expect(r.status).toBe('correct');
  });

  it('marks a wrong word and the card to use instead', () => {
    const cards = buildCards(s);
    const r = checkGrammar(s, pick(cards, ['she', 'finds', 'it', 'excited', 'to', 'meet', 'new', 'people']), cards);
    expect(r.status).toBe('extra');
    expect(r.marks[3]).toBe('wrong');
    expect(r.plus).toEqual([cards.find((c) => c.text === 'exciting')!.id]);
    expect(r.message).toContain('표시된 단어들을 옮겨서');
  });

  it('counts missing words', () => {
    const cards = buildCards(s);
    const r = checkGrammar(s, pick(cards, ['she', 'finds', 'it', 'to', 'meet', 'new', 'people']), cards);
    expect(r.status).toBe('missing');
    expect(r.message).toBe('아래 보기에서 1개 단어를 더 사용해서 문장을 완성해 보세요.');
  });

  it('flags words in the wrong position', () => {
    const cards = buildCards(s);
    const r = checkGrammar(s, pick(cards, ['she', 'finds', 'it', 'to', 'meet', 'exciting', 'new', 'people']), cards);
    expect(r.status).toBe('order');
    expect(r.marks.filter((m) => m === 'swap').length).toBeGreaterThan(0);
    expect(r.message).toBe('단어의 순서를 바꿔보세요.');
  });

  it('accepts an alternative answer and highlights the different words', () => {
    const t: GrammarSentence = { ...s, en: "You've already eaten four pieces.", distractors: ['ate', 'yet'], alts: [{ en: "You've eaten four pieces already.", note: 'n' }] };
    const cards = buildCards(t);
    const r = checkGrammar(t, pick(cards, ["you've", 'eaten', 'four', 'pieces', 'already']), cards);
    expect(r.status).toBe('correct');
    expect(diffWords(t.en, t.alts![0].en).filter((x) => x.diff).length).toBeGreaterThan(0);
  });
});
