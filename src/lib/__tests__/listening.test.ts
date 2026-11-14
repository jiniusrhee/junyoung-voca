import { describe, expect, it } from 'vitest';
import { itemLevel, listenProgress, listenWords, mcOrder, nextListenLevel, resultFor, spokenMatch, typedMatch } from '../listening';

describe('listening', () => {
  it('rates results by number of listens', () => {
    expect(resultFor(1, false)).toBe('perfect');
    expect(resultFor(2, false)).toBe('great');
    expect(resultFor(3, false)).toBe('good');
    expect(resultFor(2, true)).toBe('nice');
    // 다시 듣기를 다 써서 뜻이 보인 뒤에는 맞혀도 Nice Try
    expect(resultFor(4, false)).toBe('nice');
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
    expect(listenWords("Don't worry!")[0]).toMatchObject({ show: "Don't", key: "don't", type: 'dont', btn: "don't" });
    expect(listenWords("I'd rather not.").map((w) => w.btn)).toEqual(["I'd", 'rather', 'not']);
    expect(listenWords('Never regret it.').map((w) => w.btn)).toEqual(['never', 'regret', 'it']);
  });

  it('keeps the next word among the four choices', () => {
    for (let n = 1; n <= 13; n++) {
      const order = mcOrder(n);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      // 묶음(넷씩) 안에서만 섞인다
      order.forEach((w, k) => expect(Math.floor(w / 4)).toBe(Math.floor(k / 4)));
    }
  });

  it('fills the progress bar by letters with a short lead', () => {
    const ws = listenWords('I always need subtitles when I watch foreign films.');
    expect(listenProgress(ws, 0)).toBe(0);
    expect(listenProgress(ws, 9)).toBe(1);
    // 실측: 4낱말 뒤 138 / 269.67, 8낱말 뒤 239.67 / 269.67
    expect(listenProgress(ws, 4) * 269.67).toBeCloseTo(138, -1);
    expect(listenProgress(ws, 8) * 269.67).toBeCloseTo(239.67, -1);
  });

  it('accepts a typed word the moment it is complete', () => {
    const ws = listenWords("That's a chapter of my life I'd rather not talk about.");
    expect(typedMatch(ws, 0, 'that')).toEqual({ take: 0, rest: 'that' });
    expect(typedMatch(ws, 0, 'thats')).toEqual({ take: 1, rest: '' });
    expect(typedMatch(ws, 6, 'id')).toEqual({ take: 1, rest: '' });
    expect(typedMatch(ws, 1, 'xb')).toEqual({ take: 0, rest: 'xb' });
    // 붙여 쓴 글자도 낱말마다 잘라 받는다
    expect(typedMatch(ws, 1, 'achap')).toEqual({ take: 1, rest: 'chap' });
    // 하이픈으로 이은 낱말은 하이픈 없이 친다
    const h = listenWords('She is an up-and-coming star.');
    expect(typedMatch(h, 3, 'upandcoming')).toEqual({ take: 1, rest: '' });
  });

  it('counts spoken words in order from the current word', () => {
    const ws = listenWords('Mom bought two giant bottles.');
    expect(spokenMatch(ws, 0, 'mom bought too giant')).toBe(2);
    expect(spokenMatch(ws, 2, 'two giant bottles')).toBe(3);
    expect(spokenMatch(ws, 2, 'mom bought two giant')).toBe(2);
    expect(spokenMatch(ws, 0, 'hello')).toBe(0);
  });

  it('maps word levels to 1~50', () => {
    expect(itemLevel(1, 4)).toBe(1);
    expect(itemLevel(30, 14)).toBe(50);
    expect(itemLevel(10, 6)).toBe(14);
  });
});
