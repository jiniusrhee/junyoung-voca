import { fileURLToPath } from 'node:url';
import { loadDir, validateExpr, validateGrammar, validatePairs, validateTalk } from './lib/validate-extra.mjs';

const dir = (p) => fileURLToPath(new URL(`../public/data/${p}/`, import.meta.url));
const g = validateGrammar(loadDir(dir('grammar')));
for (const w of g.warnings) console.warn('경고:', w);
for (const e of g.errors) console.error('오류:', e);
console.log(`문법: 주제 ${g.topics}개, 문장 ${g.sentences}개, 오류 ${g.errors.length}개`);
const p = validatePairs(loadDir(dir('pairs')));
for (const e of p.errors) console.error('오류:', e);
console.log(`발음 구분: 단계 ${p.stages}개, 오류 ${p.errors.length}개`);
const x = validateExpr(loadDir(dir('expr')));
for (const e of x.errors) console.error('오류:', e);
console.log(`표현: 패턴 ${x.patterns}개, 문제 ${x.items}개, 오류 ${x.errors.length}개`);
const t = validateTalk(loadDir(dir('talk')));
for (const e of t.errors) console.error('오류:', e);
console.log(`실전 회화: 에피소드 ${t.episodes}개, 내 대사 ${t.lines}개, 오류 ${t.errors.length}개`);
process.exit(g.errors.length + p.errors.length + x.errors.length + t.errors.length ? 1 : 0);
