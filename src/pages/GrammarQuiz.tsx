import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AfterPanel, { BigBook, type MoreAction, type PanelTool } from '../components/AfterPanel';
import KoText from '../components/KoText';
import Mascot from '../components/Mascot';
import Pterodactyls from '../components/Pterodactyls';
import { QReveal } from '../components/QuizIcons';
import { QuizScene, QuizTop } from '../components/QuizShell';
import { db } from '../db';
import { GrammarPicker, buildCards, checkGrammar, diffWords, displayAnswer, tokenize, type GrammarCheck, type GrammarQuestion, type WordCard } from '../lib/grammar';
import { cardId, dueBadge, modeSolved, modeToday, recordModeAnswer, toggleBookmark } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { sfx } from '../lib/sfx';
import { canRecognize, recognizeOnce, speak, stopSpeaking, voiceErrorMessage } from '../lib/speech';
import { useNavBarColor, useStatusBarColor } from '../lib/statusBar';
import { speechMatchRate } from '../lib/text';
import { formatAgo } from '../lib/time';
import type { GrammarTopic } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty';
type Flash = { kind: 'wrong' | 'correct'; key: number } | null;

/** 화면에 그릴 카드 한 장 (지금 문제, 또는 '다음 문제'로 빠져나가는 중인 지난 문제) */
interface CardView {
  q: GrammarQuestion;
  topic: GrammarTopic | null;
  /** 답 줄의 칩 (카드 id 와 화면 글자) */
  chips: { id: number; text: string; mark?: 'wrong' | 'swap' | null }[];
  /** 문장 끝 부호. 정답 뒤에는 마지막 칩에 붙으므로 빈 문자열 */
  end: string;
  answered: boolean;
  /** 정답 뒤 배지('N 뒤 복습')가 나왔는가 */
  dueText: string | null;
  flash: Flash;
  hint: string | null;
}

/**
 * 문법 학습 — 말해보카 플립 실측(2026-11-14)으로 다시 만듦. 어휘 퀴즈와 같은 틀(머리줄·풍경·카드·정답 패널)을 쓴다.
 *
 * 문제: 한국어 문장 + 빈 답 줄(밑줄, 오른쪽 끝에 마침표). 아래 낱말 칩(알파벳순)을 누르면 칩이 0.15초 동안 답 줄로 날아가 놓이고
 *   (첫 낱말은 대문자로), 원래 자리는 빈 칸으로 남는다. 답 줄의 칩을 누르면 제자리로 날아 돌아가고 남은 칩들이 0.15초 동안 당겨진다.
 *   하나라도 놓이면 '확인'이 보라색. 다 놓아도 저절로 채점되지 않는다.
 * 오답: 카드가 붉어지고 '!' 도장, 노란 안내 알약(더 써야 할 낱말 수 / 표시된 낱말을 옮기기 / 순서 바꾸기). 틀린 낱말은 붉은 칩 + − 배지,
 *   옮겨야 할 낱말은 ⇄ 배지, 더 써야 할 낱말은 보기 칩에 + 배지. 그 뒤로는 칩을 넣고 뺄 때마다 표시가 바로 바뀐다.
 * 정답: 초록 체크 도장 → 레벨 꼬리표가 내려가고 보라 머리띠(레벨 + 주제)가 올라옴 → 0.4초 뒤 보기 칸이 내려가고 패널이 올라옴 → 0.77초 뒤 배지가 'N 뒤 복습'.
 *   한 번에 맞힌 문제만 진행 수가 오른다(틀렸다 맞히거나 정답 보기를 쓰면 '잠시 후 복습'이고 수는 그대로).
 * 정답 보기: 남은 칩이 한꺼번에 날아가 놓이고 카드가 붉어진 뒤 정답 화면으로.
 */
