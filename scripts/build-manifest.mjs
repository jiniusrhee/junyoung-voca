import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPacks, validatePacks } from './lib/validate.mjs';

const dir = fileURLToPath(new URL('../public/data/words/', import.meta.url));
const out = fileURLToPath(new URL('../public/data/manifest.json', import.meta.url));

const packs = loadPacks(dir);
const { errors, warnings, count } = validatePacks(packs);
for (const w of warnings) console.warn('경고:', w);
if (errors.length) {
  for (const e of errors) console.error('오류:', e);
  process.exit(1);
}

const manifest = {
  totalWords: count,
  packs: packs.map(({ file, text }) => {
    const data = JSON.parse(text);
    const levels = [...new Set(data.words.map((w) => w.level))].sort((a, b) => a - b);
    return {
      file,
      hash: createHash('sha1').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12),
      count: data.words.length,
      levels,
    };
  }),
};
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json 생성: 팩 ${manifest.packs.length}개, 단어 ${count}개`);
