import { describe, expect, it } from 'vitest';
import { itemLevel, listenWords, nextListenLevel, resultFor } from '../listening';

describe('listening', () => {
  it('rates results by number of listens', () => {
    expect(resultFor(1, false)).toBe('perfect');
    expect(resultFor(2, false)).toBe('great');
    expect(resultFor(3, false)).toBe('good');
    expect(resultFor(2, true)).toBe('nice');
  });

  it('moves the listening level like the real app (+2 / 0 / -3)', () => {
    expect(nextListenLevel(41, 'perfect')).toBe(43);
    expect(nextListenLevel(41, 'great')).toBe(41);
    expect(nextListenLevel(41, 'good')).toBe(38);
    expect(nextListenLevel(2, 'nice')).toBe(1);
    expect(nextListenLevel(50, 'perfect')).toBe(50);
  });

  it('splits sentences into comparable words', () => {
    expect(listenWords("I heard that Jones is running again.").map((w) => w.key)).toEqual(['i', 'heard', 'that', 'jones', 'is', 'running', 'again']);
    expect(listenWords("Don't worry!")[0]).toEqual({ show: "Don't", key: "don't" });
  });

  it('maps word levels to 1~50', () => {
    expect(itemLevel(1, 4)).toBe(1);
    expect(itemLevel(30, 14)).toBe(50);
    expect(itemLevel(10, 6)).toBe(14);
  });
});
