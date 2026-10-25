import { isNativeApp, nativeRecognizeOnce } from './nativeSpeech';
import { ttsVolume, voicePref } from './sfx';
interface RecognitionResultLike {
  length: number;
  [index: number]: { transcript: string };
}
interface RecognitionEventLike {
  results: { [index: number]: RecognitionResultLike };
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function ctor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognize(): boolean {
  if (isNativeApp()) return true;
  return !!ctor();
}

/** 한 번 듣고 인식 후보 문장들을 돌려준다. 실패 시 Error(message=에러 코드) */
const LISTEN_TIMEOUT_MS = 7000;

export function recognizeOnce(lang = 'en-US'): Promise<string[]> {
  if (isNativeApp()) return nativeRecognizeOnce(lang, LISTEN_TIMEOUT_MS);
  return new Promise((resolve, reject) => {
    const C = ctor();
    if (!C) {
      reject(new Error('unsupported'));
      return;
    }
    const r = new C();
    r.lang = lang;
    r.interimResults = false;
    r.maxAlternatives = 5;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      reject(new Error('no-speech'));
    }, LISTEN_TIMEOUT_MS);
    r.onresult = (e) => {
      window.clearTimeout(timer);
      settled = true;
      const res = e.results[0];
      const alts: string[] = [];
      for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      resolve(alts);
    };
    r.onerror = (e) => {
      window.clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new Error(e.error ?? 'error'));
    };
    r.onend = () => {
      window.clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(new Error('no-speech'));
    };
    try {
      r.start();
    } catch (e) {
      settled = true;
      reject(e instanceof Error ? e : new Error('error'));
    }
  });
}

export function voiceErrorMessage(e: unknown): string {
  const code = e instanceof Error ? e.message : '';
  if (code === 'no-speech') return '음성이 들리지 않았어요. 다시 말해 보세요.';
  if (code === 'not-allowed' || code === 'service-not-allowed') return '마이크 권한을 허용해 주세요.';
  if (code === 'unsupported') return '이 브라우저는 음성 인식을 지원하지 않아요.';
  return '음성 인식에 실패했어요. 다시 시도해 주세요.';
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 폰 내장 음성으로 읽기. slow=듣기평가 속도, factor=추가 배속(0.5, 0.8) */
export function speak(text: string, slow = false, factor = 1, onEnd?: () => void): void {
  if (!canSpeak()) {
    onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const u = makeUtterance(text);
    u.lang = 'en-US';
    u.rate = (slow ? 0.72 : 0.98) * factor;
    if (onEnd) u.onend = () => onEnd();
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    window.speechSynthesis.speak(u);
  } catch {
    /* 음성 재생 실패는 무시 */
  }
}

const FEMALE = /female|woman|girl|tpf|sfg|iog|iob|zira|aria|jenny|samantha|karen|moira|tessa|fiona|libby|sonia|ana|emma|olivia/i;
const MALE = /male|man|tpd|iom|iol|tpc|david|mark|guy|ryan|daniel|oliver|fred|alex|george|thomas|arthur/i;

/** 설정의 발음(미국식/영국식)·성별에 맞는 폰 내장 영어 음성 고르기 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const { accent, gender } = voicePref();
  const want = accent === 'uk' ? 'en-GB' : 'en-US';
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-');
  let pool = voices.filter((v) => norm(v).startsWith(want));
  if (!pool.length) pool = voices.filter((v) => norm(v).startsWith('en'));
  if (!pool.length) return undefined;
  if (gender !== 'random') {
    const re = gender === 'female' ? FEMALE : MALE;
    const other = gender === 'female' ? MALE : FEMALE;
    const hit = pool.find((v) => re.test(v.name) && !other.test(v.name)) ?? pool.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return pool[0];
}

function makeUtterance(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.volume = ttsVolume();
  return u;
}
