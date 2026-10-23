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
  sentenceIdx?: number;
  wrongs?: WrongNote[];
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
}
