// 문법 팩, 발음 구분 연습 팩 검증
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9'\-]*$/;
const LEVEL_RE = /^([1-9]|[12][0-9]|30)-[1-9]$/;
const BLOCK_TYPES = ['p', 'ex', 'tip', 'chunks', 'h'];

export function loadDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ file: f, text: readFileSync(join(dir, f), 'utf8') }));
}

/** 문장을 단어 토큰과 끝 문장부호로 나눈다 */
export function tokenize(en) {
  const m = en.trim().match(/^(.*?)([.?!])$/);
  if (!m) return null;
  return { tokens: m[1].trim().split(/\s+/), end: m[2] };
}

export function validateGrammar(packs) {
  const errors = [];
  const warnings = [];
  const topicIds = new Map();
  const sentIds = new Set();
  const topicCount = new Map();
  let sentences = 0;
  const parsed = [];
  for (const { file, text } of packs) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      errors.push(`${file}: JSON 파싱 실패 (${e.message})`);
      continue;
    }
    parsed.push({ file, data });
    for (const [i, t] of (data.topics ?? []).entries()) {
      const at = `${file} topic#${i + 1} (${t?.id})`;
      if (typeof t.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id)) errors.push(`${at}: id는 소문자/숫자/하이픈`);
      else if (topicIds.has(t.id)) errors.push(`${at}: topic id 중복`);
      else topicIds.set(t.id, file);
      if (!LEVEL_RE.test(t.level ?? '')) errors.push(`${at}: level은 'N-M' (N 1~30)`);
      if (typeof t.title !== 'string' || !t.title) errors.push(`${at}: title 누락`);
      if (typeof t.category !== 'string' || !t.category) errors.push(`${at}: category 누락`);
      const l = t.lesson;
      if (!l || !Array.isArray(l.blocks) || l.blocks.length < 4) errors.push(`${at}: lesson.blocks는 4개 이상`);
      else
        l.blocks.forEach((b, k) => {
          const bat = `${at} block#${k + 1}`;
          if (!BLOCK_TYPES.includes(b.t)) errors.push(`${bat}: t는 ${BLOCK_TYPES.join('/')}`);
          if ((b.t === 'p' || b.t === 'tip' || b.t === 'h') && (typeof b.text !== 'string' || !b.text)) errors.push(`${bat}: text 누락`);
          if (b.t === 'ex' && (typeof b.en !== 'string' || typeof b.ko !== 'string')) errors.push(`${bat}: ex는 en, ko 필요`);
          if (b.t === 'ex' && b.hl && !b.en.includes(b.hl)) errors.push(`${bat}: hl은 en 안의 문자열이어야 함`);
          if (b.t === 'chunks' && (!Array.isArray(b.parts) || b.parts.length < 2)) errors.push(`${bat}: chunks.parts는 2개 이상`);
        });
      if (typeof l?.summary !== 'string' || !l.summary) errors.push(`${at}: lesson.summary 누락`);
    }
  }
  for (const { file, data } of parsed) {
    for (const [i, s] of (data.sentences ?? []).entries()) {
      sentences++;
      const at = `${file} sentence#${i + 1} (${s?.id})`;
      if (typeof s.id !== 'string' || !s.id) errors.push(`${at}: id 누락`);
      else if (sentIds.has(s.id)) errors.push(`${at}: id 중복`);
      else sentIds.add(s.id);
      if (!topicIds.has(s.topic)) errors.push(`${at}: 없는 topic (${s.topic})`);
      else topicCount.set(s.topic, (topicCount.get(s.topic) ?? 0) + 1);
      if (typeof s.ko !== 'string' || !s.ko) errors.push(`${at}: ko 누락`);
      const tk = typeof s.en === 'string' ? tokenize(s.en) : null;
      if (!tk) {
        errors.push(`${at}: en은 . ? ! 로 끝나야 함`);
        continue;
      }
      if (tk.tokens.length < 3 || tk.tokens.length > 14) errors.push(`${at}: 단어 수는 3~14 (${tk.tokens.length})`);
      for (const w of tk.tokens) if (!TOKEN_RE.test(w)) errors.push(`${at}: 문장 중간 문장부호 금지 (${w})`);
      if (!Array.isArray(s.distractors) || s.distractors.length < 1 || s.distractors.length > 4) errors.push(`${at}: distractors는 1~4개`);
      else {
        const lower = new Set(tk.tokens.map((w) => w.toLowerCase()));
        for (const d of s.distractors) {
          if (typeof d !== 'string' || !TOKEN_RE.test(d)) errors.push(`${at}: distractor 형식 (${d})`);
          else if (lower.has(d.toLowerCase())) errors.push(`${at}: distractor가 정답 단어와 같음 (${d})`);
        }
      }
      for (const [k, a] of (s.alts ?? []).entries()) {
        const atk = tokenize(a?.en ?? '');
        if (!atk) errors.push(`${at} alt#${k + 1}: en 형식`);
        else {
          const pool = [...tk.tokens.map((w) => w.toLowerCase()), ...(s.distractors ?? []).map((d) => d.toLowerCase())];
          for (const w of atk.tokens) {
            const i2 = pool.indexOf(w.toLowerCase());
            if (i2 < 0) errors.push(`${at} alt#${k + 1}: 카드에 없는 단어 (${w})`);
            else pool.splice(i2, 1);
          }
        }
        if (typeof a?.note !== 'string' || !a.note) errors.push(`${at} alt#${k + 1}: note 누락`);
      }
    }
  }
  for (const [id] of topicIds) if ((topicCount.get(id) ?? 0) < 4) warnings.push(`topic ${id}: 문장이 4개 미만`);
  return { errors, warnings, topics: topicIds.size, sentences };
}

