import { describe, expect, it } from 'vitest';
import type { ExprItem, TalkLine } from '../../types';
import { evalExpr, exprHint, wordMatches } from '../expr';
import { gradeLetter, gradeTalk, keyMatched, overlap } from '../talk';

const line: TalkLine = {
  who: 'me',
  ko: '안녕하세요! 혹시 길모퉁이에 새로 생긴 멕시칸 식당 가보셨어요?',
  answer: 'Hey! Have you tried the new Mexican place around the corner yet?',
  accept: ['Hi! Have you been to the new Mexican restaurant around the corner?'],
  keys: [
    { k: 'around the corner|on the corner', tip: "'길모퉁이에'는 around the corner로 표현해요." },
    { k: 'have you tried|have you been to|did you try', tip: '경험을 묻는 Have you tried ~?' },
  ],
  hint: 'h',
};

describe('talk grading', () => {
  it('gives 3 stars to the model answer and close paraphrases', () => {
    expect(gradeTalk(line.answer!, line).stars).toBe(3);
    expect(gradeTalk('Hi! Have you been to the new Mexican restaurant on the corner?', line).stars).toBe(3);
  });

  it('lowers the grade and explains missing key phrases', () => {
    const g = gradeTalk('Hello do you know the new Mexican food store', line);
    expect(g.stars).toBeLessThan(2);
    expect(g.feedback).toContain('around the corner');
    expect(gradeTalk('', line).stars).toBe(0);
  });

  it('matches key variants as whole words', () => {
    expect(keyMatched('Did you try it?', 'have you tried|did you try')).toBe(true);
    expect(keyMatched('corners', 'corner')).toBe(false);
    expect(overlap('a b c', 'a b c')).toBe(1);
  });

  it('turns average stars into a grade', () => {
    expect(gradeLetter(3)).toBe('S');
    expect(gradeLetter(2.4)).toBe('A');
    expect(gradeLetter(1.6)).toBe('B');
    expect(gradeLetter(0.5)).toBe('C');
  });
});

const item: ExprItem = {
  id: 'x',
  course: 'c',
  pkey: 'c:p',
  partner: { en: 'Cash or credit?', ko: '' },
  en: '___ Apple Pay?',
  answer: 'Can I pay with',
  ko: '애플페이**로 계산할 수 있을까요**?',
  alts: [{ w: 'Can I pay by', t: 'wrong', m: 'by는 카드일 때' }],
  order: 0,
};

describe('expression quiz', () => {
  it('evaluates answers and explanations', () => {
    expect(evalExpr('can i pay with', item).kind).toBe('correct');
    expect(evalExpr('Can I pay by', item)).toMatchObject({ kind: 'alt', tone: 'red' });
    expect(evalExpr('Can I pay wth', item).kind).toBe('typo');
    expect(evalExpr('Could I buy', item).kind).toBe('wrong');
  });

  it('marks matching words per box and builds a first-letter hint', () => {
    expect(wordMatches('Can I buy with', 'Can I pay with')).toEqual([true, true, false, true]);
    expect(exprHint('Can I pay with')).toBe('C__ I p__ w___');
  });
});
