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

export interface WordSentence {
  /** 빈칸은 ___ (밑줄 3개) 하나 */
  en: string;
  /** 정답에 해당하는 뜻은 **굵게** */
  ko: string;
  /** 빈칸에 들어갈 정확한 형태 */
  answer: string;
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
}

export interface DailyRow {
  date: string;
  total: number;
  newWords: number;
  reviews: number;
  correct: number;
  timeMs: number;
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

export interface Settings {
  level: number | null;
  dailyGoal: number;
  inputMode: 'keyboard' | 'voice';
  blankMatchesLength: boolean;
  liveHint: boolean;
  autoSpeak: boolean;
  newWordDifficulty: 'easy' | 'normal' | 'hard';
  questionsPerRound: number;
}
