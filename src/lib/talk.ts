import { db } from '../db';
import type { Settings, TalkLine, TalkStory } from '../types';

export const normTalk = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const words = (s: string) => normTalk(s).split(' ').filter(Boolean);

/** 단어 겹침 F1 */
export function overlap(user: string, target: string): number {
  const u = words(user);
  const t = words(target);
  if (!u.length || !t.length) return 0;
  const pool = [...t];
  let hit = 0;
  for (const w of u) {
    const i = pool.indexOf(w);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  if (!hit) return 0;
  const p = hit / u.length;
  const r = hit / t.length;
  return (2 * p * r) / (p + r);
}

export function keyMatched(user: string, k: string): boolean {
  const n = ` ${normTalk(user)} `;
  return k.split('|').some((v) => n.includes(` ${normTalk(v)} `));
}

export interface TalkGrade {
  stars: 0 | 1 | 2 | 3;
  label: 'Perfect!!' | 'Great!' | 'Good!' | 'Nice Try!';
  tone: 'green' | 'yellow' | 'red';
  feedback: string;
  similarity: number;
}

const LENIENT: Record<Settings['talkLevel'], number> = { A1: 0.42, A2: 0.46, B1: 0.52, B2: 0.56, C1: 0.6, C2: 0.64 };

/** AI 없이 채점: 핵심 표현 포함 여부 + 모범 답안/허용 답안과의 단어 겹침 */
export function gradeTalk(user: string, line: TalkLine, level: Settings['talkLevel'] = 'B1'): TalkGrade {
  const targets = [line.answer ?? '', ...(line.accept ?? [])];
  const sim = Math.max(...targets.map((t) => overlap(user, t)));
  const keys = line.keys ?? [];
  const missing = keys.filter((k) => !keyMatched(user, k.k));
  const cov = keys.length ? (keys.length - missing.length) / keys.length : 1;
  const need = LENIENT[level] ?? 0.52;
  let stars: TalkGrade['stars'];
  if (!words(user).length) stars = 0;
  else if (cov === 1 && sim >= need) stars = 3;
  else if (cov === 1 && sim >= need - 0.22) stars = 2;
  else if (cov >= 0.5 && sim >= need - 0.15) stars = 1;
  else stars = 0;
  const label = (['Nice Try!', 'Good!', 'Great!', 'Perfect!!'] as const)[stars];
  let feedback: string;
  let tone: TalkGrade['tone'];
  if (stars === 3) {
    tone = 'green';
    feedback = sim > 0.95 ? '완벽해요! 모범 답안과 똑같이 말했어요.' : '완벽해요! 핵심 표현을 모두 살려서 자연스럽게 말했어요.';
  } else if (stars === 2) {
    tone = 'green';
    feedback = '좋아요! 뜻은 잘 전달돼요. 모범 답안과 비교해서 더 자연스러운 표현을 익혀 보세요.';
  } else if (stars === 1) {
    tone = 'yellow';
    feedback = missing.length ? missing.map((m) => m.tip).join(' ') : '조금 아쉬워요. 모범 답안처럼 문장을 다듬어 보세요.';
  } else {
    tone = 'red';
    feedback = missing.length ? missing.map((m) => m.tip).join(' ') : '뜻이 잘 전달되지 않아요. 힌트를 보고 다시 말해 보세요.';
  }
  return { stars, label, tone, feedback, similarity: sim };
}

export function gradeLetter(avgStars: number): 'S' | 'A' | 'B' | 'C' {
  if (avgStars >= 2.7) return 'S';
  if (avgStars >= 2.2) return 'A';
  if (avgStars >= 1.5) return 'B';
  return 'C';
}

export interface EpisodeProgress {
  grade?: 'S' | 'A' | 'B' | 'C';
  best?: number;
  /** 내 대사 index → 별 */
  stars?: Record<number, number>;
  /** 진행 중인 줄 */
  at?: number;
  done?: boolean;
  ts?: number;
}
export type TalkProgress = Record<string, EpisodeProgress>;

export async function getTalkProgress(): Promise<TalkProgress> {
  return ((await db.kv.get('talkProgress'))?.value as TalkProgress | undefined) ?? {};
}

export async function saveEpisode(id: string, patch: EpisodeProgress): Promise<void> {
  const all = await getTalkProgress();
  await db.kv.put({ key: 'talkProgress', value: { ...all, [id]: { ...all[id], ...patch, ts: Date.now() } } });
}

/** 스토리에서 다음에 할 에피소드 (완료 안 한 첫 에피소드) */
export function currentEpisode(story: TalkStory, prog: TalkProgress): number {
  const i = story.episodes.findIndex((e) => !prog[e.id]?.done);
  return i < 0 ? story.episodes.length - 1 : i;
}

export function unlocked(story: TalkStory, prog: TalkProgress, idx: number): boolean {
  return idx === 0 || !!prog[story.episodes[idx - 1].id]?.done;
}

export interface ReviewPick {
  story: TalkStory;
  epIdx: number;
  lineIdx: number;
  line: TalkLine;
}

/** 문장 복습 추천: 별이 가장 적었던 내 대사 */
/** 결과 화면에서 '복습에 추가하기'로 표시한 대사 (`${episodeId}:${lineIdx}`) */
export async function getTalkReviewMarks(): Promise<string[]> {
  return ((await db.kv.get('talkReviewMarks'))?.value as string[] | undefined) ?? [];
}

export async function toggleTalkReview(key: string): Promise<void> {
  const cur = await getTalkReviewMarks();
  await db.kv.put({ key: 'talkReviewMarks', value: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] });
}