export default function GrammarQuiz() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<GrammarQuestion | null>(null);
  const [topic, setTopic] = useState<GrammarTopic | null>(null);
  const [picked, setPicked] = useState<WordCard[]>([]);
  const [check, setCheck] = useState<GrammarCheck | null>(null);
  const [wrong, setWrong] = useState(0);
  /** 정답으로 처리된 문장 (모범답안 또는 복수정답) */
  const [matched, setMatched] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [startCount, setStartCount] = useState<number | null>(null);
  const [due, setDue] = useState<Date | null>(null);
  const [note, setNote] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const [flash, setFlash] = useState<Flash>(null);
  /** 정답 0.4초 뒤: 보기 칸 → 패널 */
  const [panelReady, setPanelReady] = useState(false);
  const [panelEnter, setPanelEnter] = useState(false);
  const [panelLeaving, setPanelLeaving] = useState(false);
  const [bankLeaving, setBankLeaving] = useState(false);
  /** 정답 0.77초 뒤: 배지가 'N 뒤 복습'으로 */
  const [revealDue, setRevealDue] = useState(false);
  const [exiting, setExiting] = useState<{ key: number; view: CardView } | null>(null);
  const [flights, setFlights] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [firstIn, setFirstIn] = useState(false);
  const pickerRef = useRef<GrammarPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const bankRef = useRef<HTMLDivElement | null>(null);
  /** 칩 움직임: 방금 놓은 칩이 떠난 자리(보기 칸), 방금 뺀 칩이 떠난 자리(답 줄), 남은 칩들의 이전 자리 */
  const flyIn = useRef<Map<number, DOMRect>>(new Map());
  const flyOut = useRef<{ id: number; from: DOMRect; text: string }[]>([]);
  const prevRects = useRef<Map<number, DOMRect>>(new Map());

  const cards = useMemo(() => (q ? buildCards(q.s) : []), [q]);
  const tk = useMemo(() => (q ? tokenize(q.s.en) : null), [q]);
  /** 히스토리 학습: 목록의 문장만 순서대로 */
  const listIds = params.get('ids')?.split(',').filter(Boolean) ?? null;
  const extraTarget = Number(params.get('target')) || 0;
  const goal = listIds ? listIds.length : Math.max(settings?.grammarGoal ?? 10, extraTarget);
  const bookmarked = useLiveQuery(async () => (q ? !!(await db.bookmarks.get(cardId('grammar', q.s.id))) : false), [q?.s.id]);

  useStatusBarColor(settings?.studyTheme === 'sky' ? '#96cbf5' : '#bbe4df', false);
  useNavBarColor(phase === 'question' || phase === 'answered' ? (phase === 'answered' && panelReady ? '#252627' : '#202122') : null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      stopSpeaking();
      document.querySelectorAll('.gq-ghost').forEach((g) => g.remove());
    },
    [],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 2650);
  };

  const say = useCallback(
    (text: string, slow = false, rate?: number) => {
      setSpeaking(true);
      speak(text, slow, rate);
      later(() => setSpeaking(false), Math.min(6000, 900 + text.length * 75));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return false;
    }
    setQ(next);
    setTopic((await db.gtopics.get(next.s.topic)) ?? null);
    setPicked([]);
    setCheck(null);
    setWrong(0);
    setMatched(null);
    setDue(null);
    setNote(false);
    setVoiceMsg(null);
    setFlash(null);
    setPanelReady(false);
    setRevealDue(false);
    setMoreOpen(false);
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    busy.current = false;
    setPhase('question');
    return true;
  }, []);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    (async () => {
      const solved = listIds ? 0 : modeSolved(await modeToday('grammar'));
      setCount(solved);
      setStartCount(solved);
      const p = new GrammarPicker(settings.grammarLevel ?? Math.min(30, settings.level ?? 10), listIds ? [...listIds] : null);
      await p.init();
      pickerRef.current = p;
      await load();
      // 처음 들어올 때: 보기 칸이 아래에서 올라온다 (어휘 퀴즈의 자판과 같음)
      setFirstIn(true);
      later(() => setFirstIn(false), 520);
    })().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, load]);

  /* ---------- 칩 움직임 ---------- */
  const rectsOfLine = () => {
    const m = new Map<number, DOMRect>();
    lineRef.current?.querySelectorAll<HTMLElement>('[data-ans]').forEach((el) => m.set(Number(el.dataset.ans), el.getBoundingClientRect()));
    return m;
  };
  const bankRect = (id: number) => bankRef.current?.querySelector<HTMLElement>(`[data-bank="${id}"]`)?.getBoundingClientRect() ?? null;

  /** 답 줄·보기 칸을 바꾸기 직전에 부른다: 지금 자리들을 적어 둔다 */
  const beforeChange = (next: WordCard[]) => {
    const now = rectsOfLine();
    prevRects.current = now;
    const nextIds = new Set(next.map((c) => c.id));
    for (const c of next) {
      if (!now.has(c.id)) {
        const r = bankRect(c.id);
        if (r) flyIn.current.set(c.id, r);
      }
    }
    for (const c of picked) {
      if (!nextIds.has(c.id)) {
        const r = now.get(c.id);
        const el = lineRef.current?.querySelector<HTMLElement>(`[data-ans="${c.id}"]`);
        if (r) flyOut.current.push({ id: c.id, from: r, text: el?.textContent ?? c.text });
      }
    }
  };

  /** 떠 있는 칩 하나를 from → to 로 0.15초 동안 옮긴다 (말해보카 실측: 150ms, 감속) */
  const fly = (text: string, from: DOMRect, to: DOMRect, done: () => void) => {
    const g = document.createElement('span');
    g.className = 'gq-ghost';
    g.lang = 'en';
    g.textContent = text;
    g.style.left = `${to.left}px`;
    g.style.top = `${to.top}px`;
    g.style.width = `${to.width}px`;
    g.style.height = `${to.height}px`;
    document.body.appendChild(g);
    const end = () => {
      g.remove();
      done();
    };
    if (typeof g.animate !== 'function') {
      end();
      return;
    }
    const a = g.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'translate(0, 0)' }], { duration: 150, easing: 'ease-out' });
    a.onfinish = end;
    a.oncancel = end;
  };

  useLayoutEffect(() => {
    const line = lineRef.current;
    if (line) {
      line.querySelectorAll<HTMLElement>('[data-ans]').forEach((el) => {
        const id = Number(el.dataset.ans);
        const to = el.getBoundingClientRect();
        const from = flyIn.current.get(id);
        if (from) {
          el.style.visibility = 'hidden';
          fly(el.textContent ?? '', from, to, () => {
            el.style.visibility = '';
          });
          return;
        }
        const p = prevRects.current.get(id);
        if (p && (Math.abs(p.left - to.left) > 0.5 || Math.abs(p.top - to.top) > 0.5) && typeof el.animate === 'function') {
          el.animate([{ transform: `translate(${p.left - to.left}px, ${p.top - to.top}px)` }, { transform: 'translate(0, 0)' }], { duration: 150, easing: 'ease-out' });
        }
      });
    }
    for (const b of flyOut.current) {
      const slot = bankRef.current?.querySelector<HTMLElement>(`[data-bank="${b.id}"]`);
      if (!slot) continue;
      slot.classList.add('landing');
      fly(b.text, b.from, slot.getBoundingClientRect(), () => slot.classList.remove('landing'));
    }
    flyIn.current.clear();
    flyOut.current = [];
    prevRects.current = new Map();
  }, [picked]);

  /* ---------- 풀기 ---------- */
  const answerCards = (en: string): WordCard[] => {
    const used = new Set<number>();
    return tokenize(en).tokens.map((w) => {
      const c = cards.find((k) => k.text.toLowerCase() === w.toLowerCase() && !used.has(k.id))!;
      used.add(c.id);
      return c;
    });
  };

  const tapCard = (c: WordCard) => {
    if (phase !== 'question' || busy.current || picked.some((p) => p.id === c.id)) return;
    const next = [...picked, c];
    beforeChange(next);
    setPicked(next);
    if (check && q) setCheck(checkGrammar(q.s, next, cards));
  };

  const untap = (c: WordCard) => {
    if (phase !== 'question' || busy.current) return;
    const next = picked.filter((p) => p.id !== c.id);
    beforeChange(next);
    setPicked(next);
    if (check && q) setCheck(next.length ? checkGrammar(q.s, next, cards) : null);
  };

  /** 정답 처리. clean = 한 번에 맞힘 (이때만 진행 수가 오른다) */
  const finish = async (asFailed: boolean, en: string, byVoice = false) => {
    if (!q || busy.current) return;
    busy.current = true;
    const clean = !asFailed && wrong === 0;
    setMatched(en);
    setCheck(null);
    setVoiceMsg(null);
    setFlash({ kind: asFailed ? 'wrong' : 'correct', key: Date.now() });
    if (!asFailed) sfx('correct');
    setPhase('answered');
    // 보기 칸 → 패널 (정답 0.4초 뒤, 0.12초 동안), 배지 0.77초 뒤, 익룡은 진행 수가 오를 때만
    later(() => {
      setPanelReady(true);
      setBankLeaving(true);
      setPanelEnter(true);
      later(() => setBankLeaving(false), 120);
      later(() => setPanelEnter(false), 450);
    }, 400);
    later(() => setRevealDue(true), 770);
    if (clean && !listIds) {
      // 진행 수는 맞힌 순간 바로 오른다 (기록이 끝나면 저장된 값으로 다시 맞춘다)
      setCount((c) => c + 1);
      setFlights((f) => f + 1);
    }
    if (settings?.autoSpeak !== false && !byVoice) later(() => say(en, settings?.speechRate === 'slow'), 250);
    try {
      const res = await recordModeAnswer(
        'grammar',
        q.s.id,
        { clean, wrong, failed: asFailed, elapsedMs: Date.now() - startedAt.current, counts: clean },
        goal,
      );
      pickerRef.current?.note(q.s.id);
      setCount(listIds ? (c) => c + 1 : res.solved);
      setDue(res.row.due);
    } catch (err) {
      console.error('grammar finish failed', err);
      showToast('기록 중 문제가 생겼어요.');
    }
  };

  const submit = () => {
    if (!q || !picked.length || phase !== 'question' || busy.current) return;
    const r = checkGrammar(q.s, picked, cards);
    if (r.status === 'correct') {
      void finish(false, r.matched ?? q.s.en);
      return;
    }
    setCheck(r);
    setVoiceMsg(null);
    setWrong((n) => n + 1);
    setFlash({ kind: 'wrong', key: Date.now() });
    sfx('wrong');
  };

  const showAnswer = () => {
    if (phase !== 'question' || !q || busy.current) return;
    const ans = answerCards(q.s.en);
    beforeChange(ans);
    setPicked(ans);
    void finish(true, q.s.en);
  };

  const sayAnswer = async () => {
    if (!q || listening || phase !== 'question') return;
    setVoiceMsg(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = Math.max(...alts.map((a) => speechMatchRate(a, q.s.en)));
      if (best >= 0.85) {
        const ans = answerCards(q.s.en);
        beforeChange(ans);
        setPicked(ans);
        void finish(false, q.s.en, true);
      } else {
        setVoiceMsg(`'${alts[0] ?? ''}'(이)라고 들렸어요. 다시 말해 보세요.`);
        setWrong((n) => n + 1);
      }
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'aborted' || e.message === 'no-speech'))) setVoiceMsg(voiceErrorMessage(e));
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
      const best = Math.max(...alts.map((a) => speechMatchRate(a, matched ?? q.s.en)));
      const pct = Math.round(best * 100);
      showToast(`${best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!'} ${pct}% 일치`);
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'aborted' || e.message === 'no-speech'))) showToast(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  /** 이번 학습의 목표를 채웠는가 (하루 목표는 이번 학습 중에 채웠을 때만) — 채우면 '다음 문제'가 초록 '학습 완료' */
  const reachedTarget = !listIds && count >= goal && (extraTarget > 0 || (startCount != null && startCount < goal));

  const next = async () => {
    if (phase !== 'answered' || !view) return;
    if (reachedTarget) {
      nav('/');
      return;
    }
    stopSpeaking();
    setSpeaking(false);
    const snap = { key: cardKey, view: { ...view, flash: null } };
    const ok = await load();
    if (!ok) return;
    // 지난 카드는 왼쪽으로 빠지고(0.3초) 새 카드가 오른쪽에서 들어온다. 0.17초 뒤 보기 칸이 올라와 패널을 덮는다
    setExiting(snap);
    later(() => setExiting((e) => (e?.key === snap.key ? null : e)), 300);
    setPanelLeaving(true);
    later(() => setPanelLeaving(false), 300);
  };

  if (!settings || phase === 'loading') return <div className="quiz-screen vocab-quiz grammar-quiz quiz-loading" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">{listIds ? '히스토리 학습을 마쳤어요' : '지금 풀 문법 문제가 없어요'}</p>
        {!listIds && <p className="muted-light small">복습할 문장은 아직 때가 안 됐고, 새 문장도 모두 학습했어요.</p>}
        <button className="btn primary" onClick={() => (listIds ? nav(-1) : nav('/all?mode=grammar'))}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q || !tk) return null;

  const answered = phase === 'answered';
  // 정답 뒤: 칩의 글자를 정답 문장의 낱말로 바꾸고(대소문자), 마지막 칩에 문장 부호를 붙인다
  const doneTk = answered ? tokenize(matched ?? q.s.en) : null;
  const words = doneTk ? doneTk.tokens.map((w, i) => (i === doneTk.tokens.length - 1 ? w + doneTk.end : w)) : displayAnswer(picked.map((c) => c.text));
  const view: CardView = {
    q,
    topic,
    chips: picked.map((c, i) => ({ id: c.id, text: words[i] ?? c.text, mark: answered ? null : check?.marks[i] })),
    end: answered ? '' : tk.end,
    answered,
    dueText: answered && revealDue ? (due ? dueBadge(due) : '잠시 후 복습') : null,
    flash,
    hint: answered ? null : (check?.message ?? voiceMsg),
  };
  const plus = new Set(check?.plus ?? []);
  const showPanel = answered && panelReady;
  const alts = q.s.alts ?? [];

  const tools: PanelTool[] = [
    { key: 'slow', icon: 'turtle', label: '듣기평가 속도', onClick: () => say(matched ?? q.s.en, true) },
    { key: 'note', icon: 'notew', label: '오답 노트', onClick: () => setNote((v) => !v), badge: alts.length || undefined, active: note },
    { key: 'say', icon: 'micFill', label: '말해보기', onClick: () => void sayIt() },
    { key: 'dict', icon: 'search', label: '사전 검색', onClick: () => nav('/dict') },
    {
      key: 'mark',
      icon: 'bookmark',
      label: '북마크',
      active: !!bookmarked,
      onClick: () => void toggleBookmark('grammar', q.s.id).then((on) => showToast(on ? '북마크에 담았어요.' : '북마크에서 뺐어요.')),
    },
  ];
  const female = settings.voiceGender === 'female';
  const moreRows: MoreAction[][] = [
    [
      { key: 'x05', icon: 'play', label: 'x0.5 듣기', onClick: () => say(matched ?? q.s.en, false, 0.5) },
      { key: 'x08', icon: 'play', label: 'x0.8 듣기', onClick: () => say(matched ?? q.s.en, false, 0.8) },
      { key: 'voice', icon: 'voices', label: '다른 성별 음성', onClick: () => void saveSettings({ voiceGender: female ? 'male' : 'female' }).then(() => say(matched ?? q.s.en)) },
    ],
  ];
  const noop = () => undefined;

  return (
    <div className={`quiz-screen vocab-quiz grammar-quiz theme-${settings.studyTheme}${answered ? ' answered' : ''}${note && showPanel ? ' gnote-open' : ''}`}>
      <QuizScene theme={settings.studyTheme} />
      <QuizTop count={count} total={goal} onLeave={() => nav('/')} onSettings={() => nav('/settings/mode/grammar')} />
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
                    <GCard view={exiting.view} />
                  </div>
                </div>
              )}
              <div className="card-slide" key={cardKey}>
                <div className="card-rel">
                  <GCard view={view} lineRef={lineRef} onUntap={(id) => { const c = picked.find((p) => p.id === id); if (c) untap(c); }} />
                  {!showPanel && (
                    <button className={`gq-mic ${listening ? 'listening' : ''}`} onClick={() => void sayAnswer()} disabled={!canRecognize()} aria-label="말로 답하기">
                      <svg viewBox="0 0 59.333 59.333" aria-hidden="true">
                        {/* 플립 실측: 몸통 10.67 × 17.5, 아래 호(반지름 7.5, 굵기 2.4), 대 2 × 5.3, 받침 8.67 × 1.67 */}
                        <rect x="24.167" y="15.667" width="10.667" height="17.500" rx="5.333" fill="currentColor" />
                        <path d="M22.400 31.300A7.500 7.500 0 0 0 36.600 31.300" fill="none" stroke="currentColor" strokeWidth="2.400" />
                        <rect x="28.500" y="36" width="2" height="6" fill="currentColor" />
                        <rect x="25.167" y="41.333" width="8.667" height="1.700" rx="0.850" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="scene-row" />
      </main>

      <div className={`quiz-bottom${firstIn ? ' first' : ''}`}>
        {(showPanel || panelLeaving) && (
          <AfterPanel
            className={!showPanel && panelLeaving ? 'leave' : panelEnter ? 'enter' : ''}
            noBubble
            answer=""
            answerIsWord={false}
            onBubble={noop}
            wrongCount={0}
            listening={listening && showPanel}
            onStopListening={noop}
            examplesOpen={false}
            wrongsOpen={note}
            onExamples={noop}
            onWrongs={noop}
            onSay={noop}
            onInfo={noop}
            onWordbook={noop}
            inWordbook={false}
            onSlow={noop}
            speaking={speaking}
            tools={tools}
            bigFirst={{ icon: <BigBook />, label: '문법 사전', onClick: () => nav(`/grammar-dict/${q.s.topic}`) }}
            onReplay={() => say(matched ?? q.s.en, settings.speechRate === 'slow')}
            onNext={() => void next()}
            finish={reachedTarget && showPanel}
            onMore={() => setMoreOpen((v) => !v)}
            moreOpen={moreOpen && showPanel}
            moreRows={moreRows}
            above={
              note && showPanel ? (
                <div className="gq-note">
                  <div className="gq-note-sec">
                    <span className="gq-tag model">모범답안</span>
                    <p className="gq-note-en" lang="en">
                      {q.s.en}
                    </p>
                    <p className="gq-note-ko">
                      <KoText text={q.s.ko} />
                    </p>
                  </div>
                  {alts.map((a, i) => (
                    <div key={i} className="gq-note-sec alt">
                      <span className="gq-tag alt">복수정답</span>
                      <p className="gq-note-en" lang="en">
                        {diffWords(q.s.en, a.en).map((x, k) => (
                          <span key={k} className={x.diff ? 'diff' : ''}>
                            {k > 0 ? ' ' : ''}
                            {x.w}
                          </span>
                        ))}
                      </p>
                      <p className="gq-note-ko">
                        <KoText text={a.note} />
                      </p>
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
        )}
        {(!showPanel || bankLeaving) && (
          <div className={`quiz-input gq-input ${bankLeaving ? 'leave' : panelLeaving ? 'enter' : ''}`}>
            <div className="gq-bank" ref={bankRef}>
              {cards.map((c) => {
                const used = picked.some((p) => p.id === c.id);
                return (
                  <button key={c.id} data-bank={c.id} className={`gq-word${used ? ' used' : ''}`} lang="en" onClick={() => tapCard(c)} disabled={used || answered}>
                    {plus.has(c.id) && !used && <GBadge kind="plus" />}
                    <span>{c.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="gq-actions">
              <button className="gq-show" onClick={showAnswer} disabled={answered}>
                <QReveal />
                <span>정답 보기</span>
              </button>
              <button className={`gq-submit${picked.length ? ' on' : ''}`} onClick={submit} disabled={!picked.length || answered}>
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 문법 카드: 레벨 꼬리표(정답 뒤에는 보라 머리띠) + 배지 + 한국어 문장 + 안내 알약 + 답 줄 */
function GCard({ view, lineRef, onUntap }: { view: CardView; lineRef?: React.RefObject<HTMLDivElement | null>; onUntap?: (id: number) => void }) {
  const { q, topic, flash, answered } = view;
  const level = topic?.level ?? String(q.s.levelNum);
  const flashCls = flash ? `is-${flash.kind}` : '';
  return (
    <div className={`qcard-wrap gq-wrap${answered ? ' done' : ''}`}>
      <div className="qcard-head">
        <span className="qcard-tab">
          레벨 {level} <span className="tab-q">?</span>
        </span>
        {answered && (
          <div className="gq-band">
            <span className="gq-band-lv">레벨 {level}</span>
            <span className="gq-band-title">
              <KoText text={topic?.title ?? ''} />
            </span>
          </div>
        )}
        <div className="qcard-badges">
          {view.dueText ? (
            <span className="gq-due">{view.dueText}</span>
          ) : q.isNew ? (
            <span className="badge-new">New</span>
          ) : q.card?.last_review ? (
            <span className="badge-ago">{formatAgo(q.card.last_review)}</span>
          ) : null}
        </div>
      </div>
      <div className={`qcard gq-card ${flashCls}`} key={flash?.key ?? 0}>
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
        <div className="qcard-top">
          <p className="ko">
            <KoText text={q.s.ko} />
          </p>
        </div>
        {view.hint && (
          <div className="gq-pill">
            <svg className="gq-bulb" viewBox="0 0 24.200 26" aria-hidden="true">
              {/* 플립 실측: 빛살까지 24.2 × 26, 알 지름 15.8, 속의 번개는 밝은 색 */}
              <circle cx="12.100" cy="12.400" r="7.900" fill="currentColor" />
              <rect x="8.400" y="17" width="7.400" height="4.700" rx="1.200" fill="currentColor" />
              <rect x="9" y="23" width="6.200" height="2.400" rx="1.200" fill="currentColor" />
              <path d="M13.700 6.900 8.500 13.500h3.100l-1.300 4.700 5.200-6.700h-3.100z" fill="#f3e2b4" />
              <path d="M12.100.700v1.900M4.400 3.600l1.400 1.500M19.800 3.600l-1.400 1.500M.700 12.400h1.900M21.600 12.400h1.900" fill="none" stroke="#d8ae4c" strokeWidth="1.300" strokeLinecap="round" />
            </svg>
            <span>
              <KoText text={view.hint} />
            </span>
          </div>
        )}
        <div className="qcard-bottom">
          <div className="gq-line" ref={lineRef} lang="en">
            {view.chips.map((c) => (
              <button key={c.id} data-ans={c.id} className={`gq-chip ${c.mark ?? ''}`} onClick={() => onUntap?.(c.id)} disabled={answered || !onUntap}>
                {c.mark === 'wrong' && <GBadge kind="minus" />}
                {c.mark === 'swap' && <GBadge kind="swap" />}
                {c.text}
              </button>
            ))}
            {view.end && <span className="gq-end">{view.end}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 칩 왼쪽 위의 작은 동그라미 배지 (지름 13): −(빼야 할 낱말) · ↔(옮길 낱말) · +(더 써야 할 낱말) */
function GBadge({ kind }: { kind: 'minus' | 'swap' | 'plus' }) {
  return (
    <i className={`gq-badge ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 13 13">
        {kind === 'minus' && <rect x="3" y="5.600" width="7" height="1.800" rx="0.900" fill="#fff" />}
        {kind === 'plus' && <path d="M5.600 3h1.800v2.600H10v1.800H7.400V10H5.600V7.400H3V5.600h2.600z" fill="#fff" />}
        {kind === 'swap' && <path d="M1.900 6.500 4.800 4v1.700h3.400V4l2.900 2.500L8.200 9V7.300H4.800V9z" fill="#fff" />}
      </svg>
    </i>
  );
}
