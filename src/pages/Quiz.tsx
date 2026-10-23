import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Feedback, { type Answered } from '../components/Feedback';
import QuizCard from '../components/QuizCard';
import { db } from '../db';
import { syncContent } from '../lib/content';
import { maybeAdjustLevel } from '../lib/level';
import { LEVEL_TEST_QUESTIONS } from '../lib/levelLogic';
import { applyReview, newCardRow, type Outcome } from '../lib/scheduler';
import { LevelTest, StudyPicker, type Question } from '../lib/session';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { containsAnswer, judge } from '../lib/text';
import { studyDateOf } from '../lib/time';
import type { Settings } from '../types';

type Phase = 'loading' | 'question' | 'feedback' | 'result' | 'empty' | 'nowords';

interface Live {
  q: Question;
  startedAt: number;
  hints: number;
  wrongAttempts: number;
  showedAnswer: boolean;
  message: string | null;
  shake: number;
}

interface RoundStats {
  asked: number;
  correct: number;
  newWords: number;
  reviews: number;
}

const emptyRound = (): RoundStats => ({ asked: 0, correct: 0, newWords: 0, reviews: 0 });
const freshLive = (q: Question): Live => ({ q, startedAt: Date.now(), hints: 0, wrongAttempts: 0, showedAnswer: false, message: null, shake: 0 });

