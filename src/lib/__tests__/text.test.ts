import { describe, expect, it } from 'vitest';
import { containsAnswer, judge, levenshtein, normalize, splitBlank, splitBold } from '../text';

describe('text', () => {
  it('normalizes case, punctuation and spacing', () => {
    expect(normalize('  Achieve! ')).toBe('achieve');
    expect(normalize("don’t")).toBe("don't");
  });

  it('computes levenshtein distance', () => {
    expect(levenshtein('achieve', 'achieve')).toBe(0);
    expect(levenshtein('achive', 'achieve')).toBe(1);
    expect(levenshtein('cat', 'dog')).toBe(3);
  });

  it('judges exact answers regardless of case', () => {
    expect(judge('Achieve', 'achieve', 'achieve').verdict).toBe('correct');
  });

  it('treats the base form as close when the sentence needs an inflection', () => {
    const j = judge('achieve', 'achieved', 'achieve');
    expect(j.verdict).toBe('close');
    expect(j.baseForm).toBe(true);
  });

  it('treats one-letter slips as close and bigger misses as wrong', () => {
    expect(judge('achive', 'achieve', 'achieve').verdict).toBe('close');
    expect(judge('banana', 'achieve', 'achieve').verdict).toBe('wrong');
    expect(judge('', 'achieve', 'achieve').verdict).toBe('wrong');
  });

  it('finds the answer inside spoken transcripts', () => {
    expect(containsAnswer(['I want to achieve my goal'], 'achieve', 'achieve')).toBe(true);
    expect(containsAnswer(['Achieved.'], 'achieve', 'achieve')).toBe(false);
    expect(containsAnswer(['look forward to'], 'look forward to', 'look forward to')).toBe(true);
  });

  it('splits bold markers and blanks', () => {
    expect(splitBold('그녀는 목표를 **이루기** 위해')).toEqual([
      { text: '그녀는 목표를 ', bold: false },
      { text: '이루기', bold: true },
      { text: ' 위해', bold: false },
    ]);
    expect(splitBlank('She worked hard to ___ her goal.')).toEqual(['She worked hard to ', ' her goal.']);
  });
});
