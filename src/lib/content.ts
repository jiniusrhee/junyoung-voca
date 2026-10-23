import { db } from '../db';
import type { WordEntry } from '../types';

interface Manifest {
  totalWords: number;
  packs: { file: string; hash: string; count: number; levels: number[] }[];
}

/** 배포된 단어 팩 중 바뀐 것만 받아 IndexedDB에 반영 */
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

  const files = new Set(manifest.packs.map((p) => p.file));
  const stale = (await db.packs.toArray()).filter((x) => !files.has(x.file));
  for (const s of stale) {
    await db.words.where('pack').equals(s.file).delete();
    await db.packs.delete(s.file);
  }
  return { updated };
}
