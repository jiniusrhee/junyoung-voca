import { describe, expect, it } from 'vitest';
import { listenWords } from '../listening';
import { listenTips } from '../listenTips';

const tips = (en: string) => listenTips(listenWords(en));
const title = (t: { title: { t: string }[] }) => t.title.map((x) => x.t).join('');

describe('listenTips', () => {
  it('points at a flapped t inside a word', () => {
    const r = tips('Mom bought two giant bottles of orange juice for the party.');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]).toMatchObject({ from: 4, to: 4 });
    expect(title(r[0])).toContain("'bottles'");
  });

  it('finds reduced pairs and the weak and', () => {
    const r = tips('My clothes used to be covered in holes and patches.');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ from: 2, to: 3 });
    expect(title(r[0])).toContain("'used to'");
    expect(r[1]).toMatchObject({ from: 7, to: 8 });
    expect(title(r[1])).toContain('and');
  });

  it('gives at most two tips, in sentence order, without overlapping words', () => {
    const r = tips('I want to tell him that I should have picked it up a little later.');
    expect(r.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < r.length; i++) expect(r[i].from).toBeGreaterThan(r[i - 1].to);
  });

  it('returns nothing for a plain sentence', () => {
    expect(tips('She smiled.')).toEqual([]);
  });
});
