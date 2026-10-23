export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z'\- ]/g, '')
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

/** 음성 인식 결과(후보 여러 개) 중 정답 단어가 들어 있는지 */
export function containsAnswer(transcripts: string[], answer: string, word: string): boolean {
  const a = normalize(answer);
  const w = normalize(word);
  return transcripts.some((t) => {
    const n = ` ${normalize(t)} `;
    return n.includes(` ${a} `) || n.includes(` ${w} `) || n.replace(/ /g, '') === a.replace(/ /g, '');
  });
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
