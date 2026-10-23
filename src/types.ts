export type Pos = 'n' | 'v' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron' | 'det' | 'num' | 'interj' | 'phr';

export const POS_KO: Record<Pos, string> = {
  n: '명사',
  v: '동사',
  adj: '형용사',
  adv: '부사',
  prep: '전치사',
  conj: '접속사',
  pron: '대명사',
  det: '한정사',
  num: '수사',
  interj: '감탄사',
  phr: '표현',
};

/** 오답 설명: ok=정답으로 인정되는 유의어(초록), near=비슷하지만 정답이 아닌 말(노랑), wrong=오답(빨강) */
export interface Alt {
  w: string;
  t: 'ok' | 'near' | 'wrong';
  m: string;
}

export interface WordSentence {
  /** 빈칸은 ___ (밑줄 3개). 1개이거나 answer 단어 수만큼 */
  en: string;
  /** 정답에 해당하는 뜻은 **굵게** */
  ko: string;
  /** 빈칸에 들어갈 정확한 형태 */
  answer: string;
  /** 한국어 문장 위에 작게 보이는 상황 설명 */
  ctx?: string;
  /** 뜻 구분 메모 (※ 로 표시) */
  note?: string;
  alts?: Alt[];
}

export interface WordEntry {
  id: string;
  word: string;
  pos: Pos;
  level: number;
  meanings: string[];
  sentences: WordSentence[];
  nuance?: string;
  etymology?: string;
  tags?: string[];
}

export interface StoredWord extends WordEntry {
  pack: string;
}

/** ts-fsrs Card 필드 + 식별자 */
export interface CardRow {
  wordId: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: Date;
  /** 처음 본 순간 힌트 없이 맞혀 '이미 아는 단어'로 분류됨 */
  known?: boolean;
}

export type Tone = 'green' | 'yellow' | 'red';

export interface WrongNote {
  w: string;
  tone: Tone;
  m: string;
}

export interface ReviewRow {
  id?: number;
  wordId: string;
  ts: number;
  studyDate: string;
  rating: number;
  firstTry: boolean;
  hints: number;
  showedAnswer: boolean;
  wrongAttempts: number;
  mode: 'keyboard' | 'voice';
  elapsedMs: number;
  isNew: boolean;
  isTest?: boolean;
  /** 어휘 외 학습 모드 (없으면 어휘) */
  studyMode?: StudyMode;
  sentenceIdx?: number;
  wrongs?: WrongNote[];
}

export type StudyMode = 'vocab' | 'grammar' | 'listening' | 'pairs' | 'expr' | 'talk';

export interface ModeDay {
  total: number;
  newItems: number;
  reviews: number;
  correct: number;
  timeMs: number;
}

/** 문법·리스닝 등 어휘 외 모드의 복습 카드 (FSRS) */
export interface MCardRow {
  /** `${mode}:${itemId}` */
  id: string;
  mode: StudyMode;
  itemId: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: Date;
}

export interface BookmarkRow {
  /** `${mode}:${itemId}` */
  key: string;
  mode: StudyMode;
  itemId: string;
  ts: number;
}

export interface LessonBlock {
  t: 'p' | 'ex' | 'tip' | 'chunks' | 'h';
  text?: string;
  en?: string;
  ko?: string;
  hl?: string;
  parts?: { text: string; label?: string }[];
}

export interface GrammarTopic {
  id: string;
  /** "16-2" */
  level: string;
  levelNum: number;
  title: string;
  category: string;
  lesson: { summary: string; blocks: LessonBlock[] };
  pack: string;
  order: number;
}

export interface GrammarSentence {
  id: string;
  topic: string;
  ko: string;
  en: string;
  distractors: string[];
  alts?: { en: string; note: string }[];
  levelNum: number;
  pack: string;
}

export interface ExprCourse {
  id: string;
  title: string;
  group: string;
  stars: number;
  icon?: string;
  order: number;
  pack: string;
}

