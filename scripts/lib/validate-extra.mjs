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
  // 용어집: easy 쌍의 모든 단어에 [발음, 뜻] 이 있어야 한다 (말해보카처럼 카드에 발음·뜻을 보여주기 위해)
  for (const { file, text } of packs) {
    try {
      const data = JSON.parse(text);
      const gl = data.glossary ?? {};
      for (const l of data.levels ?? []) for (const s of l.stages ?? []) for (const p of s.easy ?? []) for (const w of p) {
        if (!gl[w] || !Array.isArray(gl[w]) || gl[w].length !== 2 || !gl[w][1]) errors.push(`${file}: glossary 없음: ${w}`);
      }
    } catch {
      /* JSON 오류는 아래에서 보고 */
    }
  }
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

// ---------------- 표현 학습 ----------------
const WORD_RE = /^[A-Za-z0-9][A-Za-z0-9'\-]*[.?!,]?$/;
export function validateExpr(packs) {
  const errors = [];
  const ids = new Set();
  let items = 0;
  let patterns = 0;
  for (const { file, text } of packs) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      errors.push(`${file}: JSON 파싱 실패 (${e.message})`);
      continue;
    }
    const c = d.course;
    if (!c || !/^[a-z0-9-]+$/.test(c.id ?? '') || !c.title || !c.group || ![1, 2, 3].includes(c.stars)) errors.push(`${file}: course(id,title,group,stars 1~3) 오류`);
    const pids = new Set();
    for (const [i, p] of (d.patterns ?? []).entries()) {
      patterns++;
      const at = `${file} pattern#${i + 1} (${p?.id})`;
      if (!/^[a-z0-9-]+$/.test(p.id ?? '') || pids.has(p.id)) errors.push(`${at}: id 형식/중복`);
      pids.add(p.id);
      for (const k of ['ko', 'en', 'meaning', 'note']) if (typeof p[k] !== 'string' || !p[k]) errors.push(`${at}: ${k} 누락`);
    }
    const perPattern = new Map();
    for (const [i, it] of (d.items ?? []).entries()) {
      items++;
      const at = `${file} item#${i + 1} (${it?.id})`;
      if (typeof it.id !== 'string' || ids.has(it.id)) errors.push(`${at}: id 누락/중복`);
      ids.add(it.id);
      if (!pids.has(it.pattern)) errors.push(`${at}: 없는 pattern (${it.pattern})`);
      perPattern.set(it.pattern, (perPattern.get(it.pattern) ?? 0) + 1);
      if (!it.partner || typeof it.partner.en !== 'string' || typeof it.partner.ko !== 'string') errors.push(`${at}: partner.en/ko 누락`);
      if (typeof it.en !== 'string' || (it.en.match(/___/g) || []).length !== 1) errors.push(`${at}: en에 ___ 1개`);
      if (typeof it.answer !== 'string' || !it.answer.trim()) errors.push(`${at}: answer 누락`);
      else for (const w of it.answer.trim().split(/\s+/)) if (!/^[A-Za-z][A-Za-z'\-]*$/.test(w)) errors.push(`${at}: answer 단어 형식 (${w})`);
      if (typeof it.ko !== 'string' || (it.ko.match(/\*\*/g) || []).length !== 2) errors.push(`${at}: ko에 **강조** 1쌍`);
      for (const [k, a] of (it.alts ?? []).entries()) {
        if (typeof a?.w !== 'string' || !a.w.trim() || !['ok', 'near', 'wrong'].includes(a.t) || typeof a.m !== 'string' || a.m.length > 100)
          errors.push(`${at} alt#${k + 1}: w/t/m 형식`);
        else if (a.w.trim().toLowerCase() === it.answer?.trim().toLowerCase()) errors.push(`${at} alt#${k + 1}: 정답과 같음`);
      }
    }
    for (const id of pids) if ((perPattern.get(id) ?? 0) < 2) errors.push(`${file}: pattern ${id} 문제가 2개 미만`);
  }
  return { errors, items, patterns };
}

// ---------------- 실전 회화 ----------------
const normT = (s) => s.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
export function validateTalk(packs) {
  const errors = [];
  const ids = new Set();
  let episodes = 0;
  let lines = 0;
  for (const { file, text } of packs) {
    let d;
    try {
      d = JSON.parse(text);
    } catch (e) {
      errors.push(`${file}: JSON 파싱 실패 (${e.message})`);
      continue;
    }
    const s = d.story;
    if (!s || !/^[a-z0-9-]+$/.test(s.id ?? '') || !s.title || !s.subtitle || !s.category || !/^(A1|A2|B1|B2|C1|C2)$/.test(s.cefr ?? '') || !s.scene)
      errors.push(`${file}: story(id,title,subtitle,category,cefr,scene) 오류`);
    for (const [ei, ep] of (d.episodes ?? []).entries()) {
      episodes++;
      const eat = `${file} ep#${ei + 1} (${ep?.id})`;
      if (typeof ep.id !== 'string' || ids.has(ep.id)) errors.push(`${eat}: id 누락/중복`);
      ids.add(ep.id);
      for (const k of ['title', 'mission', 'partner']) if (typeof ep[k] !== 'string' || !ep[k]) errors.push(`${eat}: ${k} 누락`);
      const me = (ep.lines ?? []).filter((l) => l.who === 'me');
      if (me.length < 4) errors.push(`${eat}: 내 대사는 4개 이상`);
      for (const [li, l] of (ep.lines ?? []).entries()) {
        const lat = `${eat} line#${li + 1}`;
        if (l.who === 'npc') {
          if (typeof l.en !== 'string' || typeof l.ko !== 'string') errors.push(`${lat}: npc는 en, ko`);
          continue;
        }
        if (l.who !== 'me') {
          errors.push(`${lat}: who는 npc/me`);
          continue;
        }
        lines++;
        for (const k of ['ko', 'answer', 'hint']) if (typeof l[k] !== 'string' || !l[k]) errors.push(`${lat}: ${k} 누락`);
        if (!Array.isArray(l.accept) || l.accept.length < 1) errors.push(`${lat}: accept 1개 이상`);
        if (!Array.isArray(l.keys) || l.keys.length < 1 || l.keys.length > 3) errors.push(`${lat}: keys 1~3개`);
        else
          for (const [ki, k] of l.keys.entries()) {
            if (typeof k?.k !== 'string' || typeof k?.tip !== 'string') {
              errors.push(`${lat} key#${ki + 1}: k, tip`);
              continue;
            }
            const vars = k.k.split('|').map(normT);
            for (const sent of [l.answer, ...(l.accept ?? [])]) {
              const n = ` ${normT(sent ?? '')} `;
              if (!vars.some((v) => n.includes(` ${v} `))) errors.push(`${lat} key#${ki + 1}: '${k.k}'가 문장에 없음 → ${sent}`);
            }
          }
        for (const [wi, w] of (l.words ?? []).entries()) if (typeof w?.ko !== 'string' || typeof w?.en !== 'string' || !l.ko.includes(w.ko)) errors.push(`${lat} word#${wi + 1}: ko는 대사 안의 말`);
        if (l.expr && (typeof l.expr.en !== 'string' || typeof l.expr.ko !== 'string' || typeof l.expr.note !== 'string')) errors.push(`${lat}: expr 형식`);
      }
    }
  }
  return { errors, episodes, lines };
}
