import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const POS = ['n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'det', 'num', 'interj', 'phr'];
export const ALT_TYPES = ['ok', 'near', 'wrong'];

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
        const blanks = typeof s.en === 'string' ? (s.en.match(/___/g) || []).length : 0;
        const answerWords = typeof s.answer === 'string' ? s.answer.trim().split(/\s+/).length : 0;
        if (blanks === 0) errors.push(`${sat}: en에 빈칸 ___ 이 없음`);
        else if (blanks !== 1 && blanks !== answerWords)
          errors.push(`${sat}: 빈칸 ___ 은 1개이거나 answer 단어 수(${answerWords})와 같아야 함 (현재 ${blanks}개)`);
        if (typeof s.answer !== 'string' || !s.answer) errors.push(`${sat}: answer 누락`);
        else if (!/^[A-Za-z][A-Za-z' -]*$/.test(s.answer)) errors.push(`${sat}: answer에 허용되지 않는 문자 (${s.answer})`);
        else if (typeof w.word === 'string' && !stemMatch(s.answer.toLowerCase(), w.word.toLowerCase()))
          warnings.push(`${sat}: answer(${s.answer})가 word(${w.word})와 어간이 달라 보임`);
        if (typeof s.ko !== 'string' || !s.ko) errors.push(`${sat}: ko 누락`);
        else if ((s.ko.match(/\*\*/g) || []).length !== 2) warnings.push(`${sat}: ko에 **강조**가 1쌍이 아님`);
        if (s.ctx !== undefined && (typeof s.ctx !== 'string' || !s.ctx || s.ctx.length > 30))
          errors.push(`${sat}: ctx는 30자 이하의 문자열이어야 함`);
        if (s.note !== undefined && (typeof s.note !== 'string' || !s.note || s.note.length > 40))
          errors.push(`${sat}: note는 40자 이하의 문자열이어야 함`);
        if (s.alts !== undefined) {
          if (!Array.isArray(s.alts) || s.alts.length > 5) {
            errors.push(`${sat}: alts는 5개 이하의 배열이어야 함`);
          } else {
            const seen = new Set();
            s.alts.forEach((a, k) => {
              const aat = `${sat} alts${k + 1}`;
              if (!a || typeof a !== 'object') return errors.push(`${aat}: 객체가 아님`);
              if (typeof a.w !== 'string' || !/^[A-Za-z][A-Za-z' -]*$/.test(a.w)) errors.push(`${aat}: w 형식 오류 (${a.w})`);
              else {
                const key = a.w.trim().toLowerCase();
                if (typeof s.answer === 'string' && key === s.answer.trim().toLowerCase()) errors.push(`${aat}: w가 정답과 같음`);
                if (seen.has(key)) errors.push(`${aat}: w 중복 (${a.w})`);
                seen.add(key);
              }
              if (!ALT_TYPES.includes(a.t)) errors.push(`${aat}: t는 ok/near/wrong 중 하나 (${a.t})`);
              if (typeof a.m !== 'string' || !a.m || a.m.length > 90) errors.push(`${aat}: m은 90자 이하의 설명이어야 함`);
            });
          }
        }
      });
    });
  }
  return { errors, warnings, count };
}
