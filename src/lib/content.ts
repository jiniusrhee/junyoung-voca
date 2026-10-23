import { db } from '../db';
import type { GrammarSentence, GrammarTopic, WordEntry } from '../types';

interface FileRef {
  file: string;
  hash: string;
}

interface Manifest {
  totalWords: number;
  packs: (FileRef & { count: number; levels: number[] })[];
  grammar?: FileRef[];
  pairs?: FileRef[];
}

type RawTopic = Omit<GrammarTopic, 'levelNum' | 'pack' | 'order'>;
type RawSentence = Omit<GrammarSentence, 'levelNum' | 'pack'>;

const levelNumOf = (level: string) => Number(level.split('-')[0]) || 1;
const levelOrder = (level: string) => {
  const [a, b] = level.split('-').map(Number);
  return (a || 0) * 10 + (b || 0);
};

/** 배포된 단어·문법·발음 팩 중 바뀐 것만 받아 IndexedDB에 반영 */
export async function syncContent(): Promise<{ updated: string[] }> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/manifest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  const updated: string[] = [];

  for (const p of manifest.packs) {
    const prev = await db.packs.get(p.file);
    if (prev && prev.hash === p.hash) continue;
    const r = await fetch(`${base}data/words/${p.file}`, { cache: 'no-cache' });
    if (!r.ok) continue;
    const pack = (await r.json()) as { words: WordEntry[] };
    await db.transaction('rw', db.words, db.packs, async () => {
      const old = (await db.words.where('pack').equals(p.file).primaryKeys()) as string[];
      const keep = new Set(pack.words.map((w) => w.id));
      const remove = old.filter((id) => !keep.has(id));
      if (remove.length) await db.words.bulkDelete(remove);
      await db.words.bulkPut(pack.words.map((w) => ({ ...w, pack: p.file })));
      await db.packs.put({ file: p.file, hash: p.hash, count: pack.words.length, updatedAt: Date.now() });
    });
    updated.push(p.file);
  }

  for (const g of manifest.grammar ?? []) {
    const key = `grammar/${g.file}`;
    const prev = await db.packs.get(key);
    if (prev && prev.hash === g.hash) continue;
    const r = await fetch(`${base}data/grammar/${g.file}`, { cache: 'no-cache' });
    if (!r.ok) continue;
    const pack = (await r.json()) as { topics: RawTopic[]; sentences: RawSentence[] };
    const topicLevel = new Map(pack.topics.map((t) => [t.id, levelNumOf(t.level)]));
    await db.transaction('rw', db.gtopics, db.gsentences, db.packs, async () => {
      await db.gtopics.where('pack').equals(key).delete();
      await db.gsentences.where('pack').equals(key).delete();
      await db.gtopics.bulkPut(pack.topics.map((t) => ({ ...t, levelNum: levelNumOf(t.level), order: levelOrder(t.level), pack: key })));
      await db.gsentences.bulkPut(pack.sentences.map((s) => ({ ...s, levelNum: topicLevel.get(s.topic) ?? 1, pack: key })));
      await db.packs.put({ file: key, hash: g.hash, count: pack.sentences.length, updatedAt: Date.now() });
    });
    updated.push(key);
  }

  for (const p of manifest.pairs ?? []) {
    const key = `pairs/${p.file}`;
    const prev = await db.packs.get(key);
    if (prev && prev.hash === p.hash) continue;
    const r = await fetch(`${base}data/pairs/${p.file}`, { cache: 'no-cache' });
    if (!r.ok) continue;
    const data = await r.json();
    await db.kv.put({ key: 'pairsData', value: data });
    await db.packs.put({ file: key, hash: p.hash, count: 0, updatedAt: Date.now() });
    updated.push(key);
  }

  const known = new Set([
    ...manifest.packs.map((p) => p.file),
    ...(manifest.grammar ?? []).map((g) => `grammar/${g.file}`),
    ...(manifest.pairs ?? []).map((p) => `pairs/${p.file}`),
  ]);
  const stale = (await db.packs.toArray()).filter((x) => !known.has(x.file));
  for (const s of stale) {
    if (s.file.startsWith('grammar/')) {
      await db.gtopics.where('pack').equals(s.file).delete();
      await db.gsentences.where('pack').equals(s.file).delete();
    } else if (!s.file.startsWith('pairs/')) {
      await db.words.where('pack').equals(s.file).delete();
    }
    await db.packs.delete(s.file);
  }
  return { updated };
}