export function validatePairs(packs) {
  const errors = [];
  const ids = new Set();
  let stages = 0;
  for (const { file, text } of packs) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      errors.push(`${file}: JSON 파싱 실패 (${e.message})`);
      continue;
    }
    for (const [li, lv] of (data.levels ?? []).entries()) {
      const at = `${file} level#${li + 1}`;
      if (!['beginner', 'basic', 'intermediate', 'advanced'].includes(lv.id)) errors.push(`${at}: id`);
      if (typeof lv.story !== 'string' || !lv.story) errors.push(`${at}: story 누락`);
      for (const [si, st] of (lv.stages ?? []).entries()) {
        stages++;
        const sat = `${at} stage#${si + 1} (${st.id})`;
        if (typeof st.id !== 'string' || ids.has(st.id)) errors.push(`${sat}: id 누락/중복`);
        ids.add(st.id);
        for (const k of ['a', 'b', 'title', 'sceneA', 'sceneB']) if (typeof st[k] !== 'string' || !st[k]) errors.push(`${sat}: ${k} 누락`);
        if (!Array.isArray(st.easy) || st.easy.length < 6) errors.push(`${sat}: easy는 6개 이상`);
        else
          st.easy.forEach((p, k) => {
            if (!Array.isArray(p) || p.length !== 2 || p[0] === p[1] || !p.every((w) => /^[a-z][a-z' -]*$/.test(w)))
              errors.push(`${sat} easy#${k + 1}: [a단어, b단어] 소문자 쌍`);
          });
        if (!Array.isArray(st.hard) || st.hard.length < 4) errors.push(`${sat}: hard는 4개 이상`);
        else
          st.hard.forEach((h, k) => {
            if (typeof h?.a !== 'string' || typeof h?.b !== 'string' || h.a === h.b) errors.push(`${sat} hard#${k + 1}: a, b 문장`);
            if (typeof h?.ko !== 'string') errors.push(`${sat} hard#${k + 1}: ko 누락`);
          });
      }
    }
  }
  return { errors, stages };
}
