import { useLiveQuery } from 'dexie-react-hooks';
import { type CSSProperties, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { State } from 'ts-fsrs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel from '../components/AfterPanel';
import DinoScene from '../components/DinoScene';
import ExtraSheet, { type SheetAction } from '../components/ExtraSheet';
import InfoCard from '../components/InfoCard';
import LevelHelp from '../components/LevelHelp';
import StudyInfoSheet from '../components/StudyInfoSheet';
import Pterodactyls from '../components/Pterodactyls';
import FavTip from '../components/FavTip';
import Icon from '../components/Icon';
import Keyboard from '../components/Keyboard';
import Mascot from '../components/Mascot';
import VocabSettings from '../components/VocabSettings';
import { QBack, QBonus, QBookOutline, QGear, QHead, QHint, QMic, QReveal, QSpeak, QStreak, QSwap } from '../components/QuizIcons';
import KoText from '../components/KoText';
import QuizCard, { FilledSentence, type CardBadge, type CardFlash } from '../components/QuizCard';
import { Backdrop, useLeaveGuard } from '../components/StudyChrome';
import { db } from '../db';
import { comprehension, computeStreak, estimateVocab, grantRepairPen, daySolved } from '../lib/stats';
import { syncContent } from '../lib/content';
import { maybeAdjustLevel } from '../lib/level';
import { LEVEL_TEST_QUESTIONS } from '../lib/levelLogic';
import { applyReview, newCardRow, type Outcome } from '../lib/scheduler';
import { LevelTest, ListPicker, StudyPicker, type Question } from '../lib/session';
import { saveSettings, useSettings } from '../lib/settings';
import { sfx } from '../lib/sfx';
import { favNoteKey, toggleFavNote, useFavNotes } from '../lib/favnotes';
import { pushInbox } from '../lib/inbox';
import { markPronunciation } from '../lib/learned';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { answerWords, containsAnswer, evaluate, feedbackFor, fullSentence, normalize, revealPrefix, speechMatchRate, typoOf } from '../lib/text';
import { toggleWordbook, useWordbook } from '../lib/wordbook';
import { useNavBarColor, useStatusBarColor } from '../lib/statusBar';
import { formatAfter, formatAgo, formatDuration, studyDateOf } from '../lib/time';
import { POS_KO, type Settings, type StoredWord, type Tone, type WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty' | 'nowords' | 'testResult';
type Overlay = 'examples' | 'wrongs' | 'info' | null;

interface Live {
  q: Question;
  input: string;
  /** 힌트로 보여 준 앞글자 (말해보카 실측: 지울 수 있고, 다 지우면 칸에 주황 고스트로 남는다) */
  hintText: string;
  /** 지금까지 보여 준 글자 수: 힌트 보기 +2, 보너스 힌트 +1 */
  revealed: number;
  /** '힌트 보기'를 이미 썼는지 (썼으면 버튼은 '정답 보기') */
  hintUsed: boolean;
  /** 맞는 다른 답(초록 말풍선)을 내면 '보너스 힌트'(한 글자 더)를 한 번 쓸 수 있다 */
  bonusReady: boolean;
  hints: number;
  showedAnswer: boolean;
  wrongAttempts: number;
  wrongs: WrongNote[];
  feedback: { tone: Tone; msg: string; mask?: { text: string; bad: boolean }[] } | null;
  /** 오타 제출 뒤: 고치는 동안 말풍선의 글자 수 차이가 실시간으로 바뀐다 (말해보카) */
  typoLive: boolean;
  startedAt: number;
}

interface Answered {
  q: Question;
  outcome: Outcome;
  known: boolean;
  due: Date;
  wrongs: WrongNote[];
}

const freshLive = (q: Question): Live => ({
  q,
  input: '',
  hintText: '',
  revealed: 0,
  hintUsed: false,
  bonusReady: false,
  hints: 0,
  showedAnswer: false,
  wrongAttempts: 0,
  wrongs: [],
  feedback: null,
  typoLive: false,
  startedAt: Date.now(),
});


export default function Quiz({ mode }: { mode: 'study' | 'test' }) {
  const settings = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const extraTarget = Number(params.get('target')) || 0;
  const listIds = params.get('ids')?.split(',').filter(Boolean) ?? null;
  const [phase, setPhase] = useState<Phase>('loading');
  const [live, setLive] = useState<Live | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [inputMode, setInputMode] = useState<'keyboard' | 'voice'>('keyboard');
  const [todayTotal, setTodayTotal] = useState(0);
  const [testAsked, setTestAsked] = useState(0);
  const [testLevel, setTestLevel] = useState<number | null>(null);
  const [flash, setFlash] = useState<CardFlash>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sayResult, setSayResult] = useState<{ tone: Tone; msg: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** 말해보카 실측: 몇 초 안에 못 들으면 마이크 원이 어두워지고 '다시 해 보세요' */
  const [noSpeech, setNoSpeech] = useState(false);
  const [handsTip, setHandsTip] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [goalReached, setGoalReached] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [levelHelp, setLevelHelp] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const [favTip, setFavTip] = useState<0 | 1 | 2>(0);
  /** 정답 후 자판이 1초쯤 남았다가 패널로 바뀜 (말해보카) */
  const [panelReady, setPanelReady] = useState(false);
  /** 푼 카드 기록: 오른쪽으로 밀면 이전 카드 다시 보기 */
  const [history, setHistory] = useState<Answered[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [slideBack, setSlideBack] = useState(false);
  /** 배지를 누르면 뜨는 '학습 정보' 팝업 */
  const [infoOpen, setInfoOpen] = useState(false);
  /** 왼쪽으로 밀어 미루기: '건너뛰었다가 다시 도전할까요?' 확인 막대 */
  const [skipAsk, setSkipAsk] = useState(false);
  /** 오른쪽으로 밀어 뒤로 미룬 카드: 몇 장 뒤에 다시 낸다 */
  const deferred = useRef<{ q: Question; after: number }[]>([]);
  const cardsSeen = useRef(0);
  /** 정답 0.55초 뒤: 배지가 'N 뒤 복습'으로 바뀌고 ♥ 이 나타남 (말해보카 실측) */
  const [revealDue, setRevealDue] = useState(false);
  /** 자판↔정답 패널 교체 슬라이드(0.35초) 동안 둘 다 그린다 */
  const [kbLeaving, setKbLeaving] = useState(false);
  const [panelLeaving, setPanelLeaving] = useState(false);
  /** 다음 문제: 이전 카드가 왼쪽으로 빠지는 0.3초 동안 같이 그린다 */
  const [exiting, setExiting] = useState<{ key: number; item: Answered } | null>(null);
  /** 정답마다 익룡이 한 번 날아간다 */
  const [flights, setFlights] = useState(0);
  /** 말풍선 옆 '^' 추가 동작 시트 */
  const [moreOpen, setMoreOpen] = useState(false);
  /** 시작할 때 진행 막대가 0에서 차오르도록 */
  const [barReady, setBarReady] = useState(false);
  const [sceneVariant] = useState(() => Math.floor(Math.random() * 3));
  const wordbook = useWordbook();
  const favorites = useLiveQuery(() => db.favorites.toCollection().primaryKeys(), []) as string[] | undefined;
  // 입력 말풍선: 사전(단어 팩)에 있는 단어면 밑줄 + 누르면 뜻 (말해보카)
  const dictWords = useLiveQuery(async () => new Map((await db.words.toArray()).map((w) => [w.word.toLowerCase(), w])), []);
  // 입력 말풍선 밑줄: 사전에 있는 낱말이면 밑줄. 말해보카는 큰 사전이라 웬만한 낱말·알파벳 한 글자도 밑줄이 붙는다 → 우리는 단어 팩의 표제어·예문·등록 답에 나온 낱말 + 알파벳
  const knownTokens = useLiveQuery(async () => {
    const set = new Set<string>('abcdefghijklmnopqrstuvwxyz'.split(''));
    for (const w of await db.words.toArray()) {
      set.add(w.word.toLowerCase());
      for (const s of w.sentences) {
        const text = `${s.en} ${s.answer} ${(s.alts ?? []).map((a) => a.w).join(' ')}`.toLowerCase();
        for (const tok of text.match(/[a-z']+/g) ?? []) set.add(tok);
      }
    }
    return set;
  }, []);
  const [typedPop, setTypedPop] = useState(false);
  const tipSeen = useLiveQuery(async () => !!(await db.kv.get('typedTipSeen')), []);
  const [tipOpen, setTipOpen] = useState(true);
  const guard = useLeaveGuard(() => nav('/'));
  // 말해보카: 학습 화면에서는 상태바까지 하늘색 (다이노 테마), 하늘 테마는 연한 파랑
  useStatusBarColor(settings?.studyTheme === 'sky' ? '#96cbf5' : '#bbe4df', false);
  // 내비게이션 바: 자판이 떠 있으면 자판 배경(#2b2c2b), 정답 패널이면 패널 배경(#252627) — 화면 맨 아래까지 같은 색으로 이어진다
  useNavBarColor(phase === 'question' || phase === 'answered' ? (phase === 'answered' && panelReady ? '#252627' : '#2b2c2b') : null);

  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings ?? null;
  const pickerRef = useRef<StudyPicker | ListPicker | null>(null);
  const testRef = useRef<LevelTest | null>(null);
  const started = useRef(false);
  const swipeX = useRef(0);
  const finalizing = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const present = (q: Question) => {
    finalizing.current = false;
    setLive(freshLive(q));
    setAnswered(null);
    setOverlay(null);
    setSayResult(null);
    setVoiceError(null);
    setHeard(null);
    setFlash(null);
    setLevelHelp(false);
    setCardKey((k) => k + 1);
    setHistIdx(null);
    setSlideBack(false);
    setPanelReady(false);
    setRevealDue(false);
    setMoreOpen(false);
    setInfoOpen(false);
    setSkipAsk(false);
    setPhase('question');
  };

  const finishTest = useCallback(async (t: LevelTest) => {
    const lvl = t.finalLevel();
    await saveSettings({ level: lvl });
    await db.kv.put({ key: 'levelTestDate', value: studyDateOf() });
    const hist = ((await db.kv.get('vocabHistory'))?.value as { date: string; level: number; vocab: number }[] | undefined) ?? [];
    await db.kv.put({ key: 'vocabHistory', value: [...hist, { date: studyDateOf(), level: lvl, vocab: estimateVocab(lvl, await comprehension()) }] });
    setTestLevel(lvl);
    setPhase('testResult');
  }, []);

  const loadNext = useCallback(async () => {
    if (mode === 'test') {
      const t = testRef.current;
      if (!t) return;
      if (t.done) return finishTest(t);
      const q = await t.pick();
      if (!q) return finishTest(t);
      present(q);
      return;
    }
    cardsSeen.current += 1;
    const due = deferred.current.find((d) => d.after <= cardsSeen.current);
    if (due) {
      deferred.current = deferred.current.filter((d) => d !== due);
      present(due.q);
      return;
    }
    const q = (await pickerRef.current?.next()) ?? deferred.current.shift()?.q ?? null;
    if (!q) {
      setPhase('empty');
      return;
    }
    present(q);
  }, [mode, finishTest]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    setInputMode(settings.inputMode);
    (async () => {
      if ((await db.words.count()) === 0) {
        setPhase('nowords');
        return;
      }
      setTodayTotal(daySolved(await db.daily.get(studyDateOf())));
      if (mode === 'test') {
        const t = new LevelTest();
        await t.init();
        testRef.current = t;
      } else {
        const p = listIds ? new ListPicker(listIds) : new StudyPicker(settings.level ?? 10, settings.newWordDifficulty, settings.reviewRatio);
        await p.init();
        pickerRef.current = p;
      }
      await loadNext();
    })().catch(console.error);
  }, [settings, mode, loadNext]);

  const sentenceOf = (q: Question) => q.word.sentences[q.sentenceIdx];

  const speakSentence = (q: Question, slow?: boolean) => {
    const s = sentenceOf(q);
    speak(fullSentence(s.en, s.answer), slow ?? settingsRef.current?.speechRate === 'slow');
  };

  const finalize = useCallback(
    async (l: Live, m: 'keyboard' | 'voice') => {
      const s = settingsRef.current;
      if (!s || finalizing.current) return;
      finalizing.current = true;
      try {
        const now = new Date();
        const outcome: Outcome = {
          firstTry: l.wrongAttempts === 0 && !l.showedAnswer,
          hints: l.hints,
          showedAnswer: l.showedAnswer,
          wrongAttempts: l.wrongAttempts,
          elapsedMs: Date.now() - l.startedAt,
        };
        const base = l.q.card ?? newCardRow(l.q.word.id, now);
        const { row, grade, known } = applyReview(base, outcome, now);
        const clean = outcome.firstTry && outcome.hints === 0;
        const date = studyDateOf(now);

        const { total, metNow } = await db.transaction('rw', db.cards, db.reviews, db.daily, async () => {
          await db.cards.put(row);
          await db.reviews.add({
            wordId: l.q.word.id,
            ts: now.getTime(),
            studyDate: date,
            rating: grade,
            firstTry: outcome.firstTry,
            hints: outcome.hints,
            showedAnswer: outcome.showedAnswer,
            wrongAttempts: outcome.wrongAttempts,
            mode: m,
            elapsedMs: outcome.elapsedMs,
            isNew: l.q.isNew,
            isTest: mode === 'test',
            sentenceIdx: l.q.sentenceIdx,
            wrongs: l.wrongs,
          });
          const d = (await db.daily.get(date)) ?? { date, total: 0, newWords: 0, reviews: 0, correct: 0, timeMs: 0 };
          if (d.solved == null) d.solved = d.total;
          const before = d.solved;
          d.total += 1;
          // 말해보카: 힌트 보기·정답 보기를 쓴 카드는 상단 카운트가 오르지 않는다 (오답 뒤 정답은 오른다)
          if (!outcome.showedAnswer && outcome.hints === 0) d.solved += 1;
          if (l.q.isNew) d.newWords += 1;
          else d.reviews += 1;
          if (known) d.knownNew = (d.knownNew ?? 0) + 1;
          if (clean) d.correct += 1;
          d.timeMs += Math.min(outcome.elapsedMs, 5 * 60_000);
          d.goal = s.dailyGoal;
          await db.daily.put(d);
          return { total: d.solved, metNow: before < s.dailyGoal && d.solved >= s.dailyGoal };
        });
        void computeStreak().then(grantRepairPen).catch(() => undefined);

        pickerRef.current?.noteAnswered(l.q.word.id);
        if (testRef.current) {
          testRef.current.record(clean);
          setTestAsked(testRef.current.asked);
        }
        setTodayTotal(total);
        setLive({ ...l, feedback: null, typoLive: false });
        const item: Answered = { q: l.q, outcome, known, due: row.due, wrongs: l.wrongs };
        setAnswered(item);
        setHistory((h) => [...h.slice(-19), item]);
        setFlash({ kind: 'correct', key: Date.now() });
        sfx('correct');
        setPhase('answered');
        // 익룡은 정답 0.6초 뒤 진행 막대 아래로 (말해보카)
        window.setTimeout(() => setFlights((f) => f + 1), 600);
        if (metNow && mode === 'study') {
          window.setTimeout(() => setGoalReached(true), 1100);
          void pushInbox('🏆 오늘 목표 달성!', '하루 목표를 채웠어요. 추가 학습으로 더 나아가 보세요.', '/');
        }
      } catch (err) {
        // 채점·저장 중 예외가 나도 화면이 그대로 멈추지 않게: 잠금을 풀고 알린다 (2026-11-11: 들여온 단어 카드에서 FSRS 예외로 멈춘 적 있음)
        finalizing.current = false;
        console.error('finalize failed', err);
        setToast('채점 중 문제가 생겼어요. 확인을 한 번 더 눌러 주세요.');
        window.setTimeout(() => setToast(null), 2600);
      }
    },
    [mode],
  );

  // 정답을 다 입력하면 바로 채점 (말해보카처럼 확인을 누르지 않아도 됨)
  useEffect(() => {
    if (phase !== 'question' || !live || !settings?.autoCheck || finalizing.current) return;
    const s = sentenceOf(live.q);
    if (live.input && normalize(live.input) === normalize(s.answer)) void finalize(live, 'keyboard');
  }, [live, phase, settings?.autoCheck, finalize]);

  const editInput = (fn: (cur: string) => string) => {
    if (phase !== 'question') return;
    setLive((l) => {
      if (!l) return l;
      const max = sentenceOf(l.q).answer.length + 16;
      let next = fn(l.input).slice(0, max);
      // 여러 단어 정답에서 이미 맞아 잠긴 앞 단어들도 지워지지 않는다 (말해보카)
      const aw = answerWords(sentenceOf(l.q).answer);
      if (aw.length > 1) {
        const cur = l.input.replace(/^\s+/, '').split(' ');
        let lockedWords = '';
        for (let k = 0; k < aw.length - 1 && k < cur.length - 1; k++) {
          if (cur[k].toLowerCase() === aw[k].toLowerCase()) lockedWords += cur[k] + ' ';
          else break;
        }
        if (lockedWords && !next.startsWith(lockedWords)) next = lockedWords + next.slice(lockedWords.length);
      }
      // 정답이 여러 단어면, 한 단어가 맞는 순간 다음 칸으로 자동 이동 (말해보카)
      const words = answerWords(sentenceOf(l.q).answer);
      if (words.length > 1 && next.length > l.input.length && !next.endsWith(' ')) {
        const parts = next.replace(/^\s+/, '').split(' ');
        const idx = parts.length - 1;
        if (idx < words.length - 1 && parts[idx].toLowerCase() === words[idx].toLowerCase()) next += ' ';
      }
      // 오타 말풍선은 고치는 동안 실시간으로 바뀐다 (말해보카: 글자 수 차이 갱신, 3글자를 넘으면 그대로, 다 지우면 사라짐)
      let feedback = next === l.input ? l.feedback : null;
      let typoLive = l.typoLive;
      if (l.typoLive && next !== l.input) {
        // 그 칸을 다 지우면 말풍선이 사라지고, 3글자 넘게 달라지면 마지막 내용이 남는다
        const t = typoOf(next, sentenceOf(l.q).answer);
        if (!next.trim() || !t) {
          typoLive = false;
          feedback = null;
        } else {
          feedback = t.distance <= 3 ? { tone: 'info', msg: `정답과 ${t.distance}글자 달라요.`, mask: t.mask } : l.feedback;
        }
      }
      return { ...l, input: next, feedback, typoLive };
    });
  };

  /** 다음 글자가 대문자여야 하면 자판도 대문자 (문장 첫머리, 정답 보기 중 다음 글자가 대문자일 때) */
  const capNext = (() => {
    if (!live) return false;
    const s = sentenceOf(live.q);
    if (live.showedAnswer) {
      const nextCh = s.answer[live.input.length] ?? '';
      return nextCh !== nextCh.toLowerCase();
    }
    const before = s.en.split('___')[0].trimEnd();
    const atStart = before === '' || /[.?!]$/.test(before);
    // 말해보카: 문장 첫머리이거나 정답이 대문자로 시작(고유명사·제목)하면 첫 글자는 대문자 자판
    const capAnswer = /^[A-Z]/.test(s.answer);
    return (atStart || capAnswer) && live.input === '';
  })();
  const typeChar = (c: string) => editInput((cur) => cur + c);
  /** 말해보카: 스페이스는 제출. 정답이 여러 단어면 다음 칸으로 */
  const space = () => {
    if (!live) return;
    const need = answerWords(sentenceOf(live.q).answer).length;
    const have = live.input.trim().split(/\s+/).filter(Boolean).length;
    if (need > 1 && have < need && live.input && !live.input.endsWith(' ')) editInput((cur) => cur + ' ');
    else submit();
  };
  const backspace = () => editInput((cur) => cur.slice(0, -1));

  const markWrong = (
    l: Live,
    w: string,
    tone: Tone,
    msg: string,
    penalize: boolean,
    showPill = true,
    mask?: { text: string; bad: boolean }[],
    opts: { typo?: boolean; bonus?: boolean } = {},
  ) => {
    setLive({
      ...l,
      feedback: showPill ? { tone, msg, mask } : null,
      typoLive: !!opts.typo,
      bonusReady: opts.bonus ? true : l.bonusReady,
      wrongAttempts: l.wrongAttempts + (penalize ? 1 : 0),
      wrongs: [...l.wrongs, { w, tone, m: msg }],
    });
    // 말해보카 실측(2026-11-10): 오타를 포함한 모든 오답에서 '!' 도장이 찍히고 카드가 1초 붉어진다
    setFlash({ kind: 'wrong', key: Date.now() });
    sfx('wrong');
  };

  const submit = () => {
    if (!live || phase !== 'question' || !live.input.trim()) return;
    const s = sentenceOf(live.q);
    const e = evaluate(live.input, s, live.q.word.word);
    if (e.kind === 'correct') {
      void finalize(live, 'keyboard');
      return;
    }
    const fb = feedbackFor(e);
    // 말풍선은 등록된 답(정답·비슷·오답 설명)과 오타(칸 단위, 길이에 따라 1~3글자)에만 뜬다. 기본형(relocate↔relocating)이나 다른 단어는 말풍선 없음.
    // 맞는 다른 답(초록 말풍선)을 내면 힌트 버튼이 '보너스 힌트'로 바뀐다
    const showPill = e.kind === 'alt' || e.kind === 'typo';
    markWrong(live, live.input.trim(), fb.tone, fb.msg, !fb.bonus, showPill, fb.mask, { typo: e.kind === 'typo', bonus: e.kind === 'alt' && e.alt.t === 'ok' });
  };

  const hint = () => {
    if (!live || phase !== 'question' || live.showedAnswer) return;
    const answer = sentenceOf(live.q).answer;
    if (live.bonusReady) {
      // 보너스 힌트: 지금까지 보여 준 것보다 한 글자 더 (힌트 전이면 1글자, 힌트 2글자 뒤면 3글자). 쓰고 나면 버튼은 원래 단계로
      const n = live.revealed + 1;
      const pre = revealPrefix(answer, n);
      setLive({ ...live, hints: live.hints + 1, revealed: n, hintText: pre, bonusReady: false, input: pre, feedback: null, typoLive: false });
    } else if (!live.hintUsed) {
      // 힌트 보기: 두 글자 더 (보너스 1글자 뒤면 3글자). 치던 글자는 힌트 글자로 바뀌고, 힌트 글자도 지울 수 있다(다 지우면 칸에 주황 고스트로 남음)
      const n = live.revealed + 2;
      const pre = revealPrefix(answer, n);
      setLive({ ...live, hints: live.hints + 1, hintUsed: true, revealed: n, hintText: pre, input: pre, feedback: null, typoLive: false });
    } else {
      // 정답 보기: 입력이 비워지고 캐럿이 칸 맨 앞으로, 정답 전체가 비친다(힌트 글자 초록 + 나머지 주황). 처음부터 다시 쳐야 한다
      setLive({ ...live, showedAnswer: true, input: '', feedback: null, typoLive: false });
    }
  };

  const answerByVoice = async () => {
    if (!live || listening) return;
    setVoiceError(null);
    setNoSpeech(false);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const s = sentenceOf(live.q);
      // 말해보카 핸즈프리: "yes"라고 말하면 힌트
      if (alts.some((a) => /^(yes|예스)\.?$/i.test(a.trim()))) {
        setListening(false);
        hint();
        return;
      }
      setHeard(alts[0] ?? null);
      if (containsAnswer(alts, s.answer, live.q.word.word)) {
        await finalize(live, 'voice');
      } else {
        const heard = alts[0] ?? '';
        markWrong(live, heard || '(인식 안 됨)', 'red', `'${heard}'(이)라고 들렸어요. 다시 말해 보세요.`, true);
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'no-speech') setNoSpeech(true);
      else setVoiceError(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  const favNotes = useFavNotes();
  const past = phase === 'answered' ? history.slice(0, -1) : history;
  const hist = histIdx != null ? (past[histIdx] ?? null) : null;
  const shown: Answered | null = hist ?? (phase === 'answered' ? answered : null);
  /** 오답 말풍선 ♥ 용: 지금 카드의 마지막 등록 오답 */
  const lastWrong = !hist && live && live.wrongs.length ? live.wrongs[live.wrongs.length - 1] : null;

  const sayIt = async () => {
    const target = shown;
    if (!target || listening) return;
    setOverlay(null);
    setSayResult(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const s = sentenceOf(target.q);
      const full = fullSentence(s.en, s.answer);
      let best = 0;
      let bestText = alts[0] ?? '';
      for (const a of alts) {
        const r = speechMatchRate(a, full);
        if (r > best) {
          best = r;
          bestText = a;
        }
      }
      const pct = Math.round(best * 100);
      const lv = settingsRef.current?.speechLevel ?? 'loose';
      const [pPerfect, pGreat, pGood] = lv === 'strict' ? [0.98, 0.9, 0.75] : lv === 'normal' ? [0.95, 0.8, 0.6] : [0.9, 0.7, 0.5];
      const label = best >= pPerfect ? 'Perfect!' : best >= pGreat ? 'Great!' : best >= pGood ? 'Good!' : 'Nice try!';
      setSayResult({ tone: best >= 0.8 ? 'green' : best >= 0.6 ? 'yellow' : 'red', msg: `${label} ${pct}% 일치 · '${bestText}'` });
      void markPronunciation(target.q.word.id, best >= pGood);
    } catch (e) {
      // 정지 버튼(□)으로 멈춘 경우는 결과 없이 조용히 돌아간다
      if (!(e instanceof Error && e.message === 'aborted')) setSayResult({ tone: 'red', msg: voiceErrorMessage(e) });
    } finally {
      setListening(false);
    }
  };

  const next = useCallback(async () => {
    if (phase !== 'answered') return;
    window.speechSynthesis?.cancel?.();
    setMoreOpen(false);
    setOverlay(null);
    // 말해보카: 이전 카드는 왼쪽으로 빠지고 새 카드가 오른쪽에서 들어오며(0.25초), 패널은 내려가고 자판이 올라온다(0.35초)
    if (answered) {
      const snap = { key: cardKey, item: answered };
      setExiting(snap);
      window.setTimeout(() => setExiting((e) => (e?.key === snap.key ? null : e)), 300);
    }
    setPanelLeaving(true);
    window.setTimeout(() => setPanelLeaving(false), 300);
    if (mode === 'study') {
      const { message, level } = await maybeAdjustLevel();
      if (message) showToast(message);
      pickerRef.current?.setLevel(level);
    }
    await loadNext();
  }, [phase, mode, loadNext, answered, cardKey]);

  const addFavorite = async () => {
    if (!shown) return;
    const key = `${shown.q.word.id}#${shown.q.sentenceIdx}`;
    if (favorites?.includes(key)) await db.favorites.delete(key);
    else await db.favorites.put({ key, wordId: shown.q.word.id, sentenceIdx: shown.q.sentenceIdx, ts: Date.now() });
  };
  const toggleFavorite = async () => {
    if (!shown) return;
    // 처음 누를 때는 말해보카처럼 활용 Tip 2장을 보여준다
    if (!(await db.kv.get('favTipShown'))) {
      setFavTip(1);
      return;
    }
    await addFavorite();
  };

  // 말해보카 실측: 정답 0.55초 뒤 배지가 바뀌고 ♥ 등장, 0.9초 뒤 자판이 내려가며 패널이 올라오고(0.35초) 그때 문장을 읽어 준다
  useEffect(() => {
    if (phase !== 'answered') {
      setPanelReady(false);
      setRevealDue(false);
      return;
    }
    const t1 = window.setTimeout(() => setRevealDue(true), 550);
    const t2 = window.setTimeout(() => {
      setPanelReady(true);
      setKbLeaving(true);
      if (settingsRef.current?.autoSpeak && answered) speakSentence(answered.q);
    }, 900);
    const t3 = window.setTimeout(() => setKbLeaving(false), 900 + 300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cardKey]);

  // 건너뛰기 확인 막대는 3초 뒤 저절로 닫힌다 (말해보카 실측)
  useEffect(() => {
    if (!skipAsk) return;
    const t = window.setTimeout(() => setSkipAsk(false), 3000);
    return () => window.clearTimeout(t);
  }, [skipAsk]);

  useEffect(() => {
    const t = window.setTimeout(() => setBarReady(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  // 말해보카: 음성 모드에서는 문제가 나오면 바로 듣기 시작
  useEffect(() => {
    if (inputMode !== 'voice' || phase !== 'question' || !live || listening || live.showedAnswer || !canRecognize()) return;
    const t = window.setTimeout(() => void answerByVoice(), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey, inputMode, phase]);

  // 실제 키보드(블루투스/PC)도 지원
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || showSettings || goalReached) return;
      if (phase === 'question' && inputMode === 'voice') {
        if (e.key === '1') hint();
        else if (e.key === '0') setInputMode('keyboard');
        else if (e.key === 'Enter') void answerByVoice();
        return;
      }
      if (phase === 'answered') {
        if (e.key === 'Enter') {
          e.preventDefault();
          void next();
        }
        return;
      }
      if (phase !== 'question' || inputMode !== 'keyboard') return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (e.key === ' ') {
        e.preventDefault();
        space();
      } else if (/^[a-zA-Z'-]$/.test(e.key)) {
        e.preventDefault();
        typeChar(capNext ? e.key.toUpperCase() : e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!settings || phase === 'loading') {
    return (
      <div className="quiz-screen center">
        <p className="muted-light">준비 중…</p>
      </div>
    );
  }

  if (phase === 'nowords') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">단어 데이터가 아직 없어요.</p>
        <button
          className="btn primary"
          onClick={() =>
            syncContent()
              .then(() => window.location.reload())
              .catch(() => alert('받기에 실패했어요. 연결을 확인해 주세요.'))
          }
        >
          단어 데이터 받기
        </button>
        <button className="btn ghost-light" onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    );
  }

  if (phase === 'empty' && listIds) {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} mood="cheer" />
        <p className="quiz-msg">히스토리 학습을 마쳤어요</p>
        <p className="muted-light small">고른 단어 {listIds.length}개를 모두 풀었어요.</p>
        <button className="btn primary" onClick={() => nav(-1)}>
          돌아가기
        </button>
      </div>
    );
  }
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">지금 풀 문제가 없어요</p>
        <p className="muted-light small">복습할 단어가 아직 때가 안 됐고, 지금 레벨 근처의 새 단어도 다 학습했어요. 새 단어 팩이 추가되면 이어서 학습할 수 있어요.</p>
        <button className="btn primary" onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    );
  }

  if (phase === 'testResult') {
    return (
      <div className="result-screen">
        <Mascot size={130} mood="cheer" />
        <p className="result-sub">레벨 테스트 완료!</p>
        <p className="result-level">레벨 {testLevel}</p>
        <p className="result-desc">이 레벨 근처의 단어부터 오늘의 어휘를 시작해요. 학습 결과에 따라 레벨은 자동으로 조정되고, 설정에서 직접 바꿀 수도 있어요.</p>
        <button className="btn primary big" onClick={() => nav('/', { replace: true })}>
          학습 시작하기
        </button>
      </div>
    );
  }

  if (!live) return null;
  const q = hist ? hist.q : live.q;
  const sentence = sentenceOf(q);
  const goal = settings.dailyGoal;
  const total = mode === 'test' ? LEVEL_TEST_QUESTIONS : Math.max(goal, extraTarget);
  const count = mode === 'test' ? testAsked : todayTotal;
  const fill = Math.min(1, count / total);
  const isAnswered = shown;
  // 말해보카 실측(2026-11-10): 오른쪽으로 밀면 이전(푼) 카드, 왼쪽으로 밀면 이 문제 미루기.
  // 새 단어는 미룰 수 없고(토스트), 힌트·오답 뒤에도 안 된다(토스트). 깨끗한 복습 카드는 풍경 위에 확인 막대가 3초 동안 뜬다
  const askSkip = () => {
    if (!live || phase !== 'question' || mode === 'test') return;
    if (live.q.isNew) {
      showToast('새로 배우는 단어는 미룰 수 없습니다.');
      return;
    }
    if (live.hints > 0 || live.showedAnswer || live.wrongs.length > 0) {
      showToast('이 문제는 더 이상 미룰 수 없습니다.');
      return;
    }
    setSkipAsk(true);
  };
  const doSkip = () => {
    if (!live) return;
    setSkipAsk(false);
    deferred.current.push({ q: live.q, after: cardsSeen.current + 3 });
    void loadNext();
  };
  const goBack = () => {
    if (histIdx == null) {
      if (past.length) {
        setSlideBack(true);
        setHistIdx(past.length - 1);
      }
    } else if (histIdx > 0) {
      setSlideBack(true);
      setHistIdx(histIdx - 1);
    }
  };
  const goForward = () => {
    if (histIdx != null) {
      setSlideBack(false);
      setHistIdx(histIdx + 1 < past.length ? histIdx + 1 : null);
    } else if (phase === 'answered' && panelReady) void next();
    else if (phase === 'question') askSkip();
  };
  const favKey = `${q.word.id}#${q.sentenceIdx}`;

  // 배지: New / N일 전 / 재도전(틀렸다가 다시 나온 단어) → 정답 0.55초 뒤 'N 뒤 복습' (말해보카)
  let badge: CardBadge = { kind: 'new' };
  if (isAnswered && (hist || revealDue)) badge = { kind: 'due', text: `${formatAfter(isAnswered.due)} 복습` };
  else if (!q.isNew && q.card?.state === State.Relearning) badge = { kind: 'retry' };
  else if (!q.isNew && q.card?.last_review) badge = { kind: 'ago', text: formatAgo(q.card.last_review) };

  const feedback = isAnswered ? sayResult : live.feedback;

  // 말해보카: '다른 예문'·'오답 노트'는 퀴즈 카드 자리에 다른 카드가 대신 나온다 (빅데이터 예문 카드)
  let infoCard: ReactNode = null;
  if (isAnswered && overlay === 'examples') {
    const w = isAnswered.q.word;
    const others = w.sentences.map((s, i) => ({ s, i })).filter(({ i }) => i !== isAnswered.q.sentenceIdx);
    const female = settings.voiceGender === 'female';
    infoCard = (
      <InfoCard
        icon={<QBookOutline />}
        title="다른 예문"
        right={
          <button className="info-card-ctl" onClick={() => void saveSettings({ voiceGender: female ? 'male' : 'female' })}>
            <QSwap />
            <span>{female ? '여자 음성' : '남자 음성'}</span>
          </button>
        }
      >
        {others.length === 0 && <p className="overlay-empty">예문을 준비중입니다.</p>}
        {others.map(({ s, i }) => (
          <div key={i} className="ex-item big">
            <p className="ex-en" lang="en">
              <FilledSentence sentence={s} />
            </p>
            {/* 말해보카는 이 자리에 예문 출처를 적는다. 우리는 출처 대신 그 문장의 뜻을 같은 모양(작은 회색, 오른쪽 정렬)으로 보여 준다 */}
            <p className="ex-src">
              <KoText text={s.ko.split('**').join('')} />
            </p>
            <button className="ex-play" onClick={() => speak(fullSentence(s.en, s.answer), settings.speechRate === 'slow')} aria-label="듣기">
              <QSpeak />
            </button>
          </div>
        ))}
      </InfoCard>
    );
  }
  // 오답 노트 (말해보카 실측 2026-11-10): 카드를 대신하지 않고 카드 아래쪽에 겹쳐 뜬다. 그 문장에 등록된 답(정답/비슷/오답)과 설명 목록, 항목마다 ♥
  const notes = sentence.alts ?? [];
  const notePanel =
    isAnswered && overlay === 'wrongs' ? (
      <div className="note-panel">
        {notes.length === 0 && <p className="note-empty">이 문장에는 오답 노트가 없어요.</p>}
        {notes.map((a, i) => {
          const tone: Tone = a.t === 'ok' ? 'green' : a.t === 'near' ? 'yellow' : 'red';
          const fav = favNotes?.some((n) => n.key === favNoteKey(q.word.id, q.sentenceIdx, a.w)) ?? false;
          return (
            <div key={i} className="note-item">
              <div className="note-head">
                <span className={`note-chip ${a.t}`}>{a.t === 'ok' ? '정답' : a.t === 'near' ? '비슷' : '오답'}</span>
                <b lang="en">{a.w}</b>
                <button className={`note-heart ${fav ? 'on' : ''}`} onClick={() => void toggleFavNote({ wordId: q.word.id, sentenceIdx: q.sentenceIdx, w: a.w, tone, m: a.m })} aria-label="좋아하는 오답노트">
                  <Icon name="heartFill" size={20} />
                </button>
              </div>
              <p>
                <KoText text={a.m} />
              </p>
            </div>
          );
        })}
      </div>
    ) : null;

  const showPanel = !!isAnswered && (panelReady || !!hist);
  /** 추가 학습 목표를 채운 마지막 카드: '다음 문제' 대신 초록 '학습 완료' (말해보카) */
  const finish = mode === 'study' && extraTarget > 0 && todayTotal >= total && !hist;
  // 힌트 버튼 (말해보카 실측 2026-11-10): 힌트 보기(?) → 정답 보기(✓). 맞는 다른 답(초록 말풍선)을 내면 잠깐 '보너스 힌트'(상자)가 되고, 쓰면 원래 단계로 돌아간다
  const hintLabel = live.bonusReady ? '보너스 힌트' : !live.hintUsed ? '힌트 보기' : '정답 보기';
  const hintIcon = live.bonusReady ? <QBonus /> : !live.hintUsed ? <QHint /> : <QReveal />;
  const bubbleHit = dictWords?.get(sentence.answer.toLowerCase());
  const fullEn = fullSentence(sentence.en, sentence.answer);
  const panelItem = showPanel ? isAnswered : panelLeaving ? exiting?.item ?? null : null;
  const inWordbook = wordbook?.includes(q.word.id) ?? false;
  const sheetActions: SheetAction[] = isAnswered
    ? [
        { key: 'due', icon: 'clock', label: '복습 주기', onClick: () => showToast(`다음 복습: ${formatAfter(isAnswered.due)}`) },
        { key: 'dict', icon: 'search', label: '사전 검색', onClick: () => nav(`/dict?q=${encodeURIComponent(q.word.word)}`) },
        { key: 'wb', icon: 'star', label: '내 단어장', active: inWordbook, onClick: () => void toggleWordbook(q.word.id).then((on) => showToast(on ? '내 단어장에 담았어요' : '내 단어장에서 뺐어요')) },
        { key: 'word', icon: 'headphones', label: '단어 듣기', onClick: () => speak(q.word.word) },
        { key: 'x05', icon: 'play', label: 'x0.5 듣기', onClick: () => speak(fullEn, false, 0.5) },
        { key: 'x08', icon: 'play', label: 'x0.8 듣기', onClick: () => speak(fullEn, false, 0.8) },
        { key: 'ex', icon: 'chat', label: '다른 예문', active: overlay === 'examples', onClick: () => { setMoreOpen(false); setOverlay((o) => (o === 'examples' ? null : 'examples')); } },
        { key: 'wr', icon: 'note', label: '오답 노트', active: overlay === 'wrongs', onClick: () => { setMoreOpen(false); setOverlay((o) => (o === 'wrongs' ? null : 'wrongs')); } },
        { key: 'say', icon: 'mic', label: '말해보기', onClick: () => { setMoreOpen(false); void sayIt(); } },
        { key: 'info', icon: 'book', label: '단어 정보', onClick: () => nav(`/words/${encodeURIComponent(q.word.id)}`) },
      ]
    : [];

  return (
    <div className={`quiz-screen vocab-quiz theme-${settings.studyTheme}${isAnswered ? ' answered' : ''}${notePanel ? ' notes-open' : ''}${infoCard ? ' examples-open' : ''}`}>
      {settings.studyTheme === 'sky' ? (
        <Backdrop theme="sky" />
      ) : (
        <div className="scene-layer dino-bg" aria-hidden="true">
          <DinoScene variant={sceneVariant} />
        </div>
      )}
      <header className="quiz-top">
        {guard.modal}
        <button className="qt-btn qt-back" onClick={mode === 'test' ? () => nav('/') : guard.leave} aria-label="나가기">
          <QBack />
        </button>
        {/* 말해보카 실측: 채움 끝 x = 82 + 210 × (푼 수 / 목표) (화면 폭 360 기준), 그 오른쪽에 작은 공룡 */}
        <div className="quiz-progress" style={{ '--f': barReady ? fill : 0 } as CSSProperties}>
          <div className="progress-track">
            <div className="progress-fill" />
            <span className="progress-head" aria-hidden="true">
              <QHead />
            </span>
          </div>
          <span className={`trophy-badge ${count >= total ? 'gold' : ''}`}>
            <QStreak />
          </span>
          <span className="progress-label">
            {count}/{total}
          </span>
        </div>
        <button className="qt-btn qt-gear" onClick={() => setShowSettings(true)} aria-label="설정">
          <QGear />
        </button>
      </header>
      {mode === 'test' && <p className="test-caption">레벨 테스트 · 모르면 힌트나 정답 보기를 눌러도 괜찮아요</p>}
      {toast && <div className="toast">{toast}</div>}

      <main className="quiz-stage">
        <div className="sky-row">
          <Pterodactyls flights={flights} />
        </div>
        <div className="card-row">
          <div className="card-stage">
            {exiting && (
              <div className="card-slide exit" key={`x${exiting.key}`} aria-hidden="true">
                <QuizCard
                  word={exiting.item.q.word}
                  sentence={sentenceOf(exiting.item.q)}
                  state="answered"
                  input={sentenceOf(exiting.item.q).answer}
                  showedAnswer={false}
                  showCaret={false}
                  blankMatchesLength={settings.blankMatchesLength}
                  flash={null}
                  feedback={null}
                  badge={{ kind: 'due', text: `${formatAfter(exiting.item.due)} 복습` }}
                  heart
                  favorite={favorites?.includes(`${exiting.item.q.word.id}#${exiting.item.q.sentenceIdx}`) ?? false}
                  onToggleFavorite={() => undefined}
                  onLevelHelp={() => undefined}
                />
              </div>
            )}
            <div
              className={`card-slide ${slideBack ? 'back' : ''}`}
              key={hist ? `h${histIdx}` : cardKey}
              onTouchStart={(e) => {
                swipeX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - swipeX.current;
                if (dx > 70) goBack();
                else if (dx < -70) goForward();
              }}
            >
              <div className="card-rel">
                {infoCard ?? (
                  <QuizCard
                    word={q.word}
                    sentence={sentence}
                    state={isAnswered ? 'answered' : 'question'}
                    input={hist ? sentence.answer : live.input}
                    showedAnswer={hist ? false : live.showedAnswer}
                    hintText={hist ? '' : live.hintText}
                    showCaret={inputMode === 'keyboard' && phase === 'question' && !hist}
                    blankMatchesLength={settings.blankMatchesLength}
                    flash={flash}
                    feedback={feedback}
                    noteFavorite={!!lastWrong && (favNotes?.some((n) => n.key === favNoteKey(q.word.id, q.sentenceIdx, lastWrong.w)) ?? false)}
                    onFavoriteNote={lastWrong ? () => void toggleFavNote({ wordId: q.word.id, sentenceIdx: q.sentenceIdx, w: lastWrong.w, tone: lastWrong.tone, m: lastWrong.m }) : undefined}
                    badge={badge}
                    heart={!!isAnswered && (!!hist || revealDue)}
                    favorite={favorites?.includes(favKey) ?? false}
                    onToggleFavorite={() => void toggleFavorite()}
                    onLevelHelp={() => setLevelHelp((v) => !v)}
                    onBadgeHelp={() => setInfoOpen(true)}
                  />
                )}
                {notePanel}
                {inputMode === 'voice' && phase === 'question' && !hist && (
                  <>
                    <button className="hands-btn" onClick={() => setHandsTip((v) => !v)} aria-label="핸즈프리">
                      <Icon name="hand" size={18} />
                    </button>
                    {handsTip && (
                      <div className="hands-tip" onClick={() => setHandsTip(false)}>
                        힌트를 보고 싶다면 <b>yes</b>라고 말해보세요.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="scene-row" />
      </main>

      <div className="quiz-bottom">
        {skipAsk && (
          <div className="skip-bar">
            <p>
              이 문제는 건너뛰었다가
              <br />
              잠시 후, 다시 도전할까요?
            </p>
            <button className="skip-no" onClick={() => setSkipAsk(false)} aria-label="아니요">
              <Icon name="close" size={14} />
            </button>
            <button className="skip-yes" onClick={doSkip} aria-label="건너뛰기">
              <Icon name="check" size={16} />
            </button>
          </div>
        )}
        {panelItem && (
          <AfterPanel
            className={!showPanel && panelLeaving ? 'leave' : kbLeaving ? 'enter' : ''}
            answer={sentenceOf(panelItem.q).answer}
            answerIsWord
            onBubble={() => bubbleHit && setTypedPop((v) => !v)}
            bubbleExtra={
              typedPop && bubbleHit ? <DictPop word={bubbleHit} onClose={() => setTypedPop(false)} onSearch={() => nav(`/dict?q=${encodeURIComponent(bubbleHit.word)}`)} /> : undefined
            }
            wrongCount={(sentenceOf(panelItem.q).alts ?? []).length}
            listening={listening && showPanel}
            onStopListening={() => window.dispatchEvent(new Event('voca:stop-listening'))}
            examplesOpen={overlay === 'examples'}
            wrongsOpen={overlay === 'wrongs'}
            onExamples={() => setOverlay((o) => (o === 'examples' ? null : 'examples'))}
            onWrongs={() => setOverlay((o) => (o === 'wrongs' ? null : 'wrongs'))}
            onSay={() => void sayIt()}
            onInfo={() => nav(`/words/${encodeURIComponent(q.word.id)}`)}
            onWordbook={() => void toggleWordbook(q.word.id).then((on) => showToast(on ? '내 단어장에 담았어요.' : '내 단어장에서 뺐어요.'))}
            inWordbook={inWordbook}
            onSlow={() => speakSentence(q, true)}
            onReplay={() => speakSentence(q)}
            onNext={() => (hist ? setHistIdx(null) : finish ? nav('/') : void next())}
            finish={finish}
            onMore={() => setMoreOpen(true)}
          />
        )}
        {(!showPanel || kbLeaving) && inputMode === 'keyboard' && (
          <div className={`quiz-input ${kbLeaving ? 'leave' : panelLeaving ? 'enter' : ''}`}>
            <div className="toolbar">
              <button className="tool-btn" onClick={hint} disabled={live.showedAnswer}>
                {cardKey === 1 && <span className="kbd-hint tl">1</span>}
                {hintIcon}
                <span>{hintLabel}</span>
              </button>
              <div className="toolbar-center">
                {(live.input || (live.showedAnswer && live.hintText)) &&
                  (() => {
                    // 말해보카: 정답 보기 뒤 칸은 비지만 말풍선에는 힌트 글자가 그대로 남아 있다 (힌트 글자를 손으로 다 지웠을 때는 말풍선도 사라진다)
                    const text = live.input || live.hintText;
                    const hit = dictWords?.get(text.trim().toLowerCase());
                    return (
                      <>
                        {hit && tipSeen === false && tipOpen && (
                          <span className="typed-tip">
                            눌러서 뜻을 확인해 보세요.
                            <button
                              onClick={() => {
                                setTipOpen(false);
                                void db.kv.put({ key: 'typedTipSeen', value: 1 });
                              }}
                              aria-label="닫기"
                            >
                              ×
                            </button>
                          </span>
                        )}
                        <button className="bubble" lang="en" onClick={() => hit && setTypedPop((v) => !v)}>
                          {text.split(' ').map((tok, n) => (
                            <span key={n} className={knownTokens?.has(tok.toLowerCase()) ? 'u' : ''}>
                              {n > 0 ? ' ' : ''}
                              {tok}
                            </span>
                          ))}
                        </button>
                        {typedPop && hit && <DictPop word={hit} onClose={() => setTypedPop(false)} onSearch={() => nav(`/dict?q=${encodeURIComponent(hit.word)}`)} />}
                      </>
                    );
                  })()}
              </div>
              <button className="tool-btn" onClick={() => setInputMode('voice')} disabled={!canRecognize()}>
                {cardKey === 1 && <span className="kbd-hint tr">0</span>}
                <QMic />
                <span>음성 모드</span>
              </button>
            </div>
            <Keyboard onChar={typeChar} onBackspace={backspace} onSpace={space} onEnter={submit} shift={capNext} apostrophe={sentence.answer.includes("'")} />
          </div>
        )}
        {!showPanel && inputMode === 'voice' && (
          <div className="voice-zone">
            <div className="voice-bubble-row">
              {voiceError ? (
                <span className="voice-error">{voiceError}</span>
              ) : heard || live.input ? (
                <span className="bubble link">{heard ?? live.input}</span>
              ) : (
                <span className="voice-hint" />
              )}
            </div>
            <div className={`voice-halo ${listening ? 'listening' : ''}`}>
              <span className="kbd-hint enter">Enter</span>
              <button className={`mic-big ${listening ? 'on' : ''} ${noSpeech && !listening ? 'on nospeech' : ''}`} onClick={() => void answerByVoice()} aria-label={listening ? '듣는 중' : '말하기'}>
                {listening ? (
                  <>
                    <span className="stop-square" />
                    <small>듣고 있어요</small>
                  </>
                ) : noSpeech ? (
                  <>
                    <Icon name="mic" size={34} />
                    <small>다시 해 보세요</small>
                  </>
                ) : (
                  <Icon name="mic" size={40} />
                )}
              </button>
            </div>
            <div className="voice-bar">
              <button className="tool-btn" onClick={hint} disabled={live.showedAnswer}>
                <span className="kbd-hint">1</span>
                {hintIcon}
                <span>{hintLabel}</span>
              </button>
              <button className="tool-btn" onClick={() => setInputMode('keyboard')}>
                <span className="kbd-hint">0</span>
                <Icon name="keyboard" size={26} className="ic-hint" />
                <span>키보드 모드</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {moreOpen && isAnswered && (
        <ExtraSheet
          actions={sheetActions}
          onClose={() => setMoreOpen(false)}
          onSlow={() => speakSentence(q, true)}
          onReplay={() => speakSentence(q)}
          onNext={() => {
            setMoreOpen(false);
            if (finish) nav('/');
            else void next();
          }}
          finish={finish}
        />
      )}

      {favTip > 0 && (
        <FavTip
          page={favTip === 2 ? 2 : 1}
          onNext={() => setFavTip(2)}
          onNo={() => {
            void db.kv.put({ key: 'favTipShown', value: 1 });
            setFavTip(0);
          }}
          onYes={() => {
            void db.kv.put({ key: 'favTipShown', value: 1 }).then(addFavorite);
            setFavTip(0);
          }}
        />
      )}
      {showSettings && (
        <div className="vs-overlay">
          <VocabSettings s={settings} onBack={() => setShowSettings(false)} />
        </div>
      )}

      {levelHelp && <LevelHelp level={q.word.level} onClose={() => setLevelHelp(false)} />}
      {infoOpen && <StudyInfoSheet word={q.word} onClose={() => setInfoOpen(false)} />}
      {goalReached && <GoalReached total={todayTotal} onMore={() => setGoalReached(false)} onHome={() => nav('/')} />}
    </div>
  );
}

/** 보라 말풍선을 누르면 카드 아래에 뜨는 사전 검색 결과 패널 (말해보카 실측: 머리 알약 '사전 검색 결과' + 표제어·품사 칩·검색 아이콘 + 뜻, 아래 가운데 꼬리) */
function DictPop({ word, onClose, onSearch }: { word: StoredWord; onClose: () => void; onSearch: () => void }) {
  return (
    <div className="dict-pop" onClick={onClose}>
      <div className="dict-pop-head">사전 검색 결과예요</div>
      <div className="dict-pop-row">
        <b>{word.word}</b>
        <span className="dict-pop-pos">{POS_KO[word.pos]}</span>
        <button
          className="dict-pop-search"
          onClick={(e) => {
            e.stopPropagation();
            onSearch();
          }}
          aria-label="사전에서 찾기"
        >
          <Icon name="search" size={18} />
        </button>
      </div>
      <p>{word.meanings.join(', ')}</p>
    </div>
  );
}

function GoalReached({ total, onMore, onHome }: { total: number; onMore: () => void; onHome: () => void }) {
  const today = useLiveQuery(() => db.daily.get(studyDateOf()), []);
  const acc = today && today.total ? Math.round((today.correct / today.total) * 100) : 0;
  return (
    <div className="modal-dim">
      <div className="modal goal-reached">
        <div className="trophy-big">
          <Icon name="trophy" size={64} />
        </div>
        <p className="modal-title big">오늘의 목표 달성!</p>
        <p className="modal-desc">어휘 트로피를 받았어요. 내일도 잊기 전에 만나요.</p>
        <div className="gr-stats">
          <div>
            <b>{total}</b>
            <span>오늘 푼 문제</span>
          </div>
          <div>
            <b>{acc}%</b>
            <span>한 번에 정답</span>
          </div>
          <div>
            <b>{formatDuration(today?.timeMs ?? 0)}</b>
            <span>학습 시간</span>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn gray" onClick={onHome}>
            홈으로
          </button>
          <button className="btn primary" onClick={onMore}>
            추가 학습
          </button>
        </div>
      </div>
    </div>
  );
}
