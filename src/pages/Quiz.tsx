import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel from '../components/AfterPanel';
import Icon from '../components/Icon';
import Keyboard from '../components/Keyboard';
import Mascot from '../components/Mascot';
import VocabSettings from '../components/VocabSettings';
import QuizCard, { FilledSentence, KoSentence, type CardBadge } from '../components/QuizCard';
import WrongItem from '../components/WrongItem';
import { useLeaveGuard } from '../components/StudyChrome';
import { db } from '../db';
import { comprehension, computeStreak, estimateVocab, grantRepairPen } from '../lib/stats';
import { syncContent } from '../lib/content';
import { maybeAdjustLevel } from '../lib/level';
import { LEVEL_TEST_QUESTIONS } from '../lib/levelLogic';
import { applyReview, newCardRow, type Outcome } from '../lib/scheduler';
import { LevelTest, ListPicker, StudyPicker, type Question } from '../lib/session';
import { saveSettings, useSettings } from '../lib/settings';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { SHOW_ANSWER_MSG, containsAnswer, evaluate, feedbackFor, fullSentence, hintPrefix, normalize, speechMatchRate } from '../lib/text';
import { formatAfter, formatAgo, formatDuration, studyDateOf } from '../lib/time';
import { POS_KO, type Settings, type Tone, type WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty' | 'nowords' | 'testResult';
type Overlay = 'examples' | 'wrongs' | 'info' | null;

interface Live {
  q: Question;
  input: string;
  hints: number;
  showedAnswer: boolean;
  wrongAttempts: number;
  wrongs: WrongNote[];
  feedback: { tone: Tone; msg: string } | null;
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
  const [heard, setHeard] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [goalReached, setGoalReached] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [levelHelp, setLevelHelp] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  const favorites = useLiveQuery(() => db.favorites.toCollection().primaryKeys(), []) as string[] | undefined;
  const guard = useLeaveGuard(() => nav('/'));

  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings ?? null;
  const pickerRef = useRef<StudyPicker | ListPicker | null>(null);
  const testRef = useRef<LevelTest | null>(null);
  const started = useRef(false);
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
      setTodayTotal((await db.daily.get(studyDateOf()))?.total ?? 0);
      if (mode === 'test') {
        const t = new LevelTest();
        await t.init();
        testRef.current = t;
      } else {
        const p = listIds ? new ListPicker(listIds) : new StudyPicker(settings.level ?? 10, settings.newWordDifficulty);
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
        const before = d.total;
        d.total += 1;
        if (l.q.isNew) d.newWords += 1;
        else d.reviews += 1;
        if (known) d.knownNew = (d.knownNew ?? 0) + 1;
        if (clean) d.correct += 1;
        d.timeMs += Math.min(outcome.elapsedMs, 5 * 60_000);
        d.goal = s.dailyGoal;
        await db.daily.put(d);
        return { total: d.total, metNow: before < s.dailyGoal && d.total >= s.dailyGoal };
      });
      void computeStreak().then(grantRepairPen).catch(() => undefined);

      pickerRef.current?.noteAnswered(l.q.word.id);
      if (testRef.current) {
        testRef.current.record(clean);
        setTestAsked(testRef.current.asked);
      }
      setTodayTotal(total);
      setLive({ ...l, feedback: null });
      setAnswered({ q: l.q, outcome, known, due: row.due, wrongs: l.wrongs });
      setFlash({ kind: 'correct', key: Date.now() });
      setPhase('answered');
      if (s.autoSpeak) speakSentence(l.q);
      if (metNow && mode === 'study') window.setTimeout(() => setGoalReached(true), 1100);
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
    setLive((l) => {
      if (!l) return l;
      const max = sentenceOf(l.q).answer.length + 12;
      const next = fn(l.input).slice(0, max);
      return { ...l, input: next, feedback: next === l.input ? l.feedback : null };
    });
  };

  const typeChar = (c: string) => editInput((cur) => cur + c);
  const space = () => editInput((cur) => (cur && !cur.endsWith(' ') ? cur + ' ' : cur));
  const backspace = () => editInput((cur) => cur.slice(0, -1));

  const markWrong = (l: Live, w: string, tone: Tone, msg: string, penalize: boolean) => {
    setLive({
      ...l,
      feedback: { tone, msg },
      wrongAttempts: l.wrongAttempts + (penalize ? 1 : 0),
      wrongs: [...l.wrongs, { w, tone, m: msg }],
    });
    setFlash({ kind: 'wrong', key: Date.now() });
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
    markWrong(live, live.input.trim(), fb.tone, fb.msg, !fb.bonus);
  };

  const hint = () => {
    if (!live || phase !== 'question' || live.showedAnswer) return;
    const answer = sentenceOf(live.q).answer;
    if (live.hints === 0) {
      setLive({ ...live, hints: 1, input: hintPrefix(answer), feedback: null });
    } else {
      setLive({ ...live, showedAnswer: true, input: '', feedback: { tone: 'red', msg: SHOW_ANSWER_MSG } });
    }
  };

  const answerByVoice = async () => {
    if (!live || listening) return;
    setVoiceError(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const s = sentenceOf(live.q);
      setHeard(alts[0] ?? null);
      if (containsAnswer(alts, s.answer, live.q.word.word)) {
        await finalize(live, 'voice');
      } else {
        const heard = alts[0] ?? '';
        markWrong(live, heard || '(인식 안 됨)', 'red', `'${heard}'(이)라고 들렸어요. 다시 말해 보세요.`, true);
      }
    } catch (e) {
      setVoiceError(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  const sayIt = async () => {
    if (!answered || listening) return;
    setOverlay(null);
    setSayResult(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const s = sentenceOf(answered.q);
      const target = fullSentence(s.en, s.answer);
      let best = 0;
      let bestText = alts[0] ?? '';
      for (const a of alts) {
        const r = speechMatchRate(a, target);
        if (r > best) {
          best = r;
          bestText = a;
        }
      }
      const pct = Math.round(best * 100);
      const label = best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!';
      setSayResult({ tone: best >= 0.8 ? 'green' : best >= 0.6 ? 'yellow' : 'red', msg: `${label} ${pct}% 일치 · '${bestText}'` });
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

  const toggleFavorite = async () => {
    if (!answered) return;
    const key = `${answered.q.word.id}#${answered.q.sentenceIdx}`;
    if (favorites?.includes(key)) await db.favorites.delete(key);
    else await db.favorites.put({ key, wordId: answered.q.word.id, sentenceIdx: answered.q.sentenceIdx, ts: Date.now() });
  };

  // 실제 키보드(블루투스/PC)도 지원
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || showSettings || goalReached) return;
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
        typeChar(e.key);
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
  const q = live.q;
  const sentence = sentenceOf(q);
  const goal = settings.dailyGoal;
  const total = mode === 'test' ? LEVEL_TEST_QUESTIONS : Math.max(goal, extraTarget);
  const count = mode === 'test' ? testAsked : todayTotal;
  const fill = Math.min(1, count / total);
  const isAnswered = phase === 'answered' && answered;
  const favKey = `${q.word.id}#${q.sentenceIdx}`;

  let badge: CardBadge = { kind: 'new' };
  if (isAnswered) badge = { kind: 'due', text: `${formatAfter(answered.due)} 복습` };
  else if (!q.isNew && q.card?.last_review) badge = { kind: 'ago', text: formatAgo(q.card.last_review) };

  const feedback = isAnswered ? sayResult : live.feedback;

  let cardOverlay = null;
  if (isAnswered && overlay) {
    const w = answered.q.word;
    cardOverlay = (
      <div className="card-overlay">
        <button className="overlay-close" onClick={() => setOverlay(null)} aria-label="닫기">
          <Icon name="close" size={18} />
        </button>
        {overlay === 'examples' && (
          <>
            <p className="overlay-title">
              <Icon name="chat" size={16} /> 준영보카 예문
            </p>
            {w.sentences.map((s, i) => (
              <div key={i} className={`ex-item ${i === answered.q.sentenceIdx ? 'current' : ''}`}>
                {s.ctx && <p className="ctx">{s.ctx}</p>}
                <p className="ex-en">
                  <FilledSentence sentence={s} />
                </p>
                <p className="ex-ko">
                  <KoSentence ko={s.ko} />
                </p>
                <button className="ex-play" onClick={() => speak(fullSentence(s.en, s.answer), settings.speechRate === 'slow')} aria-label="듣기">
                  <Icon name="speaker" size={18} />
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
            {answered.wrongs.length === 0 && <p className="overlay-empty">이번 문제는 틀린 답 없이 맞혔어요!</p>}
            {answered.wrongs.map((x, i) => (
              <WrongItem key={i} w={x.w} tone={x.tone} m={x.m} />
            ))}
            {(sentence.alts ?? []).filter((a) => !answered.wrongs.some((x) => normalize(x.w) === normalize(a.w))).length > 0 && (
              <>
                <p className="overlay-sub">이런 답도 헷갈리기 쉬워요</p>
                {(sentence.alts ?? [])
                  .filter((a) => !answered.wrongs.some((x) => normalize(x.w) === normalize(a.w)))
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
    <div className="quiz-screen">
      <div className="quiz-bg-deco" />
      <header className="quiz-top">
        {guard.modal}
        <button className="icon-btn light" onClick={mode === 'test' ? () => nav('/') : guard.leave} aria-label="나가기">
          <Icon name="back" size={24} />
        </button>
        <div className="quiz-progress">
          <span className={`trophy-badge ${count >= total ? 'gold' : ''}`}>
            <Icon name="trophy" size={18} />
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
        <div className="card-slide" key={cardKey}>
          <QuizCard
            word={q.word}
            sentence={sentence}
            state={isAnswered ? 'answered' : 'question'}
            input={live.input}
            showedAnswer={live.showedAnswer}
            showCaret={inputMode === 'keyboard' && phase === 'question'}
            blankMatchesLength={settings.blankMatchesLength}
            flash={flash}
            feedback={feedback}
            badge={badge}
            favorite={favorites?.includes(favKey) ?? false}
            onToggleFavorite={() => void toggleFavorite()}
            onLevelHelp={() => setLevelHelp((v) => !v)}
            levelHelp={levelHelp}
            overlay={cardOverlay}
          />
        </div>
      </main>

      {isAnswered ? (
        <AfterPanel
          answer={sentence.answer}
          wrongCount={answered.wrongs.length}
          slow={settings.speechRate === 'slow'}
          listening={listening}
          onExamples={() => setOverlay((o) => (o === 'examples' ? null : 'examples'))}
          onWrongs={() => setOverlay((o) => (o === 'wrongs' ? null : 'wrongs'))}
          onSay={() => void sayIt()}
          onInfo={() => setOverlay((o) => (o === 'info' ? null : 'info'))}
          onToggleSpeed={() => {
            const slow = settings.speechRate !== 'slow';
            void saveSettings({ speechRate: slow ? 'slow' : 'real' });
            speakSentence(q, slow);
          }}
          onReplay={() => speakSentence(q)}
          onNext={() => void next()}
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
              {live.input && <span className="bubble">{live.input}</span>}
            </div>
            <button className="tool-btn" onClick={() => setInputMode('voice')} disabled={!canRecognize()}>
              <Icon name="mic" size={26} className="ic-purple" />
              <span>음성 모드</span>
            </button>
          </div>
          <Keyboard onChar={typeChar} onBackspace={backspace} onSpace={space} onEnter={submit} onSettings={() => setShowSettings(true)} />
        </div>
      ) : (
        <div className="voice-zone">
          <div className="voice-bubble-row">
            {voiceError ? (
              <span className="voice-error">{voiceError}</span>
            ) : heard || live.input ? (
              <span className="bubble link">{heard ?? live.input}</span>
            ) : (
              <span className="voice-hint">{listening ? '듣고 있어요…' : '마이크를 누르고 빈칸에 들어갈 말을 말해 보세요'}</span>
            )}
          </div>
          <div className={`voice-halo ${listening ? 'listening' : ''}`}>
            <button className="mic-big" onClick={() => void answerByVoice()} aria-label={listening ? '듣는 중' : '말하기'}>
              {listening ? <span className="stop-square" /> : <Icon name="mic" size={40} />}
            </button>
          </div>
          <div className="voice-bar">
            <button className="tool-btn" onClick={hint} disabled={live.showedAnswer}>
              {live.hints === 0 ? <Icon name="question" size={26} className="ic-purple" /> : <Icon name="check" size={26} className="ic-green" />}
              <span>{live.hints === 0 ? '힌트 보기' : '정답 보기'}</span>
            </button>
            <button className="tool-btn" onClick={() => setInputMode('keyboard')}>
              <Icon name="keyboard" size={26} className="ic-purple" />
              <span>키보드 모드</span>
            </button>
          </div>
        </div>
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