export default function Quiz({ mode }: { mode: 'study' | 'test' }) {
  const settings = useSettings();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [live, setLive] = useState<Live | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [round, setRound] = useState<RoundStats>(emptyRound());
  const [inputMode, setInputMode] = useState<'keyboard' | 'voice'>('keyboard');
  const [testLevel, setTestLevel] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [goalJustMet, setGoalJustMet] = useState(false);

  const settingsRef = useRef<Settings | null>(null);
  settingsRef.current = settings ?? null;
  const roundRef = useRef<RoundStats>(emptyRound());
  const pickerRef = useRef<StudyPicker | null>(null);
  const testRef = useRef<LevelTest | null>(null);
  const started = useRef(false);

  const finishTest = useCallback(async (t: LevelTest) => {
    const lvl = t.finalLevel();
    await saveSettings({ level: lvl });
    setTestLevel(lvl);
    setPhase('result');
  }, []);

  const nextQuestion = useCallback(async () => {
    if (mode === 'test') {
      const t = testRef.current;
      if (!t) return;
      if (t.done) return finishTest(t);
      const q = await t.pick();
      if (!q) return finishTest(t);
      setLive(freshLive(q));
      setPhase('question');
      return;
    }
    const picker = pickerRef.current;
    if (!picker) return;
    const q = await picker.next();
    if (!q) {
      setPhase('empty');
      return;
    }
    setLive(freshLive(q));
    setPhase('question');
  }, [mode, finishTest]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    setInputMode(settings.inputMode);
    (async () => {
      const n = await db.words.count();
      if (n === 0) {
        setPhase('nowords');
        return;
      }
      if (mode === 'test') {
        const t = new LevelTest();
        await t.init();
        testRef.current = t;
      } else {
        const p = new StudyPicker(settings.level ?? 10, settings.newWordDifficulty);
        await p.init();
        pickerRef.current = p;
      }
      await nextQuestion();
    })().catch(console.error);
  }, [settings, mode, nextQuestion]);

  const finalize = useCallback(
    async (l: Live, m: 'keyboard' | 'voice') => {
      const s = settingsRef.current;
      if (!s) return;
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
      const correct = outcome.firstTry && outcome.hints === 0;
      const date = studyDateOf(now);

      const metNow = await db.transaction('rw', db.cards, db.reviews, db.daily, async () => {
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
        });
        const d = (await db.daily.get(date)) ?? { date, total: 0, newWords: 0, reviews: 0, correct: 0, timeMs: 0 };
        const before = d.total;
        d.total += 1;
        if (l.q.isNew) d.newWords += 1;
        else d.reviews += 1;
        if (correct) d.correct += 1;
        d.timeMs += outcome.elapsedMs;
        await db.daily.put(d);
        return before < s.dailyGoal && d.total >= s.dailyGoal;
      });

      pickerRef.current?.noteAnswered(l.q.word.id);
      testRef.current?.record(correct);
      const r = roundRef.current;
      r.asked += 1;
      if (correct) r.correct += 1;
      if (l.q.isNew) r.newWords += 1;
      else r.reviews += 1;
      setRound({ ...r });
      if (metNow) setGoalJustMet(true);
      if (s.autoSpeak) speak(l.q.word.word);
      setAnswered({ question: l.q, outcome, grade, known, due: row.due, correct });
      setPhase('feedback');
    },
    [mode],
  );

  const onNext = useCallback(async () => {
    setAnswered(null);
    const s = settingsRef.current;
    if (!s) return;
    if (mode === 'study' && roundRef.current.asked >= s.questionsPerRound) {
      const { message, level } = await maybeAdjustLevel();
      setNotice(message);
      pickerRef.current?.setLevel(level);
      setPhase('result');
      return;
    }
    await nextQuestion();
  }, [mode, nextQuestion]);

  useEffect(() => {
    if (phase !== 'feedback') return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void onNext();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, onNext]);

  const continueRound = () => {
    roundRef.current = emptyRound();
    setRound(emptyRound());
    setNotice(null);
    setGoalJustMet(false);
    void nextQuestion();
  };

  const onSubmit = (input: string) => {
    if (!live) return;
    const sent = live.q.word.sentences[live.q.sentenceIdx];
    const j = judge(input, sent.answer, live.q.word.word);
    if (j.verdict === 'correct') {
      void finalize(live, 'keyboard');
      return;
    }
    const message =
      j.verdict === 'close'
        ? j.baseForm
          ? '뜻은 맞아요! 문장에 맞는 형태로 바꿔 보세요'
          : `거의 맞았어요. ${j.distance}글자가 달라요`
        : '틀렸어요. 다시 시도해 보세요';
    setLive({ ...live, wrongAttempts: live.wrongAttempts + 1, message, shake: live.shake + 1 });
  };

  const onVoice = (alts: string[]) => {
    if (!live) return;
    const sent = live.q.word.sentences[live.q.sentenceIdx];
    if (containsAnswer(alts, sent.answer, live.q.word.word)) {
      void finalize(live, 'voice');
      return;
    }
    setLive({
      ...live,
      wrongAttempts: live.wrongAttempts + 1,
      message: `'${alts[0] ?? ''}' 라고 들렸어요. 다시 말해 보세요`,
      shake: live.shake + 1,
    });
  };

  const onHint = () => setLive((l) => (l && l.hints < 2 ? { ...l, hints: l.hints + 1, message: null } : l));
  const onShowAnswer = () =>
    setLive((l) => {
      if (!l) return l;
      const a = l.q.word.sentences[l.q.sentenceIdx].answer;
      return { ...l, showedAnswer: true, message: `정답은 '${a}' 입니다. 직접 입력해서 넘어가세요.` };
    });

  if (!settings || phase === 'loading') {
    return (
      <div className="screen center">
        <p className="muted">준비 중…</p>
      </div>
    );
  }
  if (phase === 'nowords') {
    return (
      <div className="screen center col gap">
        <p>단어 데이터가 아직 없어요.</p>
        <p className="muted small">인터넷에 연결된 상태에서 다시 받아 주세요.</p>
        <button
          className="btn primary"
          onClick={() => {
            syncContent()
              .then(() => window.location.reload())
              .catch(() => alert('받기에 실패했어요. 연결을 확인해 주세요.'));
          }}
        >
          단어 데이터 받기
        </button>
        <button className="btn ghost" onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    );
  }
  if (phase === 'empty') {
    return (
      <div className="screen center col gap">
        <h2>오늘 할 복습이 없어요</h2>
        <p className="muted">현재 레벨 범위에 새 단어도 남아 있지 않아요. 설정에서 레벨을 바꾸거나, 새 단어 팩이 추가되면 다시 학습할 수 있어요.</p>
        <button className="btn primary" onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    );
  }
  if (phase === 'result') {
    if (mode === 'test') {
      return (
        <div className="screen center col gap">
          <p className="muted">레벨 테스트 완료</p>
          <div className="level-big">Lv.{testLevel}</div>
          <p className="muted">이 레벨 주변의 새 단어부터 학습을 시작합니다. 설정에서 언제든 바꿀 수 있어요.</p>
          <button className="btn primary big" onClick={() => nav('/', { replace: true })}>
            학습 시작하기
          </button>
        </div>
      );
    }
    const acc = round.asked ? Math.round((round.correct / round.asked) * 100) : 0;
    return (
      <div className="screen center col gap">
        <h2>라운드 완료</h2>
        {goalJustMet && <div className="trophy big">🏆 오늘 목표 달성!</div>}
        <div className="stats-row">
          <Stat label="정답률" value={`${acc}%`} />
          <Stat label="새 단어" value={`${round.newWords}`} />
          <Stat label="복습" value={`${round.reviews}`} />
        </div>
        {notice && <div className="notice">{notice}</div>}
        <button className="btn primary big" onClick={continueRound}>
          계속하기
        </button>
        <button className="btn ghost" onClick={() => nav('/')}>
          홈으로
        </button>
      </div>
    );
  }

  if (!live) return null;
  const q = live.q;
  const total = mode === 'test' ? LEVEL_TEST_QUESTIONS : settings.questionsPerRound;
  const index = Math.min(round.asked + 1, total);

  return (
    <div className="screen quiz">
      <header className="quiz-head">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="나가기">
          ✕
        </button>
        <div className="quiz-progress">
          <div className="bar">
            <div className="fill" style={{ width: `${(round.asked / total) * 100}%` }} />
          </div>
          <span className="small muted">
            {mode === 'test' ? '레벨 테스트 ' : ''}
            {index} / {total}
          </span>
        </div>
        <span className="badge">Lv.{q.word.level}</span>
      </header>
      {phase === 'question' && (
        <QuizCard
          key={`${q.word.id}:${round.asked}`}
          question={q}
          hints={live.hints}
          showedAnswer={live.showedAnswer}
          message={live.message}
          shake={live.shake}
          settings={settings}
          inputMode={inputMode}
          onSubmit={onSubmit}
          onVoice={onVoice}
          onHint={onHint}
          onShowAnswer={onShowAnswer}
          onToggleMode={() => setInputMode((m) => (m === 'keyboard' ? 'voice' : 'keyboard'))}
        />
      )}
      {phase === 'feedback' && answered && <Feedback answered={answered} onNext={() => void onNext()} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label muted small">{label}</span>
    </div>
  );
}
