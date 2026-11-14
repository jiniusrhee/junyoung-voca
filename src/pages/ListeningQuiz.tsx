import { useLiveQuery } from 'dexie-react-hooks';
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel, { type MoreAction, type PanelTool } from '../components/AfterPanel';
import Keyboard from '../components/Keyboard';
import KoText from '../components/KoText';
import Mascot from '../components/Mascot';
import Pterodactyls from '../components/Pterodactyls';
import { QKeyboard, QMic, QReveal } from '../components/QuizIcons';
import { QuizScene, QuizTop } from '../components/QuizShell';
import { db } from '../db';
import {
  ListenPicker,
  MAX_LISTENS,
  RESULT_TEXT,
  listenProgress,
  listenWords,
  mcOrder,
  nextListenLevel,
  resultFor,
  spokenMatch,
  typedMatch,
  type ListenItem,
  type ListenQuestion,
  type ListenResult,
  type ListenWord,
} from '../lib/listening';
import { listenTips, type ListenTip } from '../lib/listenTips';
import { cardId, modeToday, recordModeAnswer, toggleBookmark } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { sfx } from '../lib/sfx';
import { canRecognize, recognizeOnce, speak, stopSpeaking, voiceErrorMessage } from '../lib/speech';
import { useNavBarColor, useStatusBarColor } from '../lib/statusBar';
import { speechMatchRate } from '../lib/text';
import { POS_KO, type StoredWord } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty';
type Flash = { key: number } | null;
type Zone = 'mc' | 'kb' | 'voice';

/** 객관식 보기 한 칸. word = 낱말 번호(null 이면 빈 칸), bad = 틀려서 붉은 칸, hit = 방금 맞혀 초록으로 번쩍이는 중(곧 next 로 바뀐다) */
interface Slot {
  word: number | null;
  bad: boolean;
  hit: boolean;
  next?: number | null;
}

/** 화면에 그릴 카드 한 장 (지금 문제, 또는 '다음 문제'로 빠져나가는 중인 지난 문제) */
interface CardView {
  item: ListenItem;
  words: ListenWord[];
  /** 채워진 낱말 수 */
  done: number;
  /** 틀린 적이 있어 흰색으로 보이는 낱말 */
  white: Set<number>;
  answered: boolean;
  /** 카드 위의 결과 글자 (Perfect!!! 등). 아직 안 떴으면 null */
  banner: ListenResult | null;
  /** 한국어 뜻이 보이는가 (다시 듣기를 다 썼거나 정답 뒤) */
  showKo: boolean;
  /** 초록 막대가 찬 비율 */
  fill: number;
  flash: Flash;
  /** 정답 보기: 이 번호부터의 낱말이 차례로 나타난다 */
  reveal: number | null;
  /** 정답 뒤 초록 밑줄이 그어진 낱말 수 */
  sung: number;
  tips: ListenTip[];
  /** 펼쳐진 TIP 번호 */
  tipOpen: number | null;
  /** TIP 단추가 보이는가 (패널이 올라온 뒤) */
  tipBtn: boolean;
  /** TIP 을 한 번 펼친 뒤에는 흰 낱말도 초록으로 보인다 (말해보카) */
  allGreen: boolean;
  /** 뜻 팝업이 뜬 낱말 */
  pop: number | null;
}

/** 다시 듣기 남은 횟수의 점 색 (플립 실측): 3번 남음 초록 · 2번 노랑 · 1번 주황, 쓴 자리는 빈 고리 */
function dotTones(listens: number): ('g' | 'y' | 'o' | 'x')[] {
  const left = Math.max(0, MAX_LISTENS + 1 - listens);
  const tone = left >= 3 ? 'g' : left === 2 ? 'y' : 'o';
  return [0, 1, 2].map((i) => (i < left ? tone : 'x'));
}

