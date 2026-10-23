import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPacks, validatePacks } from './lib/validate.mjs';
import { loadDir, validateExpr, validateGrammar, validatePairs, validateTalk } from './lib/validate-extra.mjs';

const wordsDir = fileURLToPath(new URL('../public/data/words/', import.meta.url));
const grammarDir = fileURLToPath(new URL('../public/data/grammar/', import.meta.url));
const pairsDir = fileURLToPath(new URL('../public/data/pairs/', import.meta.url));
const out = fileURLToPath(new URL('../public/data/manifest.json', import.meta.url));
const hash = (text) => createHash('sha1').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 12);

const packs = loadPacks(wordsDir);
const { errors, warnings, count } = validatePacks(packs);
for (const w of warnings) console.warn('경고:', w);

const grammar = loadDir(grammarDir);
const g = validateGrammar(grammar);
const pairs = loadDir(pairsDir);
const p = validatePairs(pairs);
const expr = loadDir(fileURLToPath(new URL('../public/data/expr/', import.meta.url)));
const x = validateExpr(expr);
const talk = loadDir(fileURLToPath(new URL('../public/data/talk/', import.meta.url)));
const t = validateTalk(talk);
const all = [...errors, ...g.errors, ...p.errors, ...x.errors, ...t.errors];
if (all.length) {
  for (const e of all) console.error('오류:', e);
  process.exit(1);
}

const manifest = {
  totalWords: count,
  packs: packs.map(({ file, text }) => {
    const data = JSON.parse(text);
    const levels = [...new Set(data.words.map((w) => w.level))].sort((a, b) => a - b);
    return { file, hash: hash(text), count: data.words.length, levels };
  }),
  grammar: grammar.map(({ file, text }) => ({ file, hash: hash(text) })),
  pairs: pairs.map(({ file, text }) => ({ file, hash: hash(text) })),
  expr: expr.map(({ file, text }) => ({ file, hash: hash(text) })),
  talk: talk.map(({ file, text }) => ({ file, hash: hash(text) })),
};
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json 생성: 단어 팩 ${manifest.packs.length}개(${count}단어), 문법 팩 ${grammar.length}개(${g.sentences}문장), 발음 팩 ${pairs.length}개, 표현 코스 ${expr.length}개(${x.items}문제), 회화 스토리 ${talk.length}개(${t.episodes}에피소드)`);
