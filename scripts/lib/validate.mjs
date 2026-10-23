import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const POS = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'phr'];

export function loadPacks(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));
}

function stemMatch(a, b) {
  const n = Math.min(a.length, b.length, 3);
  return a.slice(0, n) === b.slice(0, n);
}

export function validatePacks(packs) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  let count = 0;
  for (const { file, text } of packs) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      errors.push(`${file}: JSON 파싱 실패 (${e.message})`);
      continue;
    }
    if (!data || !Array.isArray(data.words)) {
      errors.push(`${file}: words 배열이 없음`);
      continue;
    }
    data.words.forEach((w, i) => {
      count++;
      const at = `${file}#${i + 1} (${w?.word ?? '?'})`;
      if (!w || typeof w !== 'object') {
        errors.push(`${at}: 객체가 아님`);
        return;
      }
      if (typeof w.id !== 'string' || !w.id) errors.push(`${at}: id 누락`);
      else if (ids.has(w.id)) errors.push(`${at}: id 중복 (${ids.get(w.id)}에도 있음)`);
      else ids.set(w.id, file);
      if (typeof w.word !== 'string' || !w.word) errors.push(`${at}: word 누락`);
      if (!POS.includes(w.pos)) errors.push(`${at}: pos 값 이상 (${w.pos})`);
      if (!Number.isInteger(w.level) || w.level < 1 || w.level > 30) errors.push(`${at}: level은 1~30 정수`);
      if (!Array.isArray(w.meanings) || w.meanings.length === 0 || w.meanings.some((m) => typeof m !== 'string' || !m))
        errors.push(`${at}: meanings 비어 있음`);
      if (!Array.isArray(w.sentences) || w.sentences.length === 0) {
        errors.push(`${at}: sentences 비어 있음`);
        return;
      }
      w.sentences.forEach((s, j) => {
        const sat = `${at} 문장${j + 1}`;
        if (typeof s.en !== 'string' || (s.en.match(/___/g) || []).length !== 1)
          errors.push(`${sat}: en에 ___ 이 정확히 1개 있어야 함`);
        if (typeof s.answer !== 'string' || !s.answer) errors.push(`${sat}: answer 누락`);
        else if (!/^[A-Za-z][A-Za-z' -]*$/.test(s.answer)) errors.push(`${sat}: answer에 허용되지 않는 문자 (${s.answer})`);
        else if (typeof w.word === 'string' && !stemMatch(s.answer.toLowerCase(), w.word.toLowerCase()))
          warnings.push(`${sat}: answer(${s.answer})가 word(${w.word})와 어간이 달라 보임`);
        if (typeof s.ko !== 'string' || !s.ko) errors.push(`${sat}: ko 누락`);
        else if ((s.ko.match(/\*\*/g) || []).length !== 2) warnings.push(`${sat}: ko에 **강조**가 1쌍이 아님`);
      });
    });
  }
  return { errors, warnings, count };
}
