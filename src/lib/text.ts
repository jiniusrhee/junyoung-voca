import type { Alt, Tone, WordSentence } from '../types';

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z'\- ]/g, '')
    // 하이픈 단어는 칸마다 따로 치므로 "up and coming" 도 "up-and-coming" 으로 본다 (말해보카)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export type Verdict = 'correct' | 'close' | 'wrong';

export interface Judgement {
  verdict: Verdict;
  distance: number;
  /** 뜻은 맞지만 문장에 맞는 형태(과거형 등)가 아님 */
  baseForm: boolean;
}

export function judge(input: string, answer: string, word: string): Judgement {
  const i = normalize(input);
  const a = normalize(answer);
  const w = normalize(word);
  if (!i) return { verdict: 'wrong', distance: a.length, baseForm: false };
  if (i === a) return { verdict: 'correct', distance: 0, baseForm: false };
  if (i === w) return { verdict: 'close', distance: levenshtein(i, a), baseForm: true };
  const d = levenshtein(i, a);
  const tolerance = a.length >= 8 ? 2 : 1;
  return { verdict: d <= tolerance ? 'close' : 'wrong', distance: d, baseForm: false };
}

export type Evaluation =
  | { kind: 'correct' }
  | { kind: 'alt'; alt: Alt }
  | { kind: 'form' }
  | { kind: 'typo'; distance: number; mask: { text: string; bad: boolean }[] }
  | { kind: 'wrong' };

/** 입력을 정답·오답 설명(alts)과 비교 */
export function evaluate(input: string, sentence: WordSentence, word: string): Evaluation {
  const i = normalize(input);
  const a = normalize(sentence.answer);
  if (!i) return { kind: 'wrong' };
  if (i === a) return { kind: 'correct' };
  const alt = sentence.alts?.find((x) => normalize(x.w) === i);
  if (alt) return { kind: 'alt', alt };
  if (i === normalize(word)) return { kind: 'form' };
  const d = levenshtein(i, a);
  if (d <= (a.length >= 8 ? 2 : 1)) return { kind: 'typo', distance: d, mask: typoMask(input.trim(), sentence.answer) };
  return { kind: 'wrong' };
}

export interface FeedbackMsg {
  tone: Tone;
  msg: string;
  /** 정답으로 인정되는 유의어라 감점하지 않음 */
  bonus: boolean;
  /** 오타일 때: 입력 글자를 정답과 맞춰 본 결과 (다른 자리는 bad) */
  mask?: { text: string; bad: boolean }[];
}

/** 오타 표시: 정답과 글자를 맞춰 보고, 다른 자리는 '_'(빠짐)나 빨간 글자로 (말해보카 'relocat_d - 정답과 1글자 달라요') */
export function typoMask(input: string, answer: string): { text: string; bad: boolean }[] {
  const a = input;
  const b = answer;
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  const out: { text: string; bad: boolean }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)) {
      out.unshift({ text: a[i - 1], bad: a[i - 1].toLowerCase() !== b[j - 1].toLowerCase() });
      i--;
      j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      out.unshift({ text: '_', bad: true }); // 빠진 글자
      j--;
    } else {
      out.unshift({ text: a[i - 1], bad: true }); // 남는 글자
      i--;
    }
  }
  // 이어진 조각 합치기
  const merged: { text: string; bad: boolean }[] = [];
  for (const seg of out) {
    const last = merged[merged.length - 1];
    if (last && last.bad === seg.bad) last.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}

const ALT_TONE: Record<Alt['t'], Tone> = { ok: 'green', near: 'yellow', wrong: 'red' };

export function feedbackFor(e: Exclude<Evaluation, { kind: 'correct' }>): FeedbackMsg {
  switch (e.kind) {
    case 'alt':
      return { tone: ALT_TONE[e.alt.t], msg: e.alt.m, bonus: e.alt.t === 'ok' };
    case 'form':
      return { tone: 'yellow', msg: '뜻은 맞아요! 문장에 맞는 형태로 바꿔 보세요.', bonus: false };
    case 'typo':
      return { tone: 'info', msg: `정답과 ${e.distance}글자 달라요.`, bonus: false, mask: e.mask };
    default:
      return { tone: 'red', msg: '다시 생각해 보세요. 한글 뜻에 맞는 단어는 뭘까요?', bonus: false };
  }
}

