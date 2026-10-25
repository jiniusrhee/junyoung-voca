import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel from '../components/AfterPanel';
import FavTip from '../components/FavTip';
import Icon from '../components/Icon';
import Keyboard from '../components/Keyboard';
import Mascot from '../components/Mascot';
import VocabSettings from '../components/VocabSettings';
import QuizCard, { FilledSentence, type CardBadge } from '../components/QuizCard';
import WrongItem from '../components/WrongItem';
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
import { answerWords, containsAnswer, evaluate, feedbackFor, fullSentence, hintPrefix, normalize, speechMatchRate } from '../lib/text';
import { formatAfter, formatAgo, formatDuration, studyDateOf } from '../lib/time';
import { POS_KO, type Settings, type Tone, type WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty' | 'nowords' | 'testResult';
type Overlay = 'examples' | 'wrongs' | 'info' | null;

interface Live {
  q: Question;
  input: string;
  /** 힌트로 채워진 앞글자 수 (지울 수 없음) */
  locked: number;
  hints: number;
  showedAnswer: boolean;
  wrongAttempts: number;
  wrongs: WrongNote[];
  feedback: { tone: Tone; msg: string; mask?: { text: string; bad: boolean }[] } | null;
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
  locked: 0,
  hints: 0,
  showedAnswer: false,
  wrongAttempts: 0,
  wrongs: [],
  feedback: null,
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
  const [flash, setFlash] = useState<{ kind: 'wrong' | 'correct'; key: number } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sayResult, setSayResult] = useState<{ tone: Tone; msg: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  /** 말해보카: 몇 초 안에 못 들으면 마이크 원 안에 '듣지 못했어요' */
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
  /** 자판 왼쪽 아래 빈 키: 한 번 누르면 다음 한 글자만 대문자 (말해보카) */
  const [shiftOn, setShiftOn] = useState(false);
  const favorites = useLiveQuery(() => db.favorites.toCollection().primaryKeys(), []) as string[] | undefined;
  // 입력 말풍선: 사전(단어 팩)에 있는 단어면 밑줄 + 누르면 뜻 (말해보카)
  const dictWords = useLiveQuery(async () => new Map((await db.words.toArray()).map((w) => [w.word.toLowerCase(), w])), []);
  const [typedPop, setTypedPop] = useState(false);
  const tipSeen = useLiveQuery(async () => !!(await db.kv.get('typedTipSeen')), []);
  const [tipOpen, setTipOpen] = useState(true);
  const guard = useLeaveGuard(() => nav('/'));

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
    setShiftOn(false);
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
    const q = await pickerRef.current?.next();
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
        if (!outcome.showedAnswer) d.solved += 1;
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
      setLive({ ...l, feedback: null });
      const item: Answered = { q: l.q, outcome, known, due: row.due, wrongs: l.wrongs };
      setAnswered(item);
      setHistory((h) => [...h.slice(-19), item]);
      setFlash({ kind: 'correct', key: Date.now() });
      sfx('correct');
      setPhase('answered');
      if (s.autoSpeak) speakSentence(l.q);
      if (metNow && mode === 'study') {
        window.setTimeout(() => setGoalReached(true), 1100);
        void pushInbox('🏆 오늘 목표 달성!', '하루 목표를 채웠어요. 추가 학습으로 더 나아가 보세요.', '/');
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
      // 힌트로 채운 앞글자는 지워지지 않는다
      if (l.locked && !next.startsWith(l.input.slice(0, l.locked))) next = l.input.slice(0, l.locked) + next.slice(l.locked);
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
      return { ...l, input: next, feedback: next === l.input ? l.feedback : null };
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
  const typeChar = (c: string) => {
    editInput((cur) => cur + c);
    if (shiftOn) setShiftOn(false);
  };
  /** 말해보카: 스페이스는 제출. 정답이 여러 단어면 다음 칸으로 */
  const space = () => {
    if (!live) return;
    const need = sentenceOf(live.q).answer.trim().split(/\s+/).length;
    const have = live.input.trim().split(/\s+/).filter(Boolean).length;
    if (need > 1 && have < need && live.input && !live.input.endsWith(' ')) editInput((cur) => cur + ' ');
    else submit();
  };
  const backspace = () => editInput((cur) => cur.slice(0, -1));

  const markWrong = (l: Live, w: string, tone: Tone, msg: string, penalize: boolean, showPill = true, mask?: { text: string; bad: boolean }[]) => {
    setLive({
      ...l,
      feedback: showPill ? { tone, msg, mask } : null,
      wrongAttempts: l.wrongAttempts + (penalize ? 1 : 0),
      wrongs: [...l.wrongs, { w, tone, m: msg }],
    });
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
    // 말해보카: 등록된 오답(설명 있음)과 오타만 말풍선, 그 밖의 오답은 카드만 잠깐 붉게
    markWrong(live, live.input.trim(), fb.tone, fb.msg, !fb.bonus, e.kind === 'alt' || e.kind === 'typo', fb.mask);
  };

  const hint = () => {
    if (!live || phase !== 'question' || live.showedAnswer) return;
    const answer = sentenceOf(live.q).answer;
    if (live.hints === 0) {
      const pre = hintPrefix(answer);
      setLive({ ...live, hints: 1, input: pre, locked: pre.length, feedback: null });
    } else {
      // 말해보카: 정답이 칸에 주황색으로 비치고, 그대로 따라 쳐야 한다 (말풍선 없음)
      setLive({ ...live, showedAnswer: true, input: '', locked: 0, feedback: null });
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
      setSayResult({ tone: 'red', msg: voiceErrorMessage(e) });
    } finally {
      setListening(false);
    }
  };

  const next = useCallback(async () => {
    if (phase !== 'answered') return;
    window.speechSynthesis?.cancel?.();
    if (mode === 'study') {
      const { message, level } = await maybeAdjustLevel();
      if (message) showToast(message);
      pickerRef.current?.setLevel(level);
    }
    await loadNext();
  }, [phase, mode, loadNext]);

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

  useEffect(() => {
    if (phase !== 'answered') {
      setPanelReady(false);
      return;
    }
    const t = window.setTimeout(() => setPanelReady(true), 1000);
    return () => window.clearTimeout(t);
  }, [phase, cardKey]);

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
  };
  const favKey = `${q.word.id}#${q.sentenceIdx}`;

  let badge: CardBadge = { kind: 'new' };
  if (isAnswered) badge = { kind: 'due', text: `${formatAfter(isAnswered.due)} 복습` };
  else if (!q.isNew && q.card?.last_review) badge = { kind: 'ago', text: formatAgo(q.card.last_review) };

  const feedback = isAnswered ? sayResult : live.feedback;

  let cardOverlay = null;
  if (isAnswered && overlay) {
    const w = isAnswered.q.word;
    cardOverlay = (
      <div className="card-overlay">
        <button className="overlay-close" onClick={() => setOverlay(null)} aria-label="닫기">
          <Icon name="close" size={18} />
        </button>
        {overlay === 'examples' && (
          <>
            <p className="overlay-title">
              <Icon name="book" size={16} /> 다른 예문
              <label className="ex-voice">
                여자 음성
                <input type="checkbox" checked={settings.voiceGender === 'female'} onChange={(e) => void saveSettings({ voiceGender: e.target.checked ? 'female' : 'random' })} />
                <span className="toggle" />
              </label>
            </p>
            {w.sentences.filter((_, i) => i !== isAnswered.q.sentenceIdx).length === 0 && <p className="overlay-empty">예문을 준비중입니다.</p>}
            {w.sentences
              .map((s, i) => ({ s, i }))
              .filter(({ i }) => i !== isAnswered.q.sentenceIdx)
              .map(({ s, i }) => (
                <div key={i} className="ex-item big">
                  <p className="ex-en">
                    <FilledSentence sentence={s} />
                  </p>
                  {s.ctx && <p className="ex-src">{s.ctx}</p>}
                  <button className="ex-play" onClick={() => speak(fullSentence(s.en, s.answer), settings.speechRate === 'slow')} aria-label="듣기">
                    <Icon name="speaker" size={20} />
                  </button>
                </div>
              ))}
          </>
        )}
        {overlay === 'wrongs' && (
          <>
            <p className="overlay-title">
              <Icon name="note" size={16} /> 오답 노트
            </p>
            {isAnswered.wrongs.length === 0 && <p className="overlay-empty">이번 문제는 틀린 답 없이 맞혔어요!</p>}
            {isAnswered.wrongs.map((x, i) => (
              <WrongItem key={i} w={x.w} tone={x.tone} m={x.m} />
            ))}
            {(sentence.alts ?? []).filter((a) => !isAnswered.wrongs.some((x) => normalize(x.w) === normalize(a.w))).length > 0 && (
              <>
                <p className="overlay-sub">이런 답도 헷갈리기 쉬워요</p>
                {(sentence.alts ?? [])
                  .filter((a) => !isAnswered.wrongs.some((x) => normalize(x.w) === normalize(a.w)))
                  .map((a, i) => {
                    const tone: Tone = a.t === 'ok' ? 'green' : a.t === 'near' ? 'yellow' : 'red';
                    return <WrongItem key={i} w={a.w} tone={tone} m={a.m} soft />;
                  })}
              </>
            )}
          </>
        )}
        {overlay === 'info' && (
          <>
            <p className="overlay-hint">이 문장에서 쓰인 뜻입니다.</p>
            <div className="info-head">
              <span className="info-word">{w.word}</span>
              <span className="chip">{POS_KO[w.pos]}</span>
              <button className="icon-btn small" onClick={() => speak(w.word)} aria-label="발음 듣기">
                <Icon name="speaker" size={18} />
              </button>
            </div>
            <p className="info-mean">{w.meanings.join(', ')}</p>
            {w.nuance && (
              <div className="info-block">
                <span className="info-label">뉘앙스</span>
                <p>{w.nuance}</p>
              </div>
            )}
            {w.etymology && (
              <div className="info-block">
                <span className="info-label">어원</span>
                <p>{w.etymology}</p>
              </div>
            )}
            <button className="link-btn" onClick={() => nav(`/words/${encodeURIComponent(w.id)}`)}>
              단어 상세 보기 <Icon name="chevron" size={14} />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="quiz-screen vocab-quiz">
      <Backdrop theme={settings.studyTheme} />
      <header className="quiz-top">
        {guard.modal}
        <button className="icon-btn light" onClick={mode === 'test' ? () => nav('/') : guard.leave} aria-label="나가기">
          <Icon name="back" size={24} />
        </button>
        <div className="quiz-progress">
          <span className={`trophy-badge ${count >= total ? 'gold' : ''}`}>
            <Icon name={settings.studyTheme === 'dino' ? 'drop' : 'trophy'} size={18} />
          </span>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.max(fill * 100, 14)}%` }}>
              <span>
                {count}/{total}
              </span>
            </div>
          </div>
        </div>
        <button className="icon-btn light" onClick={() => setShowSettings(true)} aria-label="설정">
          <Icon name="gear" size={24} />
        </button>
      </header>
      {mode === 'test' && <p className="test-caption">레벨 테스트 · 모르면 힌트나 정답 보기를 눌러도 괜찮아요</p>}
      {toast && <div className="toast">{toast}</div>}

      <main className="quiz-stage">
        <div className="side-card left" />
        <div className="side-card right" />
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
          <QuizCard
            word={q.word}
            sentence={sentence}
            state={isAnswered ? 'answered' : 'question'}
            input={hist ? sentence.answer : live.input}
            showedAnswer={hist ? false : live.showedAnswer}
            showCaret={inputMode === 'keyboard' && phase === 'question' && !hist}
            blankMatchesLength={settings.blankMatchesLength}
            flash={flash}
            feedback={feedback}
            noteFavorite={!!lastWrong && (favNotes?.some((n) => n.key === favNoteKey(q.word.id, q.sentenceIdx, lastWrong.w)) ?? false)}
            onFavoriteNote={lastWrong ? () => void toggleFavNote({ wordId: q.word.id, sentenceIdx: q.sentenceIdx, w: lastWrong.w, tone: lastWrong.tone, m: lastWrong.m }) : undefined}
            badge={badge}
            favorite={favorites?.includes(favKey) ?? false}
            onToggleFavorite={() => void toggleFavorite()}
            onLevelHelp={() => setLevelHelp((v) => !v)}
            levelHelp={levelHelp}
            overlay={cardOverlay}
          />
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
      </main>

      {isAnswered && (panelReady || hist) ? (
        <AfterPanel
          answer={sentence.answer}
          wrongCount={isAnswered.wrongs.length}
          slow={settings.speechRate === 'slow'}
          listening={listening}
          onExamples={() => setOverlay((o) => (o === 'examples' ? null : 'examples'))}
          onWrongs={() => setOverlay((o) => (o === 'wrongs' ? null : 'wrongs'))}
          onSay={() => void sayIt()}
          onInfo={() => nav(`/words/${encodeURIComponent(q.word.id)}`)}
          onToggleSpeed={() => {
            const slow = settings.speechRate !== 'slow';
            void saveSettings({ speechRate: slow ? 'slow' : 'real' });
            speakSentence(q, slow);
          }}
          onReplay={() => speakSentence(q)}
          onNext={() => (hist ? setHistIdx(null) : void next())}
        />
      ) : inputMode === 'keyboard' ? (
        <div className="quiz-input">
          <div className="toolbar">
            <button className="tool-btn" onClick={hint} disabled={live.showedAnswer}>
              {live.hints === 0 ? (
                <Icon name="question" size={26} className="ic-purple" />
              ) : (
                <Icon name="check" size={26} className="ic-green" />
              )}
              <span>{live.hints === 0 ? '힌트 보기' : '정답 보기'}</span>
            </button>
            <div className="toolbar-center">
              {live.input &&
                (() => {
                  const hit = dictWords?.get(live.input.trim().toLowerCase());
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
                      <button className={`bubble ${hit ? 'link' : ''}`} onClick={() => hit && setTypedPop((v) => !v)}>
                        {live.input}
                      </button>
                      {typedPop && hit && (
                        <div className="typed-pop" onClick={() => setTypedPop(false)}>
                          <b>{hit.word}</b>
                          <span className="chip">{POS_KO[hit.pos]}</span>
                          <p>{hit.meanings.join(', ')}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
            </div>
            <button className="tool-btn" onClick={() => setInputMode('voice')} disabled={!canRecognize()}>
              <Icon name="mic" size={26} className="ic-purple" />
              <span>음성 모드</span>
            </button>
          </div>
          <Keyboard onChar={typeChar} onBackspace={backspace} onSpace={space} onEnter={submit} onShift={() => setShiftOn((v) => !v)} shift={capNext || shiftOn} />
        </div>
      ) : (
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
                  <small>듣지 못했어요</small>
                </>
              ) : (
                <Icon name="mic" size={40} />
              )}
            </button>
          </div>
          <div className="voice-bar">
            <button className="tool-btn" onClick={hint} disabled={live.showedAnswer}>
              <span className="kbd-hint">1</span>
              {live.hints === 0 ? <Icon name="question" size={26} className="ic-purple" /> : <Icon name="check" size={26} className="ic-green" />}
              <span>{live.hints === 0 ? '힌트 보기' : '정답 보기'}</span>
            </button>
            <button className="tool-btn" onClick={() => setInputMode('keyboard')}>
              <span className="kbd-hint">0</span>
              <Icon name="keyboard" size={26} className="ic-purple" />
              <span>키보드 모드</span>
            </button>
          </div>
        </div>
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

      {goalReached && (
        <GoalReached
          total={todayTotal}
          onMore={() => setGoalReached(false)}
          onHome={() => nav('/')}
        />
      )}
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