export interface ExprPattern {
  /** `${course}:${id}` */
  key: string;
  id: string;
  course: string;
  ko: string;
  en: string;
  meaning: string;
  note: string;
  order: number;
}

export interface ExprItem {
  id: string;
  course: string;
  /** 패턴 key (`${course}:${pattern}`) */
  pkey: string;
  partner: { en: string; ko: string };
  en: string;
  answer: string;
  ko: string;
  alts?: Alt[];
  order: number;
}

export interface TalkKey {
  k: string;
  tip: string;
}

export interface TalkLine {
  who: 'npc' | 'me';
  en?: string;
  ko: string;
  answer?: string;
  accept?: string[];
  keys?: TalkKey[];
  hint?: string;
  words?: { ko: string; en: string }[];
  expr?: { en: string; ko: string; note: string };
}

export interface TalkEpisode {
  id: string;
  title: string;
  partner: string;
  mission: string;
  lines: TalkLine[];
}

export interface TalkStory {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  cefr: string;
  scene: string;
  episodes: TalkEpisode[];
  pack: string;
  order: number;
}

export interface DailyRow {
  date: string;
  total: number;
  newWords: number;
  reviews: number;
  correct: number;
  timeMs: number;
  /** 새 단어 중 처음부터 알던 단어 수 */
  knownNew?: number;
  /** 그날의 하루 목표 (트로피 판정용) */
  goal?: number;
  /** 어휘 외 모드별 기록 */
  byMode?: Partial<Record<StudyMode, ModeDay>>;
}

export interface PackRow {
  file: string;
  hash: string;
  count: number;
  updatedAt: number;
}

export interface KvRow {
  key: string;
  value: unknown;
}

export interface FavoriteRow {
  /** `${wordId}#${sentenceIdx}` */
  key: string;
  wordId: string;
  sentenceIdx: number;
  ts: number;
}

export interface Settings {
  level: number | null;
  dailyGoal: number;
  inputMode: 'keyboard' | 'voice';
  blankMatchesLength: boolean;
  /** 정답을 다 입력하면 확인 없이 바로 채점 */
  autoCheck: boolean;
  /** 정답 후 문장 읽어주기 */
  autoSpeak: boolean;
  speechRate: 'real' | 'slow';
  newWordDifficulty: 'easy' | 'normal' | 'hard';
  /** 다크 모드: 시스템 설정 따르기 / 켜기 / 끄기 */
  theme: 'system' | 'dark' | 'light';
  /** 홈 왼쪽 위에 보이는 이름 */
  nickname: string;
  grammarGoal: number;
  grammarLevel: number | null;
  listeningGoal: number;
  listeningLevel: number | null;
  listeningMode: 'mc' | 'subjective';
  listeningInput: 'voice' | 'keyboard';
  listeningSpeed: 'real' | 'slow';
  /** 학습 화면 배경 테마 */
  studyTheme: 'sky' | 'dino';
  /** 홈 메인 카드에 보이는 학습 모드 */
  homeMode: StudyMode;
  exprGoal: number;
  exprCourse: string | null;
  talkGoal: number;
  talkLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  talkInput: 'voice' | 'keyboard';
}

/** 말해보카에서 옮겨온 학습 기록 (public/data/progress.json) */
export interface ImportedProgress {
  source: string;
  /** 기록을 읽은 날 (YYYY-MM-DD) */
  asOf: string;
  streak?: { days: number; asOf: string };
  levels?: { vocab?: number; grammar?: number; listening?: number };
  vocabSize?: number;
  /** 대한민국 상위 N% */
  percentile?: number;
  vocabHistory?: { date: string; vocab: number; level?: number }[];
  learnedCount?: number;
  learnedWords?: string[];
  /** 날짜별(YYYY-MM-DD) 학습한 단어 */
  learnedDays?: Record<string, string[]>;
  stats?: Partial<Record<StudyMode, { trophies?: number; questions?: number; timeMs?: number }>>;
  notes?: string[];
}
