// 빈도 목록 대비 수록 현황. 사용법: node scripts/coverage.mjs [레벨] [미수록 예시 개수]
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPacks } from './lib/validate.mjs';

const BANDS = [150, 300, 500, 700, 1000, 1300, 1600, 2000, 2400, 2800, 3300, 3800, 4300, 4900, 5500, 6100, 6800, 7500, 8200, 9000, 10000];
const JUNK = new Set(
  (
    'www com http https html org net edu gov info pdf jpg gif php asp cgi htm url faq ebay google yahoo microsoft msn aol ' +
    'paypal ipod xbox usa los las del san la le les des und der die das et al dvd vhs mp3 isbn ascii utf xml sql css gmt utc pst est ' +
    'etc inc ltd llc mrs ave blvd'
  ).split(/\s+/),
);

const src = fileURLToPath(new URL('../content/source/google-10000-english-usa-no-swears.txt', import.meta.url));
if (!existsSync(src)) {
  console.error('빈도 목록이 없습니다:', src);
  process.exit(1);
}
const list = readFileSync(src, 'utf8')
  .split(/\r?\n/)
  .map((w) => w.trim().toLowerCase())
  .filter((w) => /^[a-z]+$/.test(w) && w.length >= 3 && !JUNK.has(w));

const packs = loadPacks(fileURLToPath(new URL('../public/data/words/', import.meta.url)));
const have = new Set();
const perLevel = new Map();
for (const { text } of packs) {
  for (const w of JSON.parse(text).words) {
    have.add(w.word.toLowerCase());
    perLevel.set(w.level, (perLevel.get(w.level) ?? 0) + 1);
  }
}

const onlyLevel = Number(process.argv[2]) || null;
const sample = Number(process.argv[3]) || 15;
console.log('레벨 | 빈도 순위    | 목록 | 수록 | 미수록 예시');
let start = 0;
BANDS.forEach((end, i) => {
  const lvl = i + 1;
  const band = list.slice(start, end);
  const from = start + 1;
  start = end;
  if (onlyLevel && onlyLevel !== lvl) return;
  const missing = band.filter((w) => !have.has(w));
  console.log(
    `L${String(lvl).padStart(2, '0')}  | ${String(from).padStart(5)}~${String(end).padStart(5)} | ${String(band.length).padStart(4)} | ${String(band.length - missing.length).padStart(4)} | ${missing.slice(0, sample).join(', ')}`,
  );
});
console.log('\n레벨별 수록 단어 수(팩 기준):');
let line = '';
for (let l = 1; l <= 30; l++) {
  line += `L${String(l).padStart(2, '0')}:${String(perLevel.get(l) ?? 0).padStart(3)}  `;
  if (l % 6 === 0) {
    console.log('  ' + line);
    line = '';
  }
}
console.log('\n※ 레벨 22~30은 빈도 목록 바깥의 고급 어휘를 직접 선정합니다. 빈도 목록은 웹 말뭉치라 순위는 참고용입니다.');