export const SHOW_ANSWER_MSG = '정답을 확인하고, 다시 입력해보세요.';

/** 1단계 힌트로 보여줄 앞부분: 말해보카는 길이와 상관없이 앞 2글자 (6·9·12글자 모두 2글자 — 2026-11-08 플립 실측). 짧은 단어는 1글자 */
export function hintPrefix(answer: string): string {
  return answer.slice(0, Math.min(2, Math.max(1, answer.length - 1)));
}

/** 음성 인식 결과(후보 여러 개) 중 정답 단어가 들어 있는지 */
export function containsAnswer(transcripts: string[], answer: string, word: string): boolean {
  const a = normalize(answer);
  const w = normalize(word);
  return transcripts.some((t) => {
    const n = ` ${normalize(t)} `;
    return n.includes(` ${a} `) || n.includes(` ${w} `) || n.replace(/ /g, '') === a.replace(/ /g, '');
  });
}

/** 말해보기: 문장 단어 중 몇 %를 말했는지 */
export function speechMatchRate(transcript: string, sentence: string): number {
  const target = normalize(sentence).split(' ').filter(Boolean);
  const said = normalize(transcript).split(' ').filter(Boolean);
  if (!target.length) return 0;
  const pool = [...said];
  let hit = 0;
  for (const t of target) {
    const k = pool.indexOf(t);
    if (k >= 0) {
      hit++;
      pool.splice(k, 1);
    }
  }
  return hit / target.length;
}

export interface Segment {
  text: string;
  bold: boolean;
}

/** "그녀는 **이루기** 위해" → 굵게 표시할 구간 분리 */
export function splitBold(ko: string): Segment[] {
  return ko
    .split('**')
    .map((text, idx) => ({ text, bold: idx % 2 === 1 }))
    .filter((s) => s.text.length > 0);
}

export function splitBlank(en: string): [string, string] {
  const idx = en.indexOf('___');
  if (idx < 0) return [en, ''];
  return [en.slice(0, idx), en.slice(idx + 3)];
}

/** 정답을 칸 단위로 나눈다. 공백뿐 아니라 하이픈도 칸을 나눈다 ("up-and-coming" → up / and / coming, 말해보카) */
export function answerWords(answer: string): string[] {
  return answer.trim().split(/[\s-]+/).filter(Boolean);
}

/** 칸과 칸 사이에 보여줄 구분 글자: 하이픈 단어는 '-', 아니면 ' ' */
export function answerSeparators(answer: string): string[] {
  return (answer.trim().match(/[\s-]+/g) ?? []).map((sep) => (sep.includes('-') ? '-' : ' '));
}

export type SentenceSeg = { kind: 'text'; text: string } | { kind: 'blank'; idx: number };

/** 영어 문장을 글자 구간과 빈칸(정답 단어 하나당 한 칸)으로 나눈다 */
export function layoutSentence(en: string, answer: string): SentenceSeg[] {
  const words = answerWords(answer);
  const seps = answerSeparators(answer);
  const parts = en.split('___');
  const blanks = parts.length - 1;
  const segs: SentenceSeg[] = [];
  let w = 0;
  parts.forEach((p, i) => {
    if (p) segs.push({ kind: 'text', text: p });
    if (i >= blanks) return;
    if (blanks === 1) {
      words.forEach((_, k) => {
        if (k > 0) segs.push({ kind: 'text', text: seps[k - 1] ?? ' ' });
        segs.push({ kind: 'blank', idx: w++ });
      });
    } else {
      segs.push({ kind: 'blank', idx: w++ });
    }
  });
  return segs;
}

/** 입력을 빈칸 수만큼 공백 기준으로 나눈다 (남는 단어는 마지막 칸에) */
export function splitInput(input: string, count: number): string[] {
  const parts = input.replace(/^\s+/, '').split(' ');
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(i < count - 1 ? (parts[i] ?? '') : parts.slice(i).join(' '));
  return out;
}

/** 빈칸에 정답을 채운 완성 문장 */
export function fullSentence(en: string, answer: string): string {
  const words = answerWords(answer);
  const parts = en.split('___');
  if (parts.length - 1 === 1) return parts[0] + answer + parts[1];
  return parts.reduce((acc, p, i) => acc + p + (i < parts.length - 1 ? (words[i] ?? '') : ''), '');
}
