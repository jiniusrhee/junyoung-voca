import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Keyboard from '../components/Keyboard';
import Mascot from '../components/Mascot';
import { KoSentence } from '../components/QuizCard';
import { Backdrop, StudyTop, ToolPanel } from '../components/StudyChrome';
import WrongItem from '../components/WrongItem';
import { db } from '../db';
import { ExprPicker, evalExpr, exprPrefix, type ExprQuestion, wordMatches } from '../lib/expr';
import { dueBadge, modeToday, recordModeAnswer } from '../lib/modeStudy';
import { useSettings } from '../lib/settings';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { normalize, speechMatchRate } from '../lib/text';
import { formatAgo } from '../lib/time';
import type { Tone, WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty';
type Overlay = 'examples' | 'wrongs' | null;

const fillBlank = (en: string, answer: string) => en.replace('___', answer);

export default function ExprQuiz() {
  const settings = useSettings();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>('loading');
  const [q, setQ] = useState<ExprQuestion | null>(null);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0); // 0: 길이 보기 전, 1: 길이 보임, 2: 첫 글자 힌트, 3: 정답 보기
  /** 힌트로 채워 준 첫 단어 앞부분(지워지지 않음, 말해보카) */
  const [locked, setLocked] = useState('');
  const [wrong, setWrong] = useState(0);
  const [wrongs, setWrongs] = useState<WrongNote[]>([]);
  const [pill, setPill] = useState<{ tone: Tone; msg: string } | null>(null);
  const [showKo, setShowKo] = useState(false);
  const [count, setCount] = useState(0);
  const [due, setDue] = useState<Date | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [shiftOn, setShiftOn] = useState(false);
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'wrong' | 'correct'; key: number } | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const pickerRef = useRef<ExprPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);
  const finishing = useRef(false);
  /** 히스토리 학습: 목록의 문장만 순서대로 */
  const listIds = params.get('ids')?.split(',').filter(Boolean) ?? null;
  const goal = listIds ? listIds.length : Math.max(settings?.exprGoal ?? 15, Number(params.get('target')) || 0);
  const pattern = useLiveQuery(async () => (q ? db.epatterns.get(q.item.pkey) : undefined), [q?.item.pkey]);
  const siblings = useLiveQuery(async () => (q ? (await db.eitems.where('pkey').equals(q.item.pkey).toArray()).filter((x) => x.id !== q.item.id) : []), [q?.item.id]);

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return;
    }
    finishing.current = false;
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
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    setPhase('question');
    window.setTimeout(() => speak(next.item.partner.en, settings?.speechRate === 'slow'), 350);
  }, [settings?.speechRate]);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    (async () => {
      setCount(listIds ? 0 : (await modeToday('expr')).total);
      const first = (await db.ecourses.orderBy('order').first())?.id ?? '';
      const p = new ExprPicker(settings.exprCourse ?? first, listIds ? [...listIds] : null);
      await p.init();
      pickerRef.current = p;
      await load();
    })().catch(console.error);
  }, [settings, load]);

  const finish = async () => {
    if (!q || finishing.current) return;
    finishing.current = true;
    const res = await recordModeAnswer(
      'expr',
      q.item.id,
      { clean: wrong === 0 && step < 2, wrong, failed: step >= 3, elapsedMs: Date.now() - startedAt.current, wrongs },
      goal,
    );
    pickerRef.current?.note(q.item.id);
    setCount(listIds ? (c) => c + 1 : res.total);
    setDue(res.row.due);
    setPill(null);
    setFlash({ kind: 'correct', key: Date.now() });
    setPhase('answered');
    if (settings?.autoSpeak) speak(fillBlank(q.item.en, q.item.answer), settings.speechRate === 'slow');
  };

  const submit = () => {
    if (!q || phase !== 'question' || !input.trim()) return;
    const e = evalExpr(input, q.item);
    if (e.kind === 'correct') {
      void finish();
      return;
    }
    const fb =
      e.kind === 'alt'
        ? { tone: e.tone, msg: e.msg }
        : e.kind === 'typo'
          ? { tone: 'yellow' as Tone, msg: '거의 맞았어요. 철자를 다시 확인해 보세요.' }
          : { tone: 'red' as Tone, msg: '다시 생각해 보세요. 한국어 문장의 초록색 부분을 영어로 말하면 뭘까요?' };
    setPill(fb);
    if (!(e.kind === 'alt' && e.bonus)) setWrong((n) => n + 1);
    setWrongs((w) => [...w, { w: input.trim(), tone: fb.tone, m: fb.msg }]);
    setFlash({ kind: 'wrong', key: Date.now() });
  };

  // 정답을 다 입력하면 바로 채점
  useEffect(() => {
    if (phase === 'question' && q && settings?.autoCheck && normalize(input) === normalize(q.item.answer)) void finish();
  });

  const edit = (fn: (s: string) => string) =>
    setInput((cur) => {
      let n = fn(cur).slice(0, (q?.item.answer.length ?? 20) + 14);
      if (locked && !n.startsWith(locked)) n = locked;
      if (n !== cur) setPill(null);
      return n;
    });

  /** 말해보카: 길이 보기 → 힌트 보기(첫 단어 앞 ⅓ 글자를 채워 줌) → 정답 보기(입력을 비우고 정답이 주황으로 비침) */
  const hintStep = () => {
    if (!q) return;
    if (step === 0) setStep(1);
    else if (step === 1) {
      setStep(2);
      const prefix = exprPrefix(q.item.answer);
      setLocked(prefix);
      setInput(prefix);
      setPill(null);
    } else if (step === 2) {
      setStep(3);
      setLocked('');
      setInput('');
      setPill(null);
    }
  };

  const answerByVoice = async () => {
    if (!q || listening) return;
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const full = fillBlank(q.item.en, q.item.answer);
      if (alts.some((a) => normalize(a).includes(normalize(q.item.answer)) || speechMatchRate(a, full) > 0.9)) void finish();
      else {
        setPill({ tone: 'red', msg: `'${alts[0] ?? ''}'(이)라고 들렸어요. 다시 말해 보세요.` });
        setWrong((n) => n + 1);
      }
    } catch (e) {
      setPill({ tone: 'red', msg: voiceErrorMessage(e) });
    } finally {
      setListening(false);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (phase === 'answered' && e.key === 'Enter') {
        e.preventDefault();
        void load();
        return;
      }
      if (phase !== 'question' || voice) return;
      if (e.key === 'Enter') {
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

  if (!settings || phase === 'loading') return <div className="quiz-screen center" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">{listIds ? '히스토리 학습을 마쳤어요' : '지금 풀 표현 문제가 없어요'}</p>
        <button className="btn primary" onClick={() => nav('/expr')}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q) return null;
  const answered = phase === 'answered';
  const ansWords = q.item.answer.split(/\s+/);
  const typed = input.replace(/^\s+/, '').split(' ');
  const ok = wordMatches(input, q.item.answer);
  const active = Math.min(typed.length - 1, ansWords.length - 1);
  const [before, after] = q.item.en.split('___');
  const badge = answered && due ? dueBadge(due) : q.isNew ? 'New' : q.card?.last_review ? formatAgo(q.card.last_review) : '';
  const flashCls = flash ? (flash.kind === 'wrong' ? 'is-wrong' : 'is-correct') : '';

  return (
    <div className="quiz-screen expr-quiz">
      <Backdrop theme={settings.studyTheme} />
      <StudyTop count={count} total={goal} onBack={() => nav('/expr')} onSettings={() => nav('/settings/vocab')} />
      <main className="quiz-stage">
        <div className="card-slide" key={cardKey}>
          <div className="qcard-wrap">
            <div className="qcard-head">
              <div className="pattern-band">
                <Icon name="chat" size={16} /> {pattern?.ko ?? ''}
              </div>
              <div className="qcard-badges">{badge && <span className={answered ? 'badge-due' : q.isNew ? 'badge-new' : 'badge-ago'}>{badge}</span>}</div>
            </div>
            <div className={`qcard e-card ${flashCls}`} key={flash?.key ?? 0}>
              <div className="qcard-top e-top">
                <span className="e-avatar">
                  <Mascot size={62} />
                </span>
                <button className="e-bubble" onClick={() => speak(q.item.partner.en, settings.speechRate === 'slow')}>
                  <span>{q.item.partner.en}</span>
                  {showKo && <small>{q.item.partner.ko}</small>}
                  <span
                    className="e-trans"
                    role="button"
                    aria-label="번역 보기"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowKo((v) => !v);
                    }}
                  >
                    가A
                  </span>
                </button>
              </div>
              {pill && !answered && (
                <div className={`pill ${pill.tone}`}>
                  <Icon name="bulb" size={18} className="pill-icon" />
                  <span>{pill.msg}</span>
                </div>
              )}
              <div className="qcard-bottom">
                <p className="en e-line">
                  {before && <span>{before}</span>}
                  {answered ? (
                    ansWords.map((w, i) => (
                      <span key={i} className="e-box done">
                        {w}
                      </span>
                    ))
                  ) : step === 0 ? (
                    <span className="e-box long" style={{ minWidth: `${q.item.answer.length * 0.5 + 1.4}em` }}>
                      {input}
                      <span className="caret" />
                    </span>
                  ) : (
                    ansWords.map((w, i) => {
                      const t = typed[i] ?? '';
                      const ghost = step >= 3 && w.toLowerCase().startsWith(t.toLowerCase()) ? w.slice(t.length) : '';
                      // 힌트로 보여줬던 앞부분은 초록, 나머지는 주황
                      const hintLen = i === 0 ? Math.max(0, exprPrefix(q.item.answer).length - t.length) : 0;
                      return (
                        <span key={i} className={`e-box ${ok[i] ? 'ok' : ''} ${i === active ? 'active' : ''}`} style={{ minWidth: `${Math.max(w.length, t.length) * 0.58 + 0.8}em` }}>
                          {t}
                          {i === active && !voice && <span className="caret" />}
                          {ghost.slice(0, hintLen) && <span className="ghost hint">{ghost.slice(0, hintLen)}</span>}
                          {ghost.slice(hintLen) && <span className="ghost">{ghost.slice(hintLen)}</span>}
                        </span>
                      );
                    })
                  )}
                  {after && <span>{after}</span>}
                </p>
                <p className="e-ko">
                  <KoSentence ko={q.item.ko} />
                </p>
              </div>
              {overlay && answered && (
                <div className="card-overlay">
                  <button className="overlay-close" onClick={() => setOverlay(null)} aria-label="닫기">
                    <Icon name="close" size={18} />
                  </button>
                  {overlay === 'examples' ? (
                    <>
                      <p className="overlay-title">
                        <Icon name="chat" size={16} /> 다른 예문
                      </p>
                      {(siblings ?? []).map((s) => (
                        <div key={s.id} className="ex-item">
                          <p className="ex-ko">{s.partner.en}</p>
                          <p className="ex-en">{fillBlank(s.en, s.answer)}</p>
                          <p className="ex-ko">
                            <KoSentence ko={s.ko} />
                          </p>
                          <button className="ex-play" onClick={() => speak(fillBlank(s.en, s.answer))} aria-label="듣기">
                            <Icon name="speaker" size={18} />
                          </button>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {(q.item.alts ?? []).map((a, i) => (
                        <WrongItem key={i} w={a.w} tone={a.t === 'ok' ? 'green' : a.t === 'near' ? 'yellow' : 'red'} m={a.m} />
                      ))}
                      {wrongs
                        .filter((w) => !(q.item.alts ?? []).some((a) => normalize(a.w) === normalize(w.w)))
                        .map((w, i) => (
                          <WrongItem key={`m${i}`} w={w.w} tone={w.tone} m={w.m} soft />
                        ))}
                      {!(q.item.alts?.length || wrongs.length) && <p className="overlay-empty">이 문제는 등록된 오답이 없어요.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {answered ? (
        <ToolPanel
          bubble={<span className="bubble">{input || q.item.answer}</span>}
          tools={[
            { icon: 'chat', label: '다른 예문', onClick: () => setOverlay((o) => (o === 'examples' ? null : 'examples')) },
            { icon: 'note', label: '오답 노트', onClick: () => setOverlay((o) => (o === 'wrongs' ? null : 'wrongs')), badge: (q.item.alts?.length ?? 0) || undefined },
            { icon: 'mic', label: '말해보기', onClick: () => void answerByVoice(), active: listening },
            { icon: 'search', label: '사전 검색', onClick: () => nav('/dict') },
          ]}
          big={[
            { icon: 'book', label: '표현 사전', onClick: () => nav(`/expr-dict/${encodeURIComponent(q.item.pkey)}`) },
            { icon: 'speaker', label: '다시 듣기', onClick: () => speak(fillBlank(q.item.en, q.item.answer), settings.speechRate === 'slow') },
            { icon: 'play', label: '다음 문제', onClick: () => void load(), primary: true },
          ]}
        />
      ) : voice ? (
        <div className="voice-zone">
          <div className="voice-bubble-row">{listening && <span className="voice-hint">듣고 있어요…</span>}</div>
          <div className={`voice-halo ${listening ? 'listening' : ''}`}>
            <button className="mic-big" onClick={() => void answerByVoice()} disabled={!canRecognize()} aria-label="말하기">
              {listening ? <span className="stop-square" /> : <Icon name="mic" size={40} />}
            </button>
          </div>
          <div className="voice-bar">
            <button className="tool-btn" onClick={hintStep} disabled={step >= 3}>
              <Icon name="question" size={26} className="ic-purple" />
              <span>{step === 0 ? '길이 보기' : step === 1 ? '힌트 보기' : '정답 보기'}</span>
            </button>
            <button className="tool-btn" onClick={() => setVoice(false)}>
              <Icon name="keyboard" size={26} className="ic-purple" />
              <span>키보드 모드</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="quiz-input">
          <div className="toolbar">
            <button className="tool-btn" onClick={hintStep} disabled={step >= 3}>
              {step === 0 ? <Icon name="list" size={26} className="ic-purple" /> : step === 1 ? <Icon name="question" size={26} className="ic-purple" /> : <Icon name="check" size={26} className="ic-green" />}
              <span>{step === 0 ? '길이 보기' : step === 1 ? '힌트 보기' : '정답 보기'}</span>
            </button>
            <div className="toolbar-center">{input && <span className="bubble">{input}</span>}</div>
            <button className="tool-btn" onClick={() => setVoice(true)} disabled={!canRecognize()}>
              <Icon name="mic" size={26} className="ic-purple" />
              <span>음성 모드</span>
            </button>
          </div>
          <Keyboard
            onChar={(c) => {
              edit((s) => s + c);
              setShiftOn(false);
            }}
            onBackspace={() => edit((s) => s.slice(0, -1))}
            onSpace={() => edit((s) => (s && !s.endsWith(' ') ? s + ' ' : s))}
            onEnter={submit}
            onShift={() => setShiftOn((v) => !v)}
            shift={shiftOn || (input === '' && (q.item.en.trimStart().startsWith('___') || (step >= 3 && /^[A-Z]/.test(q.item.answer))))}
          />
        </div>
      )}
    </div>
  );
}
