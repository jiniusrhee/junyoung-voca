import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Backdrop, StudyTop, ToolPanel } from '../components/StudyChrome';
import { db } from '../db';
import { ListenPicker, MAX_LISTENS, RESULT_TEXT, listenWords, nextListenLevel, resultFor, type ListenQuestion, type ListenResult } from '../lib/listening';
import { cardId, modeToday, recordModeAnswer, toggleBookmark } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { normalize, speechMatchRate } from '../lib/text';

type Phase = 'loading' | 'question' | 'answered' | 'empty';

interface Slot {
  word: number | null;
  bad: boolean;
}

const shuffle = <T,>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export default function ListeningQuiz() {
  const settings = useSettings();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<ListenQuestion | null>(null);
  const [done, setDone] = useState(0); // 맞힌 단어 수
  const [white, setWhite] = useState<Set<number>>(new Set());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [nextWord, setNextWord] = useState(0);
  const [listens, setListens] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [result, setResult] = useState<ListenResult | null>(null);
  const [count, setCount] = useState(0);
  const [level, setLevel] = useState(10);
  const [careful, setCareful] = useState(false);
  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [cardKey, setCardKey] = useState(0);
  /** 객관식: 첫 탭 전까지 U/I/J/K 키 배지 (말해보카) */
  const [touched, setTouched] = useState(false);
  const pickerRef = useRef<ListenPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);
  const words = q ? listenWords(q.item.en) : [];
  const bookmarked = useLiveQuery(async () => (q ? !!(await db.bookmarks.get(cardId('listening', q.item.id))) : false), [q?.item.id]);
  const slow = settings?.listeningSpeed === 'slow';
  const mc = settings?.listeningMode !== 'subjective';
  const goal = settings?.listeningGoal ?? 10;

  const play = useCallback(
    (factor = 1) => {
      if (!q) return;
      speak(q.item.en, slow, factor);
    },
    [q, slow],
  );

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return;
    }
    const ws = listenWords(next.item.en);
    setQ(next);
    setDone(0);
    setWhite(new Set());
    const first = Math.min(4, ws.length);
    setSlots(shuffle(Array.from({ length: first }, (_, i) => i)).map((w) => ({ word: w, bad: false })));
    setNextWord(first);
    setTouched(false);
    setListens(1);
    setWrong(0);
    setResult(null);
    setInput('');
    setVoiceMsg(null);
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    setPhase('question');
    window.setTimeout(() => speak(next.item.en, settings?.listeningSpeed === 'slow'), 350);
  }, [settings?.listeningSpeed]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    setInputMode(settings.listeningInput);
    (async () => {
      setCount((await modeToday('listening')).total);
      const lv = settings.listeningLevel ?? Math.min(50, Math.round((settings.level ?? 10) * 1.4));
      setLevel(lv);
      const p = new ListenPicker(lv);
      await p.init();
      pickerRef.current = p;
      await load();
    })().catch(console.error);
  }, [settings, load]);

  const finish = async (failed: boolean, listensUsed: number) => {
    if (!q || !settings) return;
    const r = resultFor(listensUsed, failed);
    const res = await recordModeAnswer(
      'listening',
      q.item.id,
      { clean: r === 'perfect', wrong: r === 'perfect' ? 0 : 1, failed: r === 'nice', elapsedMs: Date.now() - startedAt.current },
      goal,
    );
    const nl = nextListenLevel(level, r);
    setLevel(nl);
    if (pickerRef.current) pickerRef.current.level = nl;
    void saveSettings({ listeningLevel: nl });
    void db.kv.get('listeningBest').then((r) => {
      const best = (r?.value as number | undefined) ?? 0;
      if (nl > best) return db.kv.put({ key: 'listeningBest', value: nl });
    });
    pickerRef.current?.note(q.item.id);
    setCount(res.total);
    setResult(r);
    setDone(words.length);
    setPhase('answered');
  };

  useEffect(() => {
    if (!mc || phase !== 'question') return;
    const onKey = (e: KeyboardEvent) => {
      const i = 'uijk'.indexOf(e.key.toLowerCase());
      if (i >= 0) tapSlot(i);
      else if (e.key === '1') replay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const replay = () => {
    if (phase === 'answered') {
      play();
      return;
    }
    if (listens >= MAX_LISTENS) return;
    setListens((n) => n + 1);
    play();
  };

  const tapSlot = (i: number) => {
    const s = slots[i];
    if (phase !== 'question' || s.word === null) return;
    setTouched(true);
    const target = words[done]?.key;
    if (words[s.word].key === target) {
      const nextSlots = [...slots];
      const fill = nextWord < words.length ? nextWord : null;
      nextSlots[i] = { word: fill, bad: false };
      // 같은 단어가 다른 칸에 있으면 그대로 둔다
      setSlots(nextSlots.map((x) => ({ ...x, bad: false })));
      if (fill !== null) setNextWord(nextWord + 1);
      const d = done + 1;
      setDone(d);
      if (d >= words.length) void finish(false, listens);
      return;
    }
    // 오답: 다시 듣기
    setWrong((n) => n + 1);
    setWhite((w) => new Set(w).add(done));
    setSlots(slots.map((x, k) => (k === i ? { ...x, bad: true } : x)));
    if (listens >= MAX_LISTENS) {
      void finish(true, listens);
      return;
    }
    setListens((n) => n + 1);
    setCareful(true);
    play();
    window.setTimeout(() => setCareful(false), 1800);
  };

  const checkTyped = (text: string) => {
    if (!q) return;
    const said = text.split(/\s+/).map((w) => normalize(w)).filter(Boolean);
    let k = 0;
    while (k < words.length && said[k] === words[k].key) k++;
    if (k >= words.length) {
      void finish(false, listens);
      return;
    }
    setDone(k);
    setWrong((n) => n + 1);
    // 말해보카: '!' + 카드가 잠깐 붉어지고 입력은 그대로 (다시 듣기 횟수는 안 줄어듦)
    setWrongFlash(true);
    window.setTimeout(() => setWrongFlash(false), 500);
    if (listens >= MAX_LISTENS && wrong + 1 >= 3) void finish(true, listens);
  };

  const voiceAnswer = async () => {
    if (!q || listening) return;
    setVoiceMsg(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = alts.reduce((b, a) => (speechMatchRate(a, q.item.en) > speechMatchRate(b, q.item.en) ? a : b), alts[0] ?? '');
      if (speechMatchRate(best, q.item.en) >= 0.9) void finish(false, listens);
      else {
        setVoiceMsg(`'${best}'(이)라고 들렸어요.`);
        checkTyped(best);
      }
    } catch (e) {
      setVoiceMsg(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  const sayIt = async () => {
    if (!q || listening) return;
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = Math.max(...alts.map((a) => speechMatchRate(a, q.item.en)));
      setVoiceMsg(`${best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!'} ${Math.round(best * 100)}% 일치`);
    } catch (e) {
      setVoiceMsg(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  // 실제 키보드 입력 (주관식 키보드 모드)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (phase === 'answered' && e.key === 'Enter') {
        e.preventDefault();
        void load();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!settings || phase === 'loading') return <div className="quiz-screen center" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">지금 풀 리스닝 문제가 없어요</p>
        <button className="btn primary" onClick={() => nav('/all?mode=listening')}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q) return null;
  const answered = phase === 'answered';
  const dots = Array.from({ length: MAX_LISTENS }, (_, i) => (i < MAX_LISTENS - listens ? 'on' : 'off'));
  const dotTone = listens <= 1 ? 'green' : listens === 2 ? 'yellow' : 'gray';

  return (
    <div className="quiz-screen listen-quiz">
      <Backdrop theme={settings.studyTheme} />
      <StudyTop count={count} total={goal} onBack={() => nav(-1)} onSettings={() => nav('/settings/vocab')} />
      <main className="quiz-stage">
        <div className="card-slide" key={cardKey}>
          <div className="qcard-wrap">
            <div className="qcard-head">
              <span className="qcard-tab">레벨 {q.item.level}</span>
              {answered && result && (
                <p className={`listen-result ${result}`}>
                  <b>{RESULT_TEXT[result].title}</b> {RESULT_TEXT[result].sub}
                </p>
              )}
            </div>
            <div className={`qcard l-card ${wrongFlash ? 'is-wrong' : ''}`}>
              {wrongFlash && <span className="mark-bang">!</span>}
              <div className="qcard-top">
                {answered ? (
                  <p className="ko">{q.item.ko}</p>
                ) : (
                  <div className="l-progress">
                    <span style={{ width: mc ? `${(done / words.length) * 100}%` : '0%' }} />
                  </div>
                )}
              </div>
              {voiceMsg && (
                <div className="pill yellow">
                  <Icon name="mic" size={18} className="pill-icon" />
                  <span>{voiceMsg}</span>
                </div>
              )}
              <div className="qcard-bottom">
                <p className={`l-line ${answered ? 'done' : ''}`}>
                  {words.map((w, i) =>
                    i < done ? (
                      <span key={i} className={white.has(i) || (answered && result === 'nice') ? 'w-white' : 'w-green'}>
                        {w.show}{' '}
                      </span>
                    ) : (
                      <span key={i} className="w-blank" style={{ width: `${Math.max(2, w.show.length) * 0.58}em` }} />
                    ),
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {answered ? (
        <ToolPanel
          tools={[
            { icon: 'play', label: 'x0.8 듣기', onClick: () => play(0.8) },
            {
              icon: 'turtle',
              label: slow ? '실전 속도' : '듣기평가 속도',
              onClick: () => void saveSettings({ listeningSpeed: slow ? 'real' : 'slow' }),
            },
            { icon: 'mic', label: listening ? '듣는 중…' : '말해보기', onClick: () => void sayIt(), active: listening },
            { icon: 'star', label: bookmarked ? '북마크됨' : '북마크', onClick: () => void toggleBookmark('listening', q.item.id), active: !!bookmarked },
          ]}
          big={[
            { icon: 'turtle', label: 'x0.5 듣기', onClick: () => play(0.5) },
            { icon: 'speaker', label: '다시 듣기', onClick: () => play() },
            { icon: 'play', label: '다음 문제', onClick: () => void load(), primary: true },
          ]}
        />
      ) : mc ? (
        <div className="l-mc">
          <div className="l-slots">
            {slots.map((s, i) => (
              <button key={i} className={`l-slot ${s.word === null ? 'empty' : ''} ${s.bad ? 'bad' : ''}`} onClick={() => tapSlot(i)} disabled={s.word === null}>
                {!touched && s.word !== null && <span className="kbd-hint slot-key">{'UIJK'[i]}</span>}
                {s.word !== null ? words[s.word].show.replace(/[.,!?;:"]/g, '') : ''}
              </button>
            ))}
          </div>
          <button className="l-replay" onClick={replay} disabled={listens >= MAX_LISTENS}>
            <span className="kbd-hint replay-key">1</span>
            {careful ? (
              <span>Listen Carefully</span>
            ) : (
              <>
                <Icon name="speaker" size={22} />
                <span>다시 듣기</span>
                <span className={`l-dots ${dotTone}`}>
                  {dots.map((d, i) => (
                    <i key={i} className={d} />
                  ))}
                </span>
              </>
            )}
          </button>
        </div>
      ) : inputMode === 'voice' ? (
        <div className="voice-zone">
          <div className="voice-bubble-row">{listening && <span className="voice-hint">듣고 있어요…</span>}</div>
          <div className={`voice-halo ${listening ? 'listening' : ''}`}>
            <span className="kbd-hint enter">Enter</span>
            <button className={`mic-big ${listening ? 'on' : ''}`} onClick={() => void voiceAnswer()} disabled={!canRecognize()} aria-label="말하기">
              {listening ? (
                <>
                  <span className="stop-square" />
                  <small>듣고 있어요</small>
                </>
              ) : (
                <Icon name="mic" size={40} />
              )}
            </button>
            {!listening && <span className="voice-under">누르고 말해 보세요</span>}
          </div>
          <div className="voice-bar">
            <button className="tool-btn" onClick={replay} disabled={listens >= MAX_LISTENS}>
              <span className="kbd-hint">1</span>
              <Icon name="speaker" size={26} className="ic-purple" />
              <span>다시 듣기</span>
              <span className={`l-dots small ${dotTone}`}>
                {dots.map((d, i) => (
                  <i key={i} className={d} />
                ))}
              </span>
            </button>
            <button className="tool-btn" onClick={() => setInputMode('keyboard')}>
              <span className="kbd-hint">0</span>
              <Icon name="keyboard" size={26} className="ic-purple" />
              <span>키보드 모드</span>
            </button>
          </div>
        </div>
      ) : (
        <form
          className="l-typing"
          onSubmit={(e) => {
            e.preventDefault();
            checkTyped(input);
          }}
        >
          <div className="toolbar">
            <button type="button" className="tool-btn" onClick={replay} disabled={listens >= MAX_LISTENS}>
              <Icon name="speaker" size={26} className="ic-purple" />
              <span>다시 듣기</span>
            </button>
            <div className="toolbar-center">
              <input
                className="l-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="done"
                aria-label="들은 문장 입력"
              />
            </div>
            <button type="button" className="tool-btn" onClick={() => setInputMode('voice')} disabled={!canRecognize()}>
              <Icon name="mic" size={26} className="ic-purple" />
              <span>음성 모드</span>
            </button>
          </div>
          <button type="submit" className="l-submit">
            <Icon name="check" size={18} /> 확인
          </button>
        </form>
      )}
    </div>
  );
}
