import { fileURLToPath } from 'node:url';
import { loadPacks, validatePacks } from './lib/validate.mjs';

const dir = fileURLToPath(new URL('../public/data/words/', import.meta.url));
const { errors, warnings, count } = validatePacks(loadPacks(dir));
for (const w of warnings) console.warn('경고:', w);
for (const e of errors) console.error('오류:', e);
console.log(`단어 ${count}개, 오류 ${errors.length}개, 경고 ${warnings.length}개`);
process.exit(errors.length ? 1 : 0);
