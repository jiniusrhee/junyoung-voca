import { fileURLToPath } from 'node:url';
import { loadDir, validateGrammar, validatePairs } from './lib/validate-extra.mjs';

const g = validateGrammar(loadDir(fileURLToPath(new URL('../public/data/grammar/', import.meta.url))));
for (const w of g.warnings) console.warn('경고:', w);
for (const e of g.errors) console.error('오류:', e);
console.log(`문법: 주제 ${g.topics}개, 문장 ${g.sentences}개, 오류 ${g.errors.length}개`);

const p = validatePairs(loadDir(fileURLToPath(new URL('../public/data/pairs/', import.meta.url))));
for (const e of p.errors) console.error('오류:', e);
console.log(`발음 구분: 단계 ${p.stages}개, 오류 ${p.errors.length}개`);
process.exit(g.errors.length + p.errors.length ? 1 : 0);
