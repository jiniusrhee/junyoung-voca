import { useLiveQuery } from 'dexie-react-hooks';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel, { BigBook, type MoreAction, type PanelTool } from '../components/AfterPanel';
import Icon from '../components/Icon';
import InfoCard from '../components/InfoCard';
import Keyboard from '../components/Keyboard';
import KoText from '../components/KoText';
import Mascot from '../components/Mascot';
import Pterodactyls from '../components/Pterodactyls';
import { KoSentence } from '../components/QuizCard';
import { QBookOutline, QHint, QKeyboard, QMic, QReveal, QSpeak } from '../components/QuizIcons';
import { QuizScene, QuizTop } from '../components/QuizShell';
import { db } from '../db';
import { ExprPicker, bare, evalExpr, exprPrefix, shownWord, type ExprQuestion } from '../lib/expr';
import { cardId, dueBadge, modeSolved, modeToday, recordModeAnswer, toggleBookmark } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { sfx } from '../lib/sfx';
import { canRecognize, recognizeOnce, speak, stopSpeaking, voiceErrorMessage } from '../lib/speech';
import { useNavBarColor, useStatusBarColor } from '../lib/statusBar';
import { speechMatchRate } from '../lib/text';
import { formatAgo } from '../lib/time';
import type { ExprItem, ExprPattern, Tone, WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty';
type Overlay = 'examples' | 'wrongs' | null;
type Flash = { kind: 'wrong' | 'correct'; key: number } | null;

const fillBlank = (en: string, answer: string) => en.replace('___', answer);

/** 화면에 그릴 카드 한 장 (지금 문제, 또는 '다음 문제'로 빠져나가는 중인 지난 문제) */
interface CardView {
  item: ExprItem;
  pattern: ExprPattern | undefined;
  input: string;
  /** 0: 길이 보기 전(빈칸이 한 덩어리) · 1: 낱말 수만큼의 칸 · 2: 힌트(첫 낱말 앞부분) · 3: 정답 보기(주황으로 비침) */
  step: number;
  answered: boolean;
  badge: { cls: string; text: string } | null;
  flash: Flash;
  pill: { tone: Tone; msg: string } | null;
  showKo: boolean;
  caret: boolean;
}

/**
 * 표현 학습 — 말해보카 플립 실측(2026-11-14)으로 어휘 퀴즈의 틀에 옮김 (머리줄 · 풍경 · 카드 · 자판 · 정답 패널).
 *
 * 카드: 꼬리표 자리에 카드 폭 전체의 띠(말풍선 그림 + 패턴의 뜻), 위 칸에 상대의 말(캐릭터 + 말풍선, 작은 단추로 영어 ↔ 한국어),
 *   아래 칸에 빈칸이 든 내 문장 + 그 뜻(패턴에 해당하는 곳은 초록).
 * 단계: 처음에는 빈칸이 한 덩어리(낱말 수를 모른다, 자판은 대문자, 정답에 ' 가 있으면 ' 키) → '길이 보기'(낱말 수만큼의 칸) →
 *   '힌트 보기'(첫 낱말 앞부분이 채워진다) → '정답 보기'(입력이 비워지고 정답이 주황으로 비친다).
 * 치는 대로 보라 말풍선에 보이고, 맞게 친 낱말의 칸은 초록. 아포스트로피는 치지 않아도 된다(thats → That's). 다 치면 저절로 채점.
 * 진행 수는 힌트 · 정답 보기를 쓰지 않은 문제만 오른다(길이 보기는 괜찮다).
 */
export default function ExprQuiz() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<ExprQuestion | null>(null);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  /** 힌트로 채워 준 첫 낱말 앞부분 (지워지지 않는다) */
  const [locked, setLocked] = useState('');
  const [wrong, setWrong] = useState(0);
  const [wrongs, setWrongs] = useState<WrongNote[]>([]);
  const [pill, setPill] = useState<{ tone: Tone; msg: string } | null>(null);
  const [showKo, setShowKo] = useState(false);
  const [count, setCount] = useState(0);
  const [startCount, setStartCount] = useState<number | null>(null);
  const [due, setDue] = useState<Date | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [voice, setVoiceRaw] = useState(false);
  const [modeSwitched, setModeSwitched] = useState(false);
  const [listening, setListening] = useState(false);
  const [noSpeech, setNoSpeech] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [cardKey, setCardKey] = useState(0);
  const [panelReady, setPanelReady] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const [kbLeaving, setKbLeaving] = useState(false);
  const [revealDue, setRevealDue] = useState(false);
  const [exiting, setExiting] = useState<{ key: number; view: CardView } | null>(null);
  const [flights, setFlights] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [firstIn, setFirstIn] = useState(false);
  const pickerRef = useRef<ExprPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  /** 히스토리 학습: 목록의 문장만 순서대로 */
  const listIds = params.get('ids')?.split(',').filter(Boolean) ?? null;
  const extraTarget = Number(params.get('target')) || 0;
  const goal = listIds ? listIds.length : Math.max(settings?.exprGoal ?? 15, extraTarget);
  const pattern = useLiveQuery(async () => (q ? db.epatterns.get(q.item.pkey) : undefined), [q?.item.pkey]);
  const siblings = useLiveQuery(async () => (q ? (await db.eitems.where('pkey').equals(q.item.pkey).toArray()).filter((x) => x.id !== q.item.id) : []), [q?.item.id]);
  const bookmarked = useLiveQuery(async () => (q ? !!(await db.bookmarks.get(cardId('expr', q.item.id))) : false), [q?.item.id]);

  useStatusBarColor(settings?.studyTheme === 'sky' ? '#96cbf5' : '#bbe4df', false);
  useNavBarColor(phase === 'question' || phase === 'answered' ? ((phase === 'answered' && panelReady) || (phase === 'question' && voice) ? '#252627' : '#2b2c2b') : null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      stopSpeaking();
    },
    [],
  );
  const showToast = (msg: string) => {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 2650);
  };
  const say = (text: string, slow = settings?.speechRate === 'slow', rate?: number) => {
    setSpeaking(true);
    speak(text, slow, rate);
    later(() => setSpeaking(false), Math.min(6000, 900 + text.length * 75));
  };
  const setVoice = (v: boolean) => {
    setVoiceRaw(v);
    setModeSwitched(true);
    later(() => setModeSwitched(false), 260);
  };

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return false;
    }
    busy.current = false;
    setQ(next);
    setInput('');
    setLocked('');
    setStep(0);
    setWrong(0);
    setWrongs([]);
    setPill(null);
    setShowKo(false);
    setDue(null);
    setOverlay(null);
    setFlash(null);
    setPanelReady(false);
    setRevealDue(false);
    setMoreOpen(false);
    setNoSpeech(false);
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    setPhase('question');
    // 카드가 들어온 뒤 상대의 말을 들려준다
    later(() => speak(next.item.partner.en, settings?.speechRate === 'slow'), 450);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.speechRate]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    (async () => {
      const solved = listIds ? 0 : modeSolved(await modeToday('expr'));
      setCount(solved);
      setStartCount(solved);
      const first = (await db.ecourses.orderBy('order').first())?.id ?? '';
      const p = new ExprPicker(settings.exprCourse ?? first, listIds ? [...listIds] : null);
      await p.init();
      pickerRef.current = p;
      await load();
      setFirstIn(true);
      later(() => setFirstIn(false), 520);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, load]);

  const finish = async (byVoice = false) => {
    if (!q || busy.current) return;
    busy.current = true;
    // 힌트 · 정답 보기를 쓰지 않은 문제만 진행 수가 오른다 (길이 보기와 등록되지 않은 오답은 괜찮다 — 플립 실측)
    const counts = step < 2;
    const clean = counts && wrong === 0;
    setPill(null);
    setFlash({ kind: 'correct', key: Date.now() });
    sfx('correct');
    setPhase('answered');
    later(() => {
      setPanelReady(true);
      setKbLeaving(true);
      setPanelEnter(true);
      later(() => setKbLeaving(false), 400);
      later(() => setPanelEnter(false), 450);
    }, 400);
    later(() => setRevealDue(true), 770);
    if (counts && !listIds) {
      setCount((c) => c + 1);
      setFlights((f) => f + 1);
    }
    if (settings?.autoSpeak !== false && !byVoice) later(() => say(fillBlank(q.item.en, q.item.answer)), 250);
    try {
      const res = await recordModeAnswer('expr', q.item.id, { clean, wrong, failed: step >= 3, elapsedMs: Date.now() - startedAt.current, wrongs, counts }, goal);
      pickerRef.current?.note(q.item.id);
      setCount(listIds ? (c) => c + 1 : res.solved);
      setDue(res.row.due);
    } catch (err) {
      console.error('expr finish failed', err);
      showToast('기록 중 문제가 생겼어요.');
    }
  };

  const submit = () => {
    if (!q || phase !== 'question' || busy.current || !input.trim()) return;
    const e = evalExpr(input, q.item);
    if (e.kind === 'correct') {
      void finish();
      return;
    }
    // 등록된 답(비슷 · 오답 · 다른 정답)만 반응한다: 카드가 붉어지고 설명 알약이 뜬다.
    // 그 밖의 오답은 확인을 눌러도 눈에 보이는 반응이 없다 (플립 실측 2026-11-14: 'Zz' · 다 채운 'Do you eat this food' 모두 그대로)
    if (e.kind !== 'alt') return;
    const fb = { tone: e.tone, msg: e.msg };
    setPill(fb);
    if (!e.bonus) setWrong((n) => n + 1);
    setWrongs((w) => [...w, { w: input.trim(), tone: fb.tone, m: fb.msg }]);
    setFlash({ kind: 'wrong', key: Date.now() });
    sfx('wrong');
  };

  // 정답을 다 입력하면 바로 채점 (아포스트로피는 없어도 된다)
  useEffect(() => {
    if (phase === 'question' && q && settings?.autoCheck !== false && !busy.current && bare(input) === bare(q.item.answer)) void finish();
  });

  const edit = (fn: (s: string) => string) =>
    setInput((cur) => {
      if (phase !== 'question' || busy.current) return cur;
      let n = fn(cur).slice(0, (q?.item.answer.length ?? 20) + 14);
      if (locked && !n.toLowerCase().startsWith(locked.toLowerCase())) n = locked;
      if (n !== cur) setPill(null);
      return n;
    });

  /** 길이 보기 → 힌트 보기(첫 낱말의 앞 2글자를 채워 줌) → 정답 보기(채워 준 글자는 그대로 두고 나머지 정답이 주황으로 비침) */
  const hintStep = () => {
    if (!q || phase !== 'question' || busy.current) return;
    if (step === 0) setStep(1);
    else if (step === 1) {
      setStep(2);
      const prefix = exprPrefix(q.item.answer);
      setLocked(prefix);
      setInput(prefix);
      setPill(null);
    } else if (step === 2) {
      // 플립 실측: 힌트로 채워진 'Is' 는 초록으로 남고 나머지 낱말이 주황으로 비친다 (커서는 그대로)
      setStep(3);
      setInput(locked);
      setPill(null);
    }
  };

  const answerByVoice = async () => {
    if (!q || listening || phase !== 'question') return;
    setNoSpeech(false);
    stopSpeaking();
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const full = fillBlank(q.item.en, q.item.answer);
      if (alts.some((a) => bare(a).includes(bare(q.item.answer)) || speechMatchRate(a, full) > 0.9)) void finish(true);
      else {
        setPill({ tone: 'red', msg: `'${alts[0] ?? ''}'(이)라고 들렸어요. 다시 말해 보세요.` });
        setFlash({ kind: 'wrong', key: Date.now() });
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
      const best = Math.max(...alts.map((a) => speechMatchRate(a, fillBlank(q.item.en, q.item.answer))));
      showToast(`${best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!'} ${Math.round(best * 100)}% 일치`);
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'aborted' || e.message === 'no-speech'))) showToast(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  /** 나가기 · 학습 완료: 들어온 곳(코스 지도 · 목록)으로 돌아간다. 바로 열린 경우에는 코스 지도로 */
  const leave = () => {
    if (window.history.length > 1) nav(-1);
    else nav('/expr', { replace: true });
  };

  /** 이번 학습의 목표를 채웠는가 — 채우면 '다음 문제'가 초록 '학습 완료' */
  const reachedTarget = listIds ? count >= listIds.length : count >= goal && (extraTarget > 0 || (startCount != null && startCount < goal));

  const next = async () => {
    if (phase !== 'answered' || !view) return;
    if (reachedTarget) {
      leave();
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    const snap = { key: cardKey, view: { ...view, flash: null } };
    const ok = await load();
    if (!ok) return;
    setExiting(snap);
    later(() => setExiting((e) => (e?.key === snap.key ? null : e)), 300);
    setPanelLeaving(true);
    later(() => setPanelLeaving(false), 300);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'answered') {
        if (e.key === 'Enter' && panelReady) {
          e.preventDefault();
          void next();
        }
        return;
      }
      if (phase !== 'question') return;
      if (e.key === '1') hintStep();
      else if (e.key === '0') setVoice(!voice);
      else if (voice) {
        if (e.key === 'Enter') void answerByVoice();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        edit((s) => s.slice(0, -1));
      } else if (e.key === ' ') {
        e.preventDefault();
        edit((s) => (s && !s.endsWith(' ') ? s + ' ' : s));
      } else if (/^[a-zA-Z'-]$/.test(e.key)) {
        e.preventDefault();
        edit((s) => s + e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!settings || phase === 'loading') return <div className="quiz-screen vocab-quiz expr-quiz quiz-loading" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">{listIds ? '히스토리 학습을 마쳤어요' : '지금 풀 표현 문제가 없어요'}</p>
        <button className="btn primary" onClick={() => (listIds ? nav(-1) : nav('/expr'))}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q) return null;

  const answered = phase === 'answered';
  const showPanel = answered && panelReady;
  const full = fillBlank(q.item.en, q.item.answer);
  const badge = answered && revealDue ? { cls: 'badge-due', text: due ? dueBadge(due) : '잠시 후 복습' } : q.isNew ? { cls: 'badge-new', text: 'New' } : q.card?.last_review ? { cls: 'badge-ago', text: formatAgo(q.card.last_review) } : null;
  const view: CardView = { item: q.item, pattern, input, step, answered, badge, flash, pill: answered ? null : pill, showKo, caret: !voice && !answered };
  const alts = q.item.alts ?? [];
  const hintLabel = step === 0 ? '길이 보기' : step === 1 ? '힌트 보기' : '정답 보기';
  const hintIcon = step === 0 ? <QLength /> : step === 1 ? <QHint /> : <QReveal />;
  const hasApos = q.item.answer.includes("'");
  // 정답 말풍선: 내가 친 대로(소문자) 보이되 아포스트로피는 붙는다
  const bubbleText = q.item.answer.charAt(0).toLowerCase() + q.item.answer.slice(1);

  const tools: PanelTool[] = [
    { key: 'ex', icon: 'quote', label: '다른 예문', onClick: () => setOverlay((o) => (o === 'examples' ? null : 'examples')), active: overlay === 'examples' },
    {
      key: 'note',
      icon: 'notew',
      label: '오답 노트',
      // 등록된 오답이 없는 문장은 판이 뜨지 않고 안내만 잠깐 보인다 (말해보카)
      onClick: () => (alts.length ? setOverlay((o) => (o === 'wrongs' ? null : 'wrongs')) : showToast('이 문장은 오답 노트가 아직 없어요.')),
      badge: alts.length || undefined,
      active: overlay === 'wrongs',
    },
    { key: 'say', icon: 'micFill', label: '말해보기', onClick: () => void sayIt() },
    { key: 'dict', icon: 'search', label: '사전 검색', onClick: () => nav('/dict') },
    {
      key: 'mark',
      icon: 'bookmarkStar',
      label: '북마크',
      active: !!bookmarked,
      onClick: () => void toggleBookmark('expr', q.item.id).then((on) => showToast(on ? '북마크에 담았어요.' : '북마크에서 뺐어요.')),
    },
  ];
  const female = settings.voiceGender === 'female';
  const moreRows: MoreAction[][] = [
    [
      { key: 'slow', icon: 'turtle', label: '듣기평가 속도', onClick: () => say(full, true) },
      { key: 'voice', icon: 'voices', label: '다른 성별 음성', onClick: () => void saveSettings({ voiceGender: female ? 'male' : 'female' }).then(() => say(full)) },
      { key: 'x05', icon: 'slowplay', label: 'x0.5 듣기', onClick: () => say(full, false, 0.5) },
      { key: 'x08', icon: 'slowplay', label: 'x0.8 듣기', onClick: () => say(full, false, 0.8) },
    ],
  ];
  const noop = () => undefined;

  const infoCard =
    showPanel && overlay === 'examples' ? (
      <InfoCard icon={<QBookOutline />} title="다른 예문">
        {(siblings ?? []).length === 0 && <p className="overlay-empty">예문을 준비중입니다.</p>}
        {(siblings ?? []).slice(0, 2).map((s) => (
          <div key={s.id} className="ex-item big eq-ex">
            <p className="ex-en" lang="en">
              <FilledExpr item={s} />
            </p>
            <p className="eq-ex-ko">
              <KoText text={s.ko.split('**').join('')} />
            </p>
            <div className="eq-ex-btns">
              <button onClick={() => say(fillBlank(s.en, s.answer), true)} aria-label="천천히 듣기">
                <Icon name="turtleBig" size={22} />
              </button>
              <button onClick={() => say(fillBlank(s.en, s.answer))} aria-label="듣기">
                <QSpeak />
              </button>
            </div>
          </div>
        ))}
      </InfoCard>
    ) : null;
  const notePanel =
    showPanel && overlay === 'wrongs' ? (
      <div className="note-panel eq-note">
        {alts.map((a, i) => (
          <div key={i} className="note-item">
            <div className="note-head">
              <span className={`note-chip ${a.t}`}>{a.t === 'ok' ? '정답' : a.t === 'near' ? '비슷' : '오답'}</span>
              <b lang="en">{a.w}</b>
            </div>
            <p>
              <KoText text={a.m} />
            </p>
          </div>
        ))}
      </div>
    ) : null;

  return (
    <div className={`quiz-screen vocab-quiz expr-quiz theme-${settings.studyTheme}${answered ? ' answered' : ''}${notePanel ? ' notes-open' : ''}${infoCard ? ' examples-open' : ''}`}>
      <QuizScene theme={settings.studyTheme} />
      <QuizTop count={count} total={goal} title={listIds ? '히스토리 학습' : undefined} onLeave={leave} onSettings={() => nav('/settings/mode/expr')} />
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
                    <ECard view={exiting.view} />
                  </div>
                </div>
              )}
              <div className="card-slide" key={cardKey}>
                <div className="card-rel">
                  <ECard view={view} body={infoCard} onToggleKo={() => setShowKo((v) => !v)} onSpeak={() => say(q.item.partner.en)} />
                  {notePanel}
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
            answer={bubbleText}
            answerIsWord={false}
            flatBubble={step >= 3}
            onBubble={noop}
            wrongCount={alts.length}
            listening={listening && showPanel}
            onStopListening={() => window.dispatchEvent(new Event('voca:stop-listening'))}
            examplesOpen={overlay === 'examples'}
            wrongsOpen={overlay === 'wrongs'}
            onExamples={noop}
            onWrongs={noop}
            onSay={noop}
            onInfo={noop}
            onWordbook={noop}
            inWordbook={false}
            onSlow={noop}
            speaking={speaking && showPanel}
            tools={tools}
            bigFirst={{ icon: <BigBook />, label: '표현 사전', onClick: () => nav(`/expr-dict/${encodeURIComponent(q.item.pkey)}`) }}
            onReplay={() => say(full)}
            onNext={() => void next()}
            finish={reachedTarget && showPanel}
            onMore={() => setMoreOpen((v) => !v)}
            moreOpen={moreOpen && showPanel}
            moreRows={moreRows}
          />
        )}
        {(!showPanel || kbLeaving) && !voice && (
          <div className={`quiz-input ${kbLeaving ? 'leave' : panelLeaving ? 'enter' : ''}`} onAnimationEnd={(e) => e.animationName === 'kbSink' && setKbLeaving(false)}>
            <div className="toolbar">
              <button className="tool-btn eq-hint" onClick={hintStep} disabled={step >= 3 || answered}>
                {cardKey === 1 && <span className="kbd-hint tl">1</span>}
                {hintIcon}
                <span>{hintLabel}</span>
              </button>
              <div className="toolbar-center">
                {input && !answered && (
                  <span className={`bubble${step >= 3 ? ' flat' : ''}`} lang="en">
                    {shownInput(input, q.item.answer)}
                  </span>
                )}
              </div>
              <button className="tool-btn" onClick={() => setVoice(true)} disabled={!canRecognize() || answered}>
                {cardKey === 1 && <span className="kbd-hint tr">0</span>}
                <QMic />
                <span>음성 모드</span>
              </button>
            </div>
            <Keyboard
              onChar={(c) => edit((s) => s + c.toLowerCase())}
              onBackspace={() => edit((s) => s.slice(0, -1))}
              onSpace={() => edit((s) => (s && !s.endsWith(' ') ? s + ' ' : s))}
              onEnter={submit}
              shift={input === '' && /^[A-Z]/.test(q.item.answer)}
              apostrophe={step === 0 && hasApos}
            />
          </div>
        )}
        {!showPanel && voice && (
          <div className="voice-zone">
            <svg className="vz-bar" viewBox="0 0 360 88.333" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 0H72C110 0 125 50.333 180 50.333S250 0 288 0H360V88.333H0z" />
            </svg>
            <div className={`vz-mic ${listening ? 'listening' : ''} ${noSpeech && !listening ? 'nospeech' : ''}`}>
              <i className="vz-halo h2" />
              <i className="vz-halo h1" />
              <i className="vz-ring" />
              <button className="mic-big" onClick={() => (listening ? window.dispatchEvent(new Event('voca:stop-listening')) : void answerByVoice())} aria-label={listening ? '듣는 중' : '말하기'}>
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
            <button className="vz-btn left" onClick={hintStep} disabled={step >= 3 || answered}>
              <span className="vz-key" lang="en">
                1
              </span>
              {hintIcon}
              <span>{hintLabel}</span>
            </button>
            <button className="vz-btn right" onClick={() => setVoice(false)} disabled={answered}>
              <span className="vz-key" lang="en">
                0
              </span>
              <QKeyboard />
              <span>키보드 모드</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 말풍선에 보이는 글자: 정답의 낱말과 같게 친 낱말은 정답의 꼴(대문자 · 아포스트로피)로 */
function shownInput(input: string, answer: string): string {
  const targets = answer.trim().split(/\s+/);
  return input
    .replace(/^\s+/, '')
    .split(' ')
    .map((t, i) => shownWord(t, targets[i] ?? ''))
    .join(' ');
}

/** 도구줄의 '길이 보기' 그림: 둥근 네모 안의 ↔ (플립 실측: 23.33 x 18.67) */
function QLength() {
  return (
    <svg className="qi eq-len" viewBox="0 0 23.333 18.667" width="23.333" height="18.667" aria-hidden="true">
      <rect x="0" y="0" width="23.333" height="18.667" rx="3.600" fill="currentColor" />
      <path d="M6.600 9.333h10.133M9.300 6.300 6.200 9.333 9.300 12.367M14.033 6.300l3.100 3.033-3.100 3.034" fill="none" stroke="var(--q-toolbar)" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 빈칸이 채워진 문장 (패턴 부분은 초록) — '다른 예문' */
function FilledExpr({ item }: { item: ExprItem }) {
  const [before, after] = item.en.split('___');
  return (
    <>
      {before && <span>{before}</span>}
      <span className="blank filled">{item.answer}</span>
      {after && <span>{after}</span>}
    </>
  );
}

/** 표현 카드: 띠(패턴의 뜻) + 배지 + 상대의 말(캐릭터 · 말풍선) + 안내 알약 + 빈칸이 든 문장 + 뜻 */
function ECard({ view, body, onToggleKo, onSpeak }: { view: CardView; /** 카드 몸통 자리에 대신 그릴 것 ('다른 예문') */ body?: ReactNode; onToggleKo?: () => void; onSpeak?: () => void }) {
  const { item, pattern, input, step, answered, flash } = view;
  const targets = item.answer.trim().split(/\s+/);
  const typed = input.replace(/^\s+/, '').split(' ');
  const active = Math.min(typed.length - 1, targets.length - 1);
  const [before, after] = item.en.split('___');
  const prefix = exprPrefix(item.answer);
  const flashCls = flash ? `is-${flash.kind}` : '';
  return (
    <div className={`qcard-wrap eq-wrap${answered ? ' done' : ''}`}>
      <div className="qcard-head eq-head">
        <div className="eq-band">
          <svg viewBox="0 0 13 11" aria-hidden="true">
            <path d="M2 0h9a2 2 0 0 1 2 2v4.600a2 2 0 0 1-2 2H5.600L2.600 11V8.600H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="currentColor" />
            <circle cx="3.700" cy="4.300" r="0.950" fill="var(--q-tab)" />
            <circle cx="6.500" cy="4.300" r="0.950" fill="var(--q-tab)" />
            <circle cx="9.300" cy="4.300" r="0.950" fill="var(--q-tab)" />
          </svg>
          <span>
            <KoText text={pattern?.ko ?? ''} />
          </span>
        </div>
        <div className="qcard-badges">{view.badge && <span className={view.badge.cls}>{view.badge.text}</span>}</div>
      </div>
      {body}
      <div className={`qcard eq-card ${flashCls}`} key={flash?.key ?? 0} hidden={!!body}>
        {flash?.kind === 'correct' && (
          <span className="mark-check" aria-hidden="true">
            <svg viewBox="0 0 65.500 51.700">
              <polygon points="0,25.200 20.500,12.800 30.500,31.100 50,0 65.500,11.400 31.900,51.700" fill="currentColor" />
            </svg>
          </span>
        )}
        {flash?.kind === 'wrong' && (
          <span className="mark-bang" aria-hidden="true">
            <svg viewBox="0 0 17.667 46.667">
              <polygon points="1.800,0 17.300,2.600 11.800,32.300 1.300,30.100" fill="currentColor" />
              <circle cx="6.030" cy="40.500" r="6.100" fill="currentColor" />
            </svg>
          </span>
        )}
        <div className="qcard-top eq-top">
          <span className="eq-avatar">
            <Mascot size={54} />
          </span>
          <div className="eq-bubble" onClick={onSpeak}>
            <p lang={view.showKo ? 'ko' : 'en'}>{view.showKo ? <KoText text={item.partner.ko} /> : item.partner.en}</p>
            <button
              className={`eq-trans${view.showKo ? ' on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleKo?.();
              }}
              aria-label="번역 보기"
            >
              <svg viewBox="0 0 14 14" aria-hidden="true">
                <rect x="0.600" y="0.600" width="8" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.200" />
                <circle cx="9.800" cy="9.800" r="4.200" fill="currentColor" />
                <path d="M8.300 11.600 9.800 7.800l1.500 3.800M8.800 10.500h2" fill="none" stroke="#2f3134" strokeWidth="0.900" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
        {view.pill && (
          <div className={`pill ${view.pill.tone}`}>
            <span>
              <KoText text={view.pill.msg} />
            </span>
          </div>
        )}
        <div className="qcard-bottom eq-bottom">
          <p className="en" lang="en">
            {before && <span>{before}</span>}
            {answered ? (
              targets.map((w, i) => (
                <span key={i}>
                  <span className="blank filled">{w}</span>
                  {i < targets.length - 1 ? ' ' : ''}
                </span>
              ))
            ) : step === 0 ? (
              <span className="blank active eq-long">
                <span className="blank-text">
                  <span className="typed">{shownInput(input, item.answer)}</span>
                  {view.caret && input !== '' && <span className="caret" />}
                </span>
                <span className="blank-size" aria-hidden="true">
                  {item.answer}
                </span>
              </span>
            ) : (
              targets.map((w, i) => {
                const t = typed[i] ?? '';
                const ok = i < active && bare(t) === bare(w);
                const shown = shownWord(t, w);
                // 정답 보기 뒤: 지금까지 친 글자가 정답의 앞부분이면 그 뒤를 주황으로 비춘다 (다르게 쳤으면 비추지 않는다)
                const ghost = step >= 3 && !ok && shown === w.slice(0, shown.length) ? w.slice(shown.length) : '';
                // 힌트로 채워 준 글자는 초록
                const hinted = i === 0 && step >= 2 && !ok && prefix.trim() !== '' && shown === prefix.trim();
                return (
                  <span key={i}>
                    <span className={`blank${i === active ? ' active' : ''}${ok ? ' ok' : ''}`}>
                      <span className="blank-text">
                        <span className={`typed${hinted ? ' eq-pre' : ''}`}>{ok ? w : shown}</span>
                        {view.caret && i === active && <span className="caret" />}
                        {ghost && <span className="ghost">{ghost}</span>}
                      </span>
                      <span className="blank-size" aria-hidden="true">
                        {w}
                      </span>
                    </span>
                    {i < targets.length - 1 ? ' ' : ''}
                  </span>
                );
              })
            )}
            {after && <span>{after}</span>}
          </p>
          <p className="eq-ko">
            <KoSentence ko={item.ko} />
          </p>
        </div>
      </div>
    </div>
  );
}