export function pickReview(stories: TalkStory[], prog: TalkProgress, marks: string[] = []): ReviewPick | null {
  for (const key of marks) {
    const [epId, idx] = key.split(':');
    for (const story of stories) {
      const epIdx = story.episodes.findIndex((e) => e.id === epId);
      const line = story.episodes[epIdx]?.lines[Number(idx)];
      if (epIdx >= 0 && line?.who === 'me') return { story, epIdx, lineIdx: Number(idx), line };
    }
  }
  let best: ReviewPick | null = null;
  let bestStars = 4;
  for (const story of stories) {
    story.episodes.forEach((ep, epIdx) => {
      const st = prog[ep.id]?.stars ?? {};
      for (const [k, v] of Object.entries(st)) {
        const lineIdx = Number(k);
        if (v < bestStars && ep.lines[lineIdx]?.who === 'me') {
          bestStars = v;
          best = { story, epIdx, lineIdx, line: ep.lines[lineIdx] };
        }
      }
    });
  }
  return bestStars <= 2 ? best : null;
}

export const CEFR: { id: Settings['talkLevel']; desc: string }[] = [
  { id: 'A1', desc: '기초적인 문장을 이해하고 사용할 수 있어요. 간단한 질문에 답할 수 있어요.' },
  { id: 'A2', desc: '일상 생활에 필요한 표현을 이해하고 사용할 수 있어요. 단순한 주제에 대해 간단한 대화를 나눌 수 있어요.' },
  { id: 'B1', desc: '일, 학교, 취미 등 익숙한 주제에 대해 대화를 이어갈 수 있어요. 문장을 연결하여 이야기할 수 있어요.' },
  { id: 'B2', desc: '복잡한 주제의 대화 내용을 이해하고 참여할 수 있어요. 자신의 의견을 논리적으로 표현하며 토론할 수 있어요.' },
  { id: 'C1', desc: '다양한 주제에 대해 유창하고 자연스럽게 말할 수 있어요. 미묘한 뉘앙스까지 표현할 수 있어요.' },
  { id: 'C2', desc: '원어민에 가까운 수준으로 거의 모든 상황에서 정확하고 세련되게 표현할 수 있어요.' },
];