/** 사전에서 문장 속 낱말 찾기: 그대로 → 흔한 어미를 뗀 꼴 */
function lookup(dict: Map<string, StoredWord> | undefined, raw: string): StoredWord | null {
  if (!dict) return null;
  const w = raw.toLowerCase().replace(/[^a-z'-]/g, '');
  const tries = [w, w.replace(/'s$|s'$/, ''), w.replace(/ies$/, 'y'), w.replace(/es$/, ''), w.replace(/s$/, ''), w.replace(/ied$/, 'y'), w.replace(/ed$/, ''), w.replace(/d$/, ''), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/(.)\1ing$/, '$1'), w.replace(/(.)\1ed$/, '$1'), w.replace(/er$/, ''), w.replace(/est$/, ''), w.replace(/ly$/, '')];
  for (const t of tries) {
    const hit = t && dict.get(t);
    if (hit) return hit;
  }
  return null;
}

/**
 * 리스닝 학습 — 말해보카 플립 실측(2026-11-14)으로 다시 만듦. 어휘 퀴즈와 같은 틀(머리줄·풍경·카드·정답 패널)을 쓴다.
 *
 * 카드: 위 칸에 가려진 뜻(둥근 막대 — 맞힌 만큼 초록으로 찬다), 아래 칸에 문장 줄 폭만큼의 밑줄.
 * 주관식 · 키보드: 도구줄 가운데 입력 칸. 낱말을 다 치는 순간 그 낱말이 카드로 날아가 초록으로 놓이고 칸이 비워진다(띄어쓰기 · 확인은 필요 없다).
 *   틀린 채로 '확인'을 누르면 카드가 붉어지고 '!' 도장. 아포스트로피는 치지 않는다.
 * 주관식 · 음성: 어휘의 음성 모드와 같은 물속 풍경 + 마이크. 왼쪽이 '다시 듣기', 오른쪽이 '키보드 모드'.
 * 객관식: 물속 풍경 위에 낱말 단추 넷 + 보라 '다시 듣기' 알약. 문장이 다 들리고 나서 낱말이 뜬다. 맞는 낱말을 누르면 초록으로 번쩍이고 낱말이 카드로 날아간다.
 *   틀리면 단추가 붉어지고(그 자리에서 처음 틀렸을 때만) 듣기 횟수를 하나 쓰며 'Listen Carefully' 와 함께 다시 들려준다. 틀린 자리의 낱말은 흰색.
 * 다시 듣기: 세 번(점 초록 셋 → 노랑 둘 → 주황 하나). 다 쓰면 뜻이 보이고 단추가 '정답 보기'로 바뀐다.
 * 결과: 한 번 듣고 Perfect!!! · 두 번 Great!! · 세 번 Good! · 뜻을 본 뒤나 정답 보기는 Nice Try. 맞히든 못 맞히든 진행 수가 오른다.
 * 정답: 0.38초 뒤 결과 글자 → 1.1초 뒤 막대가 뜻으로 바뀌고 입력 칸이 내려가며 패널이 올라옴 → 문장에 초록 밑줄이 낱말마다 그어진다.
 */
export default function ListeningQuiz() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<ListenQuestion | null>(null);
  const [done, setDone] = useState(0);
  const [white, setWhite] = useState<Set<number>>(new Set());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [listens, setListens] = useState(1);
  const [result, setResult] = useState<ListenResult | null>(null);
  const [banner, setBanner] = useState(false);
  const [count, setCount] = useState(0);
  const [startCount, setStartCount] = useState<number | null>(null);
  const [level, setLevel] = useState(10);
  const [input, setInput] = useState('');
  const [inputMode, setInputModeRaw] = useState<'voice' | 'keyboard'>('voice');
  const [modeSwitched, setModeSwitched] = useState(false);
  const [listening, setListening] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [cardKey, setCardKey] = useState(0);
  /** 문장을 들려주는 중 (객관식: 처음에는 낱말이 가려져 있고, 알약이 'Listen Carefully') */
  const [playing, setPlaying] = useState(false);
  const [firstPlay, setFirstPlay] = useState(true);
  const [touched, setTouched] = useState(false);
  const [panelReady, setPanelReady] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const [zoneLeaving, setZoneLeaving] = useState(false);
  const [exiting, setExiting] = useState<{ key: number; view: CardView } | null>(null);
  const [flights, setFlights] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [firstIn, setFirstIn] = useState(false);
  const [reveal, setReveal] = useState<number | null>(null);
  const [sung, setSung] = useState(0);
  const [tipOpen, setTipOpen] = useState<number | null>(null);
  const [tipSeen, setTipSeen] = useState(false);
  const [pop, setPop] = useState<number | null>(null);
  const pickerRef = useRef<ListenPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const queue = useRef<number[]>([]);
  const wrongAt = useRef<Set<number>>(new Set());
  const playId = useRef(0);
  const enRef = useRef<HTMLParagraphElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** 방금 채워진 낱말들이 날아올 출발 자리 */
  const flyFrom = useRef<{ idx: number; from: DOMRect; white: boolean; delay: number }[]>([]);

  const words = useMemo(() => (q ? listenWords(q.item.en) : []), [q]);
  const tips = useMemo(() => listenTips(words), [words]);
  const dict = useLiveQuery(async () => new Map((await db.words.toArray()).map((w) => [w.word.toLowerCase(), w])), []);
  const bookmarked = useLiveQuery(async () => (q ? !!(await db.bookmarks.get(cardId('listening', q.item.id))) : false), [q?.item.id]);
  const slow = settings?.listeningSpeed === 'slow';
  const mc = settings?.listeningMode !== 'subjective';
  const zone: Zone = mc ? 'mc' : inputMode === 'voice' ? 'voice' : 'kb';
  /** 히스토리 학습: 목록의 문장만 순서대로 */
  const listIds = params.get('ids')?.split(',').filter(Boolean) ?? null;
  const listTitle = params.get('title');
  const goal = listIds ? listIds.length : (settings?.listeningGoal ?? 10);
  const hinted = listens > MAX_LISTENS;

  useStatusBarColor(settings?.studyTheme === 'sky' ? '#96cbf5' : '#bbe4df', false);
  // 내비게이션 바: 자판이면 자판 바탕, 패널·음성 막대면 #252627, 객관식은 물속 맨 아래 색
  useNavBarColor(phase === 'question' || phase === 'answered' ? (phase === 'answered' && panelReady ? '#252627' : zone === 'kb' ? '#2b2c2b' : zone === 'voice' ? '#252627' : '#328593') : null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      stopSpeaking();
      document.querySelectorAll('.lq-ghost').forEach((g) => g.remove());
    },
    [],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 2650);
  };

  const setInputMode = (m: 'voice' | 'keyboard') => {
    setInputModeRaw(m);
    setModeSwitched(true);
    later(() => setModeSwitched(false), 260);
    void saveSettings({ listeningInput: m });
  };

  /** 문장(또는 그 일부)을 읽는다. 끝나면 playing 이 꺼진다 (소리를 못 내는 환경에서는 바로) */
  const play = useCallback(
    (text: string, opts: { factor?: number; forceSlow?: boolean; onEnd?: () => void } = {}) => {
      const id = ++playId.current;
      setPlaying(true);
      setSpeaking(true);
      const end = () => {
        if (playId.current !== id) return;
        setPlaying(false);
        setSpeaking(false);
        opts.onEnd?.();
      };
      speak(text, opts.forceSlow ?? slow, opts.factor ?? 1, end);
      // 음성 엔진이 끝을 알려 주지 않을 때를 대비
      later(end, Math.min(12000, 2500 + text.length * 140));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slow],
  );

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return false;
    }
    const ws = listenWords(next.item.en);
    const order = mcOrder(ws.length);
    queue.current = order.slice(4);
    wrongAt.current = new Set();
    setQ(next);
    setDone(typedMatch(ws, 0, '').take);
    setWhite(new Set());
    setSlots([0, 1, 2, 3].map((i) => ({ word: order[i] ?? null, bad: false, hit: false })));
    setListens(1);
    setResult(null);
    setBanner(false);
    setInput('');
    setNoSpeech(false);
    setFlash(null);
    setPanelReady(false);
    setMoreOpen(false);
    setReveal(null);
    setSung(0);
    setTipOpen(null);
    setTipSeen(false);
    setPop(null);
    setFirstPlay(true);
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    busy.current = false;
    setPhase('question');
    // 카드가 들어온 뒤 문장을 들려준다 (객관식은 다 들릴 때까지 낱말이 가려져 있다)
    later(() => play(next.item.en, { onEnd: () => setFirstPlay(false) }), 500);
    return true;
  }, [play]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    setInputModeRaw(settings.listeningInput === 'voice' && canRecognize() ? 'voice' : 'keyboard');
    (async () => {
      const today = listIds ? 0 : (await modeToday('listening')).total;
      setCount(today);
      setStartCount(today);
      const lv = settings.listeningLevel ?? Math.min(50, Math.round((settings.level ?? 10) * 1.4));
      setLevel(lv);
      const p = new ListenPicker(lv, listIds ? [...listIds] : null);
      await p.init();
      pickerRef.current = p;
      await load();
      // 처음 들어올 때: 아래 칸이 아래에서 올라온다 (어휘 퀴즈의 자판과 같음)
      setFirstIn(true);
      later(() => setFirstIn(false), 520);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, load]);

  /* ---------- 낱말이 카드로 날아가는 움직임 (플립 실측: 0.23초, 가는 길에 조금 커진다) ---------- */
  useLayoutEffect(() => {
    const en = enRef.current;
    const list = flyFrom.current;
    flyFrom.current = [];
    if (!en || !list.length) return;
    for (const f of list) {
      const el = en.querySelector<HTMLElement>(`[data-w="${f.idx}"]`);
      if (!el) continue;
      const to = el.getBoundingClientRect();
      if (typeof el.animate !== 'function') continue;
      el.style.visibility = 'hidden';
      const g = document.createElement('span');
      g.className = `lq-ghost${f.white ? ' wh' : ''}`;
      g.lang = 'en';
      g.textContent = el.textContent ?? '';
      g.style.left = `${to.left}px`;
      g.style.top = `${to.top}px`;
      g.style.height = `${to.height}px`;
      g.style.lineHeight = `${to.height}px`;
      document.body.appendChild(g);
      const dx = f.from.left + f.from.width / 2 - (to.left + to.width / 2);
      const dy = f.from.top + f.from.height / 2 - (to.top + to.height / 2);
      const end = () => {
        g.remove();
        el.style.visibility = '';
      };
      const a = g.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 0.35 },
          { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(1.22)`, opacity: 1, offset: 0.55 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ],
        { duration: 233, delay: f.delay, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'backwards' },
      );
      a.onfinish = end;
      a.oncancel = end;
    }
  }, [done]);

  /* ---------- 끝내기 ---------- */
  const finish = async (failed: boolean, usedListens: number) => {
    if (!q || busy.current) return;
    busy.current = true;
    const r = resultFor(usedListens, failed);
    setResult(r);
    setPhase('answered');
    setInput('');
    stopSpeaking();
    playId.current++;
    setPlaying(false);
    setSpeaking(false);
    // 정답 보기: 남은 낱말이 67ms 간격으로 차례로 나타나고 결과 글자는 바로 뜬다. 그 밖에는 0.38초 뒤.
    const left = failed ? words.length - done : 0;
    if (failed) {
      setReveal(done);
      setDone(words.length);
      setBanner(true);
    } else later(() => setBanner(true), 380);
    if (r !== 'nice') later(() => sfx('correct'), 380);
    const swapAt = failed ? Math.max(850, left * 67 + 250) : 1090;
    later(() => {
      setPanelReady(true);
      setZoneLeaving(true);
      setPanelEnter(true);
      // 입력 칸은 내려가는 움직임(kbSink)이 끝나면 치운다 — 아래 onAnimationEnd. 움직임이 꺼진 환경을 위한 대비
      later(() => setZoneLeaving(false), 400);
      later(() => setPanelEnter(false), 450);
      // 못 맞힌 문장은 TIP 이 저절로 펼쳐진다
      if (r === 'nice' && tips.length) {
        setTipOpen(0);
        setTipSeen(true);
      }
      setFlights((f) => f + 1);
    }, swapAt);
    // 초록 밑줄: 패널이 올라오고 1초쯤 뒤부터 낱말마다 67ms
    // (플립 60fps 녹화: 패널 전환 1.02초 뒤부터 4프레임에 한 낱말, 줄이 바뀌는 곳에서는 0.13초 더 쉰다)
    const tops = [...(enRef.current?.querySelectorAll<HTMLElement>('[data-w]') ?? [])].map((el) => el.offsetTop);
    let pause = 0;
    words.forEach((_, i) => {
      if (i > 0 && tops[i] != null && tops[i] !== tops[i - 1]) pause += 130;
      later(() => setSung((n) => Math.max(n, i + 1)), swapAt + 960 + i * 67 + pause);
    });
    setCount((c) => c + 1);
    try {
      const res = await recordModeAnswer(
        'listening',
        q.item.id,
        { clean: r === 'perfect', wrong: r === 'perfect' ? 0 : 1, failed: r === 'nice', elapsedMs: Date.now() - startedAt.current, hints: Math.max(0, usedListens - 1) },
        goal,
      );
      pickerRef.current?.note(q.item.id);
      if (!listIds) {
        setCount(res.total);
        const nl = nextListenLevel(level, r);
        setLevel(nl);
        if (pickerRef.current) pickerRef.current.level = nl;
        void saveSettings({ listeningLevel: nl });
        void db.kv.get('listeningBest').then((row) => {
          const best = (row?.value as number | undefined) ?? 0;
          if (nl > best) return db.kv.put({ key: 'listeningBest', value: nl });
        });
      }
    } catch (err) {
      console.error('listening finish failed', err);
      showToast('기록 중 문제가 생겼어요.');
    }
  };

  /** 낱말 take 개를 채운다 (from = 날아올 출발 자리). 다 채우면 끝 */
  const accept = (take: number, from: DOMRect | null) => {
    if (take <= 0) return;
    const d = done + take;
    if (from) for (let i = done; i < d; i++) flyFrom.current.push({ idx: i, from, white: white.has(i), delay: (i - done) * 70 });
    setDone(d);
    if (d >= words.length) void finish(false, listens);
  };

  /** 다시 듣기 (횟수를 하나 쓴다). 다 쓴 뒤에는 정답 보기 */
  const replay = () => {
    if (phase !== 'question' || busy.current || !q) return;
    setTouched(true);
    if (hinted) {
      void finish(true, listens);
      return;
    }
    setListens((n) => n + 1);
    play(q.item.en);
  };

  /* ---------- 객관식 ---------- */
  const tapSlot = (i: number, el: HTMLElement) => {
    const s = slots[i];
    if (phase !== 'question' || busy.current || !q || s.word === null || s.bad || s.hit || firstPlay) return;
    setTouched(true);
    if (words[s.word].key === words[done]?.key) {
      const fill = queue.current.shift() ?? null;
      // 붉은 칸은 모두 풀리고, 맞힌 칸은 0.17초 동안 초록으로 번쩍인 뒤 다음 낱말로 바뀐다
      setSlots((prev) => prev.map((x, k) => (k === i ? { ...x, hit: true, next: fill } : { ...x, bad: false })));
      later(() => setSlots((prev) => prev.map((x, k) => (k === i && x.hit ? { word: x.next ?? null, bad: false, hit: false } : x))), 170);
      accept(1, el.getBoundingClientRect());
      return;
    }
    // 오답: 단추가 붉어진다. 이 자리에서 처음 틀렸을 때만 듣기 횟수를 하나 쓰고 다시 들려준다
    sfx('wrong');
    setSlots((prev) => prev.map((x, k) => (k === i ? { ...x, bad: true } : x)));
    setWhite((w) => new Set(w).add(done));
    if (!wrongAt.current.has(done)) {
      wrongAt.current.add(done);
      if (!hinted) {
        setListens((n) => n + 1);
        play(q.item.en);
      }
    }
  };

  /* ---------- 주관식: 자판 ---------- */
  const onType = (next: string) => {
    if (phase !== 'question' || busy.current) return;
    const m = typedMatch(words, done, next);
    if (m.take > 0) {
      setInput(m.rest);
      accept(m.take, boxRef.current?.getBoundingClientRect() ?? null);
    } else setInput(next.slice(0, 40));
  };
  const confirm = () => {
    if (phase !== 'question' || busy.current) return;
    // 낱말은 치는 대로 채워지므로, 확인을 누를 때 남아 있는 글자는 틀린 것이다
    setFlash({ key: Date.now() });
    sfx('wrong');
  };

  /* ---------- 주관식: 음성 ---------- */
  const voiceAnswer = async () => {
    if (!q || listening || phase !== 'question' || busy.current) return;
    setNoSpeech(false);
    stopSpeaking();
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const take = Math.max(0, ...alts.map((a) => spokenMatch(words, done, a)));
      if (take > 0) accept(take, document.querySelector('.listen-quiz .vz-mic')?.getBoundingClientRect() ?? null);
      if (done + take < words.length) {
        setFlash({ key: Date.now() });
        sfx('wrong');
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'no-speech') setNoSpeech(true);
      else if (!(e instanceof Error && e.message === 'aborted')) showToast(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  const sayIt = async () => {
    if (!q || listening) return;
    stopSpeaking();
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = Math.max(...alts.map((a) => speechMatchRate(a, q.item.en)));
      showToast(`${best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!'} ${Math.round(best * 100)}% 일치`);
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'aborted' || e.message === 'no-speech'))) showToast(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  /** 이번 학습의 목표를 채웠는가 — 채우면 '다음 문제'가 초록 '학습 완료' */
  const reachedTarget = listIds ? count >= listIds.length : count >= goal && startCount != null && startCount < goal;

  const next = async () => {
    if (phase !== 'answered' || !view) return;
    if (reachedTarget) {
      if (listIds) nav(-1);
      else nav('/');
      return;
    }
    stopSpeaking();
    playId.current++;
    setSpeaking(false);
    setPlaying(false);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const snap = { key: cardKey, view: { ...view, flash: null, tipOpen: null, pop: null, sung: words.length, reveal: null } };
    const ok = await load();
    if (!ok) return;
    // 지난 카드는 왼쪽으로 빠지고(0.3초) 새 카드가 오른쪽에서 들어온다. 0.17초 뒤 입력 칸이 올라와 패널을 덮는다
    setExiting(snap);
    later(() => setExiting((e) => (e?.key === snap.key ? null : e)), 300);
    setPanelLeaving(true);
    later(() => setPanelLeaving(false), 300);
  };

  // 실제 키보드 (PC): 객관식 U/I/J/K · 1 다시 듣기 · 0 입력 방식 · Enter 다음 문제, 주관식은 글자 그대로
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'answered') {
        if (e.key === 'Enter' && panelReady) void next();
        else if (e.key.toLowerCase() === 't' && tips.length) setTipOpen((v) => (v == null ? 0 : null));
        return;
      }
      if (phase !== 'question') return;
      if (e.key === '1') replay();
      else if (zone === 'mc') {
        const i = 'uijk'.indexOf(e.key.toLowerCase());
        const el = document.querySelectorAll<HTMLElement>('.listen-quiz .lq-slot')[i];
        if (i >= 0 && el) tapSlot(i, el);
      } else if (e.key === '0') setInputMode(zone === 'kb' ? 'voice' : 'keyboard');
      else if (zone === 'kb') {
        if (e.key === 'Enter') confirm();
        else if (e.key === 'Backspace') setInput((v) => v.slice(0, -1));
        else if (/^[a-zA-Z]$/.test(e.key)) onType(input + e.key.toLowerCase());
      } else if (e.key === 'Enter') void voiceAnswer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!settings || phase === 'loading') return <div className="quiz-screen vocab-quiz listen-quiz quiz-loading" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">{listIds ? '히스토리 학습을 마쳤어요' : '지금 풀 리스닝 문제가 없어요'}</p>
        <button className="btn primary" onClick={() => (listIds ? nav(-1) : nav('/all?mode=listening'))}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q) return null;

  const answered = phase === 'answered';
  const showPanel = answered && panelReady;
  const view: CardView = {
    item: q.item,
    words,
    done,
    white,
    answered,
    banner: banner ? result : null,
    showKo: hinted || showPanel,
    fill: listenProgress(words, done),
    flash,
    reveal,
    sung,
    tips,
    tipOpen: showPanel ? tipOpen : null,
    tipBtn: showPanel && tips.length > 0,
    allGreen: tipSeen,
    pop: showPanel ? pop : null,
  };
  const tones = dotTones(listens);
  const firstCard = cardKey === 1;
  const en = q.item.en;

  const tools: PanelTool[] = [
    { key: 'x08', icon: 'slowplay', label: 'x0.8 듣기', onClick: () => play(en, { factor: 0.8, forceSlow: false }) },
    { key: 'slow', icon: 'turtleBig', label: '듣기평가 속도', onClick: () => play(en, { forceSlow: true }) },
    { key: 'say', icon: 'micFill', label: '말해보기', onClick: () => void sayIt() },
    {
      key: 'mark',
      icon: 'bookmarkStar',
      label: '북마크',
      active: !!bookmarked,
      onClick: () => void toggleBookmark('listening', q.item.id).then((on) => showToast(on ? '북마크에 담았어요.' : '북마크에서 뺐어요.')),
    },
    { key: 'dict', icon: 'search', label: '사전 검색', onClick: () => nav('/dict') },
  ];
  const female = settings.voiceGender === 'female';
  const moreRows: MoreAction[][] = [[{ key: 'voice', icon: 'voices', label: '다른 성별 음성', onClick: () => void saveSettings({ voiceGender: female ? 'male' : 'female' }).then(() => play(en)) }]];
  const noop = () => undefined;

  const replayIcon = (
    <span className={`lq-spk${playing ? ' on' : ''}`}>
      <LqSpeaker />
    </span>
  );
  const dots = (
    <span className="lq-dots" aria-hidden="true">
      {tones.map((t, i) => (
        <i key={i} className={t} />
      ))}
    </span>
  );

  return (
    <div className={`quiz-screen vocab-quiz listen-quiz lq-${zone} theme-${settings.studyTheme}${answered ? ' answered' : ''}`}>
      <QuizScene theme={settings.studyTheme} />
      <QuizTop count={count} total={goal} title={listIds ? (listTitle ?? '히스토리 학습') : undefined} onLeave={() => (listIds ? nav(-1) : nav('/'))} onSettings={() => nav('/settings/mode/listening')} />
      {toast && <div className="toast">{toast}</div>}

      <main className="quiz-stage">
        <div className="sky-row">
          <Pterodactyls flights={flights} />
        </div>
        <div className="card-row">
          <div className="card-stage">
            <div className="card-track">
              {exiting && (
                <div className="card-slide exit" key={`x${exiting.key}`} aria-hidden="true">
                  <div className="card-rel">
                    <LCard view={exiting.view} />
                  </div>
                </div>
              )}
              <div className="card-slide" key={cardKey}>
                <div className="card-rel">
                  <LCard
                    view={view}
                    enRef={enRef}
                    dict={dict}
                    onTip={(i) => {
                      setPop(null);
                      setTipOpen(i);
                      if (i != null) setTipSeen(true);
                    }}
                    onPop={(i) => {
                      setTipOpen(null);
                      setPop(i);
                    }}
                    onListenFrom={(i) => play(words.slice(i).map((w) => w.show).join(' '))}
                    onSearch={(w) => nav(`/dict?q=${encodeURIComponent(w)}`)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="scene-row" />
      </main>

      <div className={`quiz-bottom${firstIn ? ' first' : ''}${modeSwitched ? ' switched' : ''}`}>
        {(showPanel || panelLeaving) && (
          <AfterPanel
            className={!showPanel && panelLeaving ? 'leave' : panelEnter ? 'enter' : ''}
            noBubble
            answer=""
            answerIsWord={false}
            onBubble={noop}
            wrongCount={0}
            listening={listening && showPanel}
            onStopListening={() => window.dispatchEvent(new Event('voca:stop-listening'))}
            examplesOpen={false}
            wrongsOpen={false}
            onExamples={noop}
            onWrongs={noop}
            onSay={noop}
            onInfo={noop}
            onWordbook={noop}
            inWordbook={false}
            onSlow={noop}
            speaking={speaking && showPanel}
            tools={tools}
            bigFirst={{ icon: <BigSlowPlay />, label: 'x0.5 듣기', onClick: () => play(en, { factor: 0.5, forceSlow: false }) }}
            onReplay={() => play(en)}
            onNext={() => void next()}
            finish={reachedTarget && showPanel}
            onMore={() => setMoreOpen((v) => !v)}
            moreOpen={moreOpen && showPanel}
            moreRows={moreRows}
          />
        )}
        {(!showPanel || zoneLeaving) && zone === 'kb' && (
          <div className={`quiz-input lq-input ${zoneLeaving ? 'leave' : panelLeaving ? 'enter' : ''}`} onAnimationEnd={(e) => e.animationName === 'kbSink' && setZoneLeaving(false)}>
            <div className="toolbar">
              <button className="tool-btn lq-replay" onClick={replay} disabled={answered}>
                {firstCard && !touched && <span className="kbd-hint tl">1</span>}
                {hinted ? (
                  <QReveal />
                ) : (
                  <span className="lq-spkwrap">
                    {replayIcon}
                    {dots}
                  </span>
                )}
                <span>{hinted ? '정답 보기' : '다시 듣기'}</span>
              </button>
              <div className="toolbar-center">
                <div className="lq-box" lang="en" ref={boxRef}>
                  <span>{input}</span>
                  {!answered && <i className="lq-caret" />}
                </div>
              </div>
              <button className="tool-btn" onClick={() => setInputMode('voice')} disabled={!canRecognize() || answered}>
                {firstCard && !touched && <span className="kbd-hint tr">0</span>}
                <QMic />
                <span>음성 모드</span>
              </button>
            </div>
            <Keyboard onChar={(c) => onType(input + c)} onBackspace={() => setInput((v) => v.slice(0, -1))} onSpace={noop} onEnter={confirm} />
          </div>
        )}
        {!showPanel && zone === 'voice' && (
          <div className="voice-zone">
            <svg className="vz-bar" viewBox="0 0 360 88.333" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0H72C110 0 125 50.333 180 50.333S250 0 288 0H360V88.333H0z" />
            </svg>
            <div className={`vz-mic ${listening ? 'listening' : ''} ${noSpeech && !listening ? 'nospeech' : ''}`}>
              <i className="vz-halo h2" />
              <i className="vz-halo h1" />
              <i className="vz-ring" />
              <button className="mic-big" onClick={() => (listening ? window.dispatchEvent(new Event('voca:stop-listening')) : void voiceAnswer())} aria-label={listening ? '듣는 중' : '말하기'}>
                {listening ? (
                  <>
                    <span className="stop-square" />
                    <small>듣고 있어요</small>
                  </>
                ) : (
                  <>
                    <svg className="vz-mic-ic" width="24.667" height="37.333" viewBox="0 0 24.667 37.333" aria-hidden="true">
                      <rect x="5.667" y="0" width="13.333" height="23.333" rx="6.667" fill="currentColor" />
                      <path d="M1.300 15.000v2.300a11.033 11.033 0 0 0 22.067 0v-2.300" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" />
                      <path d="M12.333 28.300v7.700" fill="none" stroke="currentColor" strokeWidth="2.600" strokeLinecap="round" />
                    </svg>
                    {noSpeech && <small>다시 해 보세요</small>}
                  </>
                )}
              </button>
              <span className="vz-key enter" lang="en">
                Enter
              </span>
            </div>
            <button className="vz-btn left lq-vreplay" onClick={replay} disabled={answered}>
              <span className="vz-key" lang="en">
                1
              </span>
              {hinted ? (
                <QReveal />
              ) : (
                <span className={`lq-spk plain${playing ? ' on' : ''}`}>
                  <LqSpeakerPlain />
                </span>
              )}
              <span>{hinted ? '정답 보기' : '다시 듣기'}</span>
              {!hinted && dots}
            </button>
            <button className="vz-btn right" onClick={() => setInputMode('keyboard')} disabled={answered}>
              <span className="vz-key" lang="en">
                0
              </span>
              <QKeyboard />
              <span>키보드 모드</span>
            </button>
          </div>
        )}
        {(!showPanel || zoneLeaving) && zone === 'mc' && (
          <div className={`lq-mc ${zoneLeaving ? 'leave' : panelLeaving ? 'enter' : ''}`} onAnimationEnd={(e) => e.animationName === 'kbSink' && setZoneLeaving(false)}>
            <div className="lq-slots">
              {slots.map((s, i) => {
                const empty = s.word === null || firstPlay;
                return (
                  <button
                    key={i}
                    className={`lq-slot${empty ? ' empty' : ''}${s.bad ? ' bad' : ''}${s.hit ? ' hit' : ''}`}
                    lang="en"
                    onClick={(e) => tapSlot(i, e.currentTarget)}
                    disabled={empty || answered}
                  >
                    {firstCard && !touched && (
                      <span className="vz-key" lang="en">
                        {'UIJK'[i]}
                      </span>
                    )}
                    {!empty && s.word !== null && <span>{words[s.word].btn}</span>}
                  </button>
                );
              })}
            </div>
            <button className={`lq-pill${playing ? ' careful' : ''}`} onClick={replay} disabled={answered || playing}>
              {firstCard && !touched && (
                <span className="vz-key" lang="en">
                  1
                </span>
              )}
              {playing ? (
                <>
                  <span className="lq-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span lang="en">Listen Carefully</span>
                </>
              ) : hinted ? (
                <>
                  <svg className="lq-pill-ok" viewBox="0 0 18 18" aria-hidden="true">
                    <circle cx="9" cy="9" r="9" fill="#fff" />
                    <path d="M4.700 9.300l3 3 5.600-6.200" fill="none" stroke="#6e66e0" strokeWidth="2.200" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>정답 보기</span>
                </>
              ) : (
                <>
                  <span className="lq-pill-ic">
                    <LqSpeakerWhite />
                    {dots}
                  </span>
                  <span>다시 듣기</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 도구줄의 '다시 듣기' 그림: 회색 동그라미 안에 스피커 (플립 실측: 지름 22.67) */
function LqSpeaker() {
  return (
    <svg viewBox="0 0 22.667 22.667" aria-hidden="true">
      <circle cx="11.333" cy="11.333" r="11.333" fill="currentColor" />
      <path d="M5.300 9.100h2.500l3.300-2.700c0.450-0.350 1.100-0.050 1.100 0.550v8.800c0 0.600-0.650 0.900-1.100 0.550l-3.300-2.700H5.300a0.700 0.700 0 0 1-0.700-0.700V9.800a0.700 0.700 0 0 1 0.700-0.700z" fill="var(--lq-spk-in, #202122)" />
      <path className="a1" d="M14.100 8.900a3.300 3.300 0 0 1 0 4.900" fill="none" stroke="var(--lq-spk-in, #202122)" strokeWidth="1.300" strokeLinecap="round" />
      <path className="a2" d="M15.900 7.100a5.900 5.900 0 0 1 0 8.500" fill="none" stroke="var(--lq-spk-in, #202122)" strokeWidth="1.300" strokeLinecap="round" />
    </svg>
  );
}

/** 음성 모드의 '다시 듣기' 그림: 동그라미 없는 회색 스피커 (플립 실측: 26 x 21.33 — 몸통 x 0~12.7, 호 둘) */
function LqSpeakerPlain() {
  return (
    <svg viewBox="0 0 26 21.333" aria-hidden="true">
      <path d="M1.300 5.300h4.600l6-4.700c0.800-0.600 1.900-0.050 1.900 0.950v18.233c0 1-1.100 1.550-1.900 0.950l-6-4.700H1.300A1.300 1.300 0 0 1 0 14.733V6.600a1.300 1.300 0 0 1 1.300-1.300z" fill="currentColor" />
      <path className="a1" d="M17 6.200a6.300 6.300 0 0 1 0 8.933" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
      <path className="a2" d="M20.800 2.300a11.700 11.700 0 0 1 0 16.733" fill="none" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
    </svg>
  );
}

/** 보라 알약의 흰 스피커 (17.67 x 14.67) */
function LqSpeakerWhite() {
  return (
    <svg viewBox="0 0 17.667 14.667" aria-hidden="true">
      <path d="M1 4.600h2.900l4-3.500c0.550-0.450 1.400-0.050 1.400 0.650v11.200c0 0.700-0.850 1.100-1.400 0.650l-4-3.500H1a1 1 0 0 1-1-1V5.600a1 1 0 0 1 1-1z" fill="#fff" />
      <path d="M11.700 4.200a4.300 4.300 0 0 1 0 6.300" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" />
      <path d="M14.100 1.700a7.800 7.800 0 0 1 0 11.300" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" />
    </svg>
  );
}

/** 원 위의 호 한 토막 (각도는 도, 3시 방향이 0, 시계 방향) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const pt = (a: number) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(3)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(3)}`;
  return `M${pt(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}`;
}

/** 큰 단추 'x0.5 듣기': 오른쪽은 이어진 호(12시 → 6시 반), 왼쪽은 끊어진 줄 넷, 가운데 ▶ (플립 실측: 46 상자 안에서 지름 38.67) */
export function BigSlowPlay() {
  const dashes = [127.2, 166.4, 205.6, 244.8];
  return (
    <svg viewBox="0 0 46 46" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3.700" strokeLinecap="round">
        <path d={arc(23, 23, 17.48, -86, 99)} />
        {dashes.map((c) => (
          <path key={c} d={arc(23, 23, 17.48, c - 9, c + 9)} />
        ))}
      </g>
      <path d="M18.200 16.100c0-1.700 1.800-2.700 3.200-1.800l10.400 6.900c1.300 0.850 1.300 2.750 0 3.600l-10.400 6.900c-1.400 0.900-3.200-0.100-3.200-1.800z" fill="currentColor" />
    </svg>
  );
}

/** 리스닝 카드: 레벨 꼬리표 + 결과 글자 + 뜻(가려진 막대) + 문장 줄 + TIP · 낱말 뜻 팝업 */
function LCard({
  view,
  enRef,
  dict,
  onTip,
  onPop,
  onListenFrom,
  onSearch,
}: {
  view: CardView;
  enRef?: React.RefObject<HTMLParagraphElement | null>;
  dict?: Map<string, StoredWord>;
  onTip?: (i: number | null) => void;
  onPop?: (i: number | null) => void;
  onListenFrom?: (i: number) => void;
  onSearch?: (w: string) => void;
}) {
  const { item, words, done, answered, flash } = view;
  const localRef = useRef<HTMLParagraphElement | null>(null);
  const ref = enRef ?? localRef;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tailX, setTailX] = useState<number | null>(null);
  const tip = view.tipOpen != null ? (view.tips[view.tipOpen] ?? null) : null;
  const popWord = view.pop != null ? words[view.pop] : null;
  const hit = popWord ? lookup(dict, popWord.key) : null;

  // 말풍선 꼬리: 짚는 낱말(들)의 가운데
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const en = ref.current;
    const a = tip ? tip.from : view.pop;
    const b = tip ? tip.to : view.pop;
    if (!wrap || !en || a == null || b == null) {
      setTailX(null);
      return;
    }
    const ea = en.querySelector<HTMLElement>(`[data-w="${a}"]`);
    const eb = en.querySelector<HTMLElement>(`[data-w="${b}"]`);
    if (!ea || !eb) return;
    const ra = ea.getBoundingClientRect();
    const rb = eb.getBoundingClientRect();
    const base = wrap.getBoundingClientRect().left;
    // 두 낱말이 다른 줄에 있으면 첫 낱말을 가리킨다
    const right = Math.abs(rb.top - ra.top) < 4 ? rb.right : ra.right;
    setTailX((ra.left + right) / 2 - base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.tipOpen, view.pop, tip]);

  const r = view.banner;
  return (
    <div className={`qcard-wrap lq-wrap${answered ? ' done' : ''}${popWord ? ' popping' : ''}`} ref={wrapRef}>
      <div className="qcard-head">
        <span className="qcard-tab">레벨 {item.level}</span>
        {r && (
          <p className={`lq-banner ${r}`}>
            <span className="lq-ban">
              <b lang="en">{RESULT_TEXT[r].title}</b>
              <i>{RESULT_TEXT[r].sub}</i>
            </span>
          </p>
        )}
      </div>
      <div className={`qcard lq-card ${flash ? 'is-wrong' : ''}`} key={flash?.key ?? 0}>
        {flash && (
          <span className="mark-bang" aria-hidden="true">
            <svg viewBox="0 0 17.667 46.667">
              <polygon points="1.800,0 17.300,2.600 11.800,32.300 1.300,30.100" fill="currentColor" />
              <circle cx="6.030" cy="40.500" r="6.100" fill="currentColor" />
            </svg>
          </span>
        )}
        <div className="qcard-top">
          {view.showKo ? (
            <>
              {item.ctx && (
                <p className="ctx">
                  <KoText text={item.ctx} />
                </p>
              )}
              <p className="ko lq-ko">
                <KoText text={item.ko} />
              </p>
            </>
          ) : (
            <div className="lq-bar">
              <span style={{ width: `${view.fill * 100}%` }} />
            </div>
          )}
        </div>
        <div className="qcard-bottom">
          <p className="en lq-en" lang="en" ref={ref}>
            {words.map((w, i) => {
              const filled = i < done;
              const tipHl = tip && i >= tip.from && i <= tip.to;
              const rv = view.reveal != null && i >= view.reveal;
              // 색: 뜻 팝업의 낱말은 빨강, TIP 이 짚는 낱말은 보라, 정답 보기로 나온 낱말과 틀린 적이 있는 자리는 흰색, 나머지는 초록
              const cls = !filled ? 'lq-b' : view.pop === i ? 'lq-red' : tipHl ? 'lq-hl' : rv || (view.white.has(i) && !view.allGreen) ? 'lq-wh' : 'lq-g';
              const sung = filled && i < view.sung;
              const last = i === words.length - 1;
              // 낱말 사이의 빈칸: 양쪽이 다 비어 있으면 회색 줄이, 양쪽 다 밑줄이면 초록 밑줄이 이어진다. 한 글자 낱말(I · a) 뒤에서는 줄이 바뀌지 않는다
              const spBlank = !last && i + 1 >= done && !filled;
              const spSung = !last && sung && i + 1 < view.sung;
              return (
                <span key={i}>
                  <span
                    data-w={i}
                    className={`lq-w ${cls}${rv ? ' lq-rv' : ''}${sung ? ' lq-sung' : ''}`}
                    style={rv ? ({ '--i': i - (view.reveal ?? 0) } as CSSProperties) : undefined}
                    onClick={answered && onPop ? () => onPop(view.pop === i ? null : i) : undefined}
                  >
                    {w.show}
                  </span>
                  {!last && <span className={`lq-sp${spBlank ? ' lq-b' : ''}${spSung ? ' lq-sung' : ''}`}>{w.type.length === 1 ? ' ' : ' '}</span>}
                </span>
              );
            })}
          </p>
        </div>
        {view.tipBtn && !tip && (
          <button className="lq-tipbtn" onClick={() => onTip?.(0)} aria-label="발음 팁">
            <span className="vz-key" lang="en">
              T
            </span>
            <b lang="en">TIP</b>
          </button>
        )}
        {popWord && <div className="lq-dimcard" onClick={() => onPop?.(null)} />}
      </div>
      {popWord && <div className="lq-dimsky" onClick={() => onPop?.(null)} />}
      {tip && (
        <div className="lq-tip" style={{ '--tail': `${tailX ?? 160}px` } as CSSProperties} onClick={(e) => e.stopPropagation()}>
          <p className="lq-tip-title">
            <b className="lq-tip-badge" lang="en">
              TIP
            </b>
            {tip.title.map((t, k) => (
              <span key={k} className={t.hl ? 'hl' : ''}>
                <KoText text={t.t} />
              </span>
            ))}
          </p>
          <p className="lq-tip-body">
            <KoText text={`[이유] ${tip.body}`} />
          </p>
          <p className="lq-tip-pager" lang="en">
            {view.tips.length > 1 && (
              <button onClick={() => onTip?.(((view.tipOpen ?? 0) + view.tips.length - 1) % view.tips.length)} aria-label="이전 팁">
                <svg viewBox="0 0 8 12" aria-hidden="true">
                  <path d="M6.500 1.200 1.700 6l4.800 4.800" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <span>
              {(view.tipOpen ?? 0) + 1} / {view.tips.length}
            </span>
            {view.tips.length > 1 && (
              <button onClick={() => onTip?.(((view.tipOpen ?? 0) + 1) % view.tips.length)} aria-label="다음 팁">
                <svg viewBox="0 0 8 12" aria-hidden="true">
                  <path d="M1.500 1.200 6.300 6l-4.800 4.800" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </p>
        </div>
      )}
      {popWord && view.pop != null && (
        <div className="lq-pop" style={{ '--tail': `${tailX ?? 160}px` } as CSSProperties}>
          <p className="lq-pop-head">사전에서 찾은 뜻이에요.</p>
          <div className="lq-pop-row">
            <b lang="en">{hit?.word ?? popWord.key}</b>
            {hit && <span className="lq-pop-pos">{POS_KO[hit.pos]}</span>}
            <button className="lq-pop-search" onClick={() => onSearch?.(hit?.word ?? popWord.key)} aria-label="사전에서 찾기">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="6.700" cy="6.700" r="5.200" fill="none" stroke="currentColor" strokeWidth="1.500" />
                <path d="M10.600 10.600l4.200 4.200" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="lq-pop-mean">
            <KoText text={hit ? hit.meanings.join(', ') : '사전에 아직 없는 낱말이에요.'} />
          </p>
          <button className="lq-pop-listen" onClick={() => onListenFrom?.(view.pop!)}>
            <svg viewBox="0 0 17.667 14.667" aria-hidden="true">
              <path d="M1 4.600h2.900l4-3.500c0.550-0.450 1.400-0.050 1.400 0.650v11.200c0 0.700-0.850 1.100-1.400 0.650l-4-3.500H1a1 1 0 0 1-1-1V5.600a1 1 0 0 1 1-1z" fill="currentColor" />
              <path d="M11.700 4.200a4.300 4.300 0 0 1 0 6.300" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
              <path d="M14.100 1.700a7.800 7.800 0 0 1 0 11.300" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
            </svg>
            이 단어부터 끝까지 듣기
          </button>
        </div>
      )}
    </div>
  );
}
