import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Backdrop, StudyTop, ToolPanel } from '../components/StudyChrome';
import { db } from '../db';
import { GrammarPicker, buildCards, checkGrammar, diffWords, displayAnswer, tokenize, type GrammarCheck, type GrammarQuestion, type WordCard } from '../lib/grammar';
import { dueBadge, modeToday, recordModeAnswer } from '../lib/modeStudy';
import { useSettings } from '../lib/settings';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { speechMatchRate } from '../lib/text';
import { formatAgo } from '../lib/time';
import type { GrammarTopic, WrongNote } from '../types';

type Phase = 'loading' | 'question' | 'answered' | 'empty';

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
  const [wrongs, setWrongs] = useState<WrongNote[]>([]);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState(0);
  const [due, setDue] = useState<Date | null>(null);
  const [note, setNote] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const pickerRef = useRef<GrammarPicker | null>(null);
  const startedAt = useRef(Date.now());
  const started = useRef(false);

  const cards = useMemo(() => (q ? buildCards(q.s) : []), [q]);
  const tk = useMemo(() => (q ? tokenize(q.s.en) : null), [q]);
  const goal = Math.max(settings?.grammarGoal ?? 10, Number(params.get('target')) || 0);

  const load = useCallback(async () => {
    const next = await pickerRef.current?.next();
    if (!next) {
      setPhase('empty');
      return;
    }
    setQ(next);
    setTopic((await db.gtopics.get(next.s.topic)) ?? null);
    setPicked([]);
    setCheck(null);
    setWrong(0);
    setWrongs([]);
    setFailed(false);
    setDue(null);
    setNote(false);
    setVoiceMsg(null);
    setCardKey((k) => k + 1);
    startedAt.current = Date.now();
    setPhase('question');
  }, []);

  useEffect(() => {
    if (!settings || started.current) return;
    started.current = true;
    (async () => {
      setCount((await modeToday('grammar')).total);
      const p = new GrammarPicker(settings.grammarLevel ?? Math.min(30, settings.level ?? 10));
      await p.init();
      pickerRef.current = p;
      await load();
    })().catch(console.error);
  }, [settings, load]);

  const finish = async (asFailed: boolean, finalPicked: WordCard[] | null) => {
    if (!q) return;
    if (finalPicked) setPicked(finalPicked);
    const res = await recordModeAnswer(
      'grammar',
      q.s.id,
      { clean: !asFailed && wrong === 0, wrong, failed: asFailed, elapsedMs: Date.now() - startedAt.current, wrongs },
      goal,
    );
    pickerRef.current?.note(q.s.id);
    setCount(res.total);
    setDue(res.row.due);
    setFailed(asFailed);
    setCheck(null);
    setPhase('answered');
    if (settings?.autoSpeak) speak(q.s.en, settings.speechRate === 'slow');
  };

  const answerCards = (): WordCard[] => {
    if (!tk) return [];
    const used = new Set<number>();
    return tk.tokens.map((w) => {
      const c = cards.find((k) => k.text.toLowerCase() === w.toLowerCase() && !used.has(k.id))!;
      used.add(c.id);
      return c;
    });
  };

  const tapCard = (c: WordCard) => {
    if (phase !== 'question' || picked.some((p) => p.id === c.id)) return;
    const next = [...picked, c];
    setPicked(next);
    if (check && q) setCheck(checkGrammar(q.s, next, cards));
  };

  const untap = (c: WordCard) => {
    if (phase !== 'question') return;
    const next = picked.filter((p) => p.id !== c.id);
    setPicked(next);
    if (check && q) setCheck(next.length ? checkGrammar(q.s, next, cards) : null);
  };

  const submit = () => {
    if (!q || !picked.length) return;
    const r = checkGrammar(q.s, picked, cards);
    if (r.status === 'correct') {
      void finish(false, null);
      return;
    }
    setCheck(r);
    setWrong((n) => n + 1);
    setWrongs((w) => [...w, { w: displayAnswer(picked.map((p) => p.text)).join(' '), tone: 'red', m: r.message }]);
  };

  const showAnswer = () => {
    if (phase !== 'question') return;
    void finish(true, answerCards());
  };

  const sayAnswer = async () => {
    if (!q || listening) return;
    setVoiceMsg(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = Math.max(...alts.map((a) => speechMatchRate(a, q.s.en)));
      if (best >= 0.85) {
        void finish(false, answerCards());
      } else {
        setVoiceMsg(`'${alts[0] ?? ''}'(이)라고 들렸어요. 다시 말해 보세요.`);
        setWrong((n) => n + 1);
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
      const best = Math.max(...alts.map((a) => speechMatchRate(a, q.s.en)));
      const pct = Math.round(best * 100);
      setVoiceMsg(`${best >= 0.95 ? 'Perfect!' : best >= 0.8 ? 'Great!' : best >= 0.6 ? 'Good!' : 'Nice try!'} ${pct}% 일치 · '${alts[0] ?? ''}'`);
    } catch (e) {
      setVoiceMsg(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  if (!settings || phase === 'loading') return <div className="quiz-screen center" />;
  if (phase === 'empty') {
    return (
      <div className="quiz-screen center col gap">
        <Mascot size={110} />
        <p className="quiz-msg">지금 풀 문법 문제가 없어요</p>
        <p className="muted-light small">복습할 문장은 아직 때가 안 됐고, 새 문장도 모두 학습했어요.</p>
        <button className="btn primary" onClick={() => nav('/all?mode=grammar')}>
          돌아가기
        </button>
      </div>
    );
  }
  if (!q || !tk) return null;

  const answered = phase === 'answered';
  const shown = answered ? (picked.length ? picked : answerCards()) : picked;
  const words = displayAnswer(shown.map((c) => c.text));
  const plus = new Set(check?.plus ?? []);
  const badge = answered && due ? dueBadge(due) : q.isNew ? 'New' : q.card?.last_review ? formatAgo(q.card.last_review) : '';

  return (
    <div className="quiz-screen grammar-quiz">
      <Backdrop theme={settings.studyTheme} />
      <StudyTop count={count} total={goal} onBack={() => nav(-1)} onSettings={() => nav('/settings/vocab')} />
      <main className="quiz-stage">
        <div className="card-slide" key={cardKey}>
          <div className="qcard-wrap">
            <div className="qcard-head">
              {answered && topic ? (
                <div className="topic-band">
                  <span className="topic-level">레벨 {topic.level}</span> {topic.title}
                </div>
              ) : (
                <span className="qcard-tab">
                  레벨 {topic?.level ?? q.s.levelNum} <span className="tab-q">?</span>
                </span>
              )}
              <div className="qcard-badges">
                {badge && <span className={answered ? 'badge-due' : q.isNew ? 'badge-new' : 'badge-ago'}>{badge}</span>}
              </div>
            </div>
            <div className="qcard g-card">
              <div className="qcard-top">
                <p className="ko">{q.s.ko}</p>
              </div>
              {(check || voiceMsg) && !answered && (
                <div className={`pill ${check ? 'yellow' : 'red'}`}>
                  <Icon name="bulb" size={18} className="pill-icon" />
                  <span>{check?.message ?? voiceMsg}</span>
                </div>
              )}
              {answered && voiceMsg && (
                <div className="pill green">
                  <Icon name="mic" size={18} className="pill-icon" />
                  <span>{voiceMsg}</span>
                </div>
              )}
              <div className="qcard-bottom g-bottom">
                <div className="g-line">
                  {shown.map((c, i) => {
                    const mark = check?.marks[i];
                    const last = i === shown.length - 1;
                    return (
                      <button key={c.id} className={`g-chip ${mark ?? ''}`} onClick={() => untap(c)} disabled={answered}>
                        {mark === 'wrong' && <i className="g-badge minus">−</i>}
                        {mark === 'swap' && <i className="g-badge swap">⇄</i>}
                        {words[i]}
                        {answered && last ? tk.end : ''}
                      </button>
                    );
                  })}
                  {!answered && <span className="g-end">{tk.end}</span>}
                </div>
              </div>
              {note && answered && (
                <div className="card-overlay g-note">
                  <button className="overlay-close" onClick={() => setNote(false)} aria-label="닫기">
                    <Icon name="close" size={18} />
                  </button>
                  <span className="note-tag model">모범답안</span>
                  <p className="note-en">{q.s.en}</p>
                  <p className="note-ko">{q.s.ko}</p>
                  {(q.s.alts ?? []).map((a, i) => (
                    <div key={i} className="note-alt">
                      <span className="note-tag alt">복수정답</span>
                      <p className="note-en">
                        {diffWords(q.s.en, a.en).map((x, k) => (
                          <span key={k} className={x.diff ? 'diff' : ''}>
                            {x.w}{' '}
                          </span>
                        ))}
                      </p>
                      <p className="note-ko">{a.note}</p>
                    </div>
                  ))}
                  {wrongs.length > 0 && (
                    <>
                      <span className="note-tag wrong">내가 쓴 답</span>
                      {wrongs.map((w, i) => (
                        <p key={i} className="note-wrong">
                          {w.w}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            {!answered && (
              <button className={`g-mic ${listening ? 'listening' : ''}`} onClick={() => void sayAnswer()} disabled={!canRecognize()} aria-label="말로 답하기">
                <Icon name="mic" size={30} />
              </button>
            )}
          </div>
        </div>
      </main>

      {answered ? (
        <ToolPanel
          tools={[
            { icon: 'note', label: '오답 노트', onClick: () => setNote((v) => !v), badge: (q.s.alts?.length ?? 0) + wrongs.length || undefined },
            { icon: 'mic', label: listening ? '듣는 중…' : '말해보기', onClick: () => void sayIt(), active: listening },
            { icon: 'search', label: '사전 검색', onClick: () => nav('/dict?q=' + encodeURIComponent(q.s.en.split(' ')[1] ?? '')) },
          ]}
          big={[
            { icon: 'book', label: '문법 사전', onClick: () => nav(`/grammar-dict/${q.s.topic}`) },
            { icon: 'speaker', label: '다시 듣기', onClick: () => speak(q.s.en, settings.speechRate === 'slow') },
            { icon: 'play', label: '다음 문제', onClick: () => void load(), primary: true },
          ]}
        />
      ) : (
        <div className="g-input">
          <div className="g-bank">
            {cards.map((c) => {
              const used = picked.some((p) => p.id === c.id);
              return (
                <button key={c.id} className={`g-card-btn ${used ? 'used' : ''}`} onClick={() => tapCard(c)} disabled={used}>
                  {plus.has(c.id) && !used && <i className="g-badge plus">+</i>}
                  <span style={{ visibility: used ? 'hidden' : 'visible' }}>{c.text}</span>
                </button>
              );
            })}
          </div>
          <div className="g-actions">
            <button className="g-show" onClick={showAnswer}>
              <Icon name="check" size={26} />
              <span>정답 보기</span>
            </button>
            <button className={`g-submit ${picked.length ? 'on' : ''}`} onClick={submit} disabled={!picked.length}>
              확인
            </button>
          </div>
        </div>
      )}
      {failed && answered && <span className="sr-only">정답 보기로 넘어감</span>}
    </div>
  );
}
