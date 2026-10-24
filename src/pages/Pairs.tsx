import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { speak } from '../lib/speech';

interface Stage {
  id: string;
  title: string;
  a: string;
  b: string;
  sceneA: string;
  sceneB: string;
  easy: [string, string][];
  hard: { a: string; b: string; ko: string }[];
}
interface Level {
  id: string;
  name: string;
  story: string;
  stages: Stage[];
}
type Scores = Record<string, { easy?: number; hard?: number }>;

const QUESTIONS = 8;
/** 통과 기준(점수) */
const PASS = 80;

function usePairs() {
  return useLiveQuery(async () => ((await db.kv.get('pairsData'))?.value as { levels: Level[] } | undefined) ?? null, []);
}
function useScores() {
  return useLiveQuery(async () => ((await db.kv.get('pairsScores'))?.value as Scores | undefined) ?? {}, []);
}

/** [f]ork 처럼 대괄호 부분을 색칠 */
function Bracket({ text }: { text: string }): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/);
  return parts.map((p, i) => (p.startsWith('[') ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>));
}

export default function Pairs() {
  const nav = useNavigate();
  const data = usePairs();
  const scores = useScores();
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const levels = data?.levels ?? [];
  const lv = levels[tab];
  const total = lv ? lv.stages.length * 2 : 0;
  const passed = lv ? lv.stages.reduce((s, st) => s + ((scores?.[st.id]?.easy ?? 0) >= PASS ? 1 : 0) + ((scores?.[st.id]?.hard ?? 0) >= PASS ? 1 : 0), 0) : 0;
  const pct = total ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="vs-page pairs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 발음 구분 연습
        </button>
      </header>
      <nav className="pairs-tabs">
        {levels.map((l, i) => (
          <button key={l.id} className={i === tab ? 'active' : ''} onClick={() => setTab(i)}>
            {l.name}
          </button>
        ))}
      </nav>
      {!data && <p className="empty-note">발음 연습 데이터를 받는 중이에요.</p>}
      {lv && (
        <>
          <div className="pairs-story">
            <p>{lv.story}</p>
            <div className="pairs-ring">
              <b>{pct}</b>
              <small>%</small>
              <span>
                {passed}/{total}
              </span>
            </div>
          </div>
          {lv.stages.map((st, i) => {
            const isOpen = (open ?? lv.stages[0].id) === st.id;
            const sc = scores?.[st.id] ?? {};
            return (
              <section key={st.id} className="pair-stage">
                <button className="pair-head" onClick={() => setOpen(isOpen ? '' : st.id)}>
                  <span className="box-tag">{i + 1}단계</span>
                  <span className="pair-title">
                    <b>{st.a}</b> vs <b>{st.b}</b> <small>{st.title.replace(`${st.a} vs ${st.b}`, '').trim()}</small>
                  </span>
                  <span className="pair-toggle">
                    <Icon name="caret" size={16} style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} />
                  </span>
                </button>
                {isOpen && (
                  <>
                    <div className="pair-scene">
                      <div className="scene-bubble left">
                        <Bracket text={st.sceneA} />
                      </div>
                      <div className="scene-bubble right">
                        <Bracket text={st.sceneB} />
                      </div>
                      <div className="scene-chars">
                        <Mascot size={70} />
                        <Mascot size={70} mood="cheer" />
                      </div>
                    </div>
                    <div className="pair-modes">
                      {(['easy', 'hard'] as const).map((m) => (
                        <div key={m} className="pair-mode">
                          <div className="pair-score">
                            <span>{m.toUpperCase()}</span>
                            <span>{sc[m] != null ? `${sc[m]}점` : '--'}</span>
                          </div>
                          <button className={`pair-start ${m}`} onClick={() => nav(`/pairs/${st.id}/${m}`)}>
                            START
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

interface PairQ {
  /** 화면에 보여줄 목표 (단어 또는 문장) */
  target: string;
  /** 왼쪽/오른쪽 카드가 들려줄 말 */
  cards: [string, string];
  /** 목표 발음이 들어 있는 카드 */
  answer: 0 | 1;
  ko?: string;
}

function buildQuestions(st: Stage, mode: 'easy' | 'hard'): PairQ[] {
  const out: PairQ[] = [];
  for (let i = 0; i < QUESTIONS; i++) {
    const answer = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    const t = Math.random() < 0.5 ? 0 : 1;
    if (mode === 'easy') {
      const p = st.easy[i % st.easy.length];
      const target = p[t];
      const other = p[1 - t];
      out.push({ target, cards: answer === 0 ? [target, other] : [other, target], answer });
    } else {
      // HARD: 두 문장을 펼쳐 놓고, 들려준 쪽을 고른다
      const h = st.hard[i % st.hard.length];
      out.push({ target: answer === 0 ? h.a : h.b, cards: [h.a, h.b], answer, ko: h.ko });
    }
  }
  return out.sort(() => Math.random() - 0.5);
}

/** 발음 구분 연습 문제: 단어를 보여주고, 두 카드 중 맞는 발음을 고른다 (말해보카 방식) */
export function PairQuiz() {
  const { stage = '', mode = 'easy' } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const data = usePairs();
  const st = useMemo(() => data?.levels.flatMap((l) => l.stages).find((s) => s.id === stage), [data, stage]);
  const [qs, setQs] = useState<PairQ[]>([]);
  const [i, setI] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [lecture, setLecture] = useState(false);
  const saved = useRef(false);
  const slow = mode !== 'hard';

  useEffect(() => {
    if (st && !qs.length) setQs(buildQuestions(st, mode === 'hard' ? 'hard' : 'easy'));
  }, [st, mode, qs.length]);

  const playBoth = (q: PairQ) => {
    if (mode === 'hard') {
      setPlaying(q.answer);
      speak(q.target, false, 1, () => setPlaying(null));
      return;
    }
    setPlaying(0);
    speak(q.cards[0], slow, 1, () => {
      window.setTimeout(() => {
        setPlaying(1);
        speak(q.cards[1], slow, 1, () => setPlaying(null));
      }, 500);
    });
  };
  useEffect(() => {
    if (qs[i] && picked === null) {
      const t = window.setTimeout(() => playBoth(qs[i]), 400);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, i, picked]);

  const finished = i >= QUESTIONS;
  const score = Math.round((marks.filter(Boolean).length / QUESTIONS) * 1000) / 10;
  useEffect(() => {
    if (!finished || saved.current || !st) return;
    saved.current = true;
    (async () => {
      const cur = ((await db.kv.get('pairsScores'))?.value as Scores | undefined) ?? {};
      const m = mode === 'hard' ? 'hard' : 'easy';
      const prev = cur[st.id]?.[m] ?? 0;
      await db.kv.put({ key: 'pairsScores', value: { ...cur, [st.id]: { ...cur[st.id], [m]: Math.max(prev, score) } } });
    })().catch(console.error);
  }, [finished, st, mode, score]);

  if (!settings || !st || !qs.length) return <div className="quiz-screen center" />;

  if (finished) {
    const good = score >= PASS;
    return (
      <div className="result-screen pair-result">
        <h2 className="pr-title">학습 완료!</h2>
        <div className="pr-card">
          <span className="pr-mode">{mode === 'hard' ? 'Hard' : 'Easy'}</span>
          <b className="pr-stage">{st.title}</b>
          <div className="pr-marks">
            {marks.map((ok, k) => (
              <span key={k} className={ok ? 'o' : 'x'}>
                {ok ? 'O' : 'X'}
              </span>
            ))}
          </div>
          <p className="pr-score">{score}점</p>
        </div>
        <div className="pr-bubble">
          <b>{good ? '훌륭해요!' : '수고하셨어요.'}</b>
          <p>{good ? '이 소리는 이제 잘 구분하네요.' : '지금은 이 발음이 어렵지만,\n계속 연습하면 구별할 수 있을 거예요.'}</p>
        </div>
        <Mascot size={130} mood={good ? 'cheer' : 'happy'} />
        <button className="btn primary big pr-ok" onClick={() => nav(-1)}>
          확인
        </button>
      </div>
    );
  }

  const q = qs[i];
  /** 단어 팩에 같은 단어가 있으면 발음 기호를 보여준다 (말해보카: wife [waɪf]) */
  const ipa = useLiveQuery(async () => (q && mode !== 'hard' ? (await db.words.filter((w) => w.word.toLowerCase() === q.target.toLowerCase()).first())?.ipa : undefined), [q?.target, mode]);
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    setMarks((m) => [...m, k === q.answer]);
    speak(q.cards[k], slow);
  };

  return (
    <div className="quiz-screen pair-quiz">
      <header className="quiz-top">
        <button className="icon-btn" onClick={() => setLeaving(true)} aria-label="나가기">
          <Icon name="back" size={24} />
        </button>
        <div className="pair-dots">
          {Array.from({ length: QUESTIONS }, (_, k) => (
            <span key={k} className={k < marks.length ? (marks[k] ? 'o' : 'x') : k === i ? 'cur' : ''} />
          ))}
        </div>
        <span className="icon-btn" />
      </header>
      <main className="quiz-stage">
        {mode === 'hard' ? (
          <p className="pair-q hard">
            {q.ko}
            <small>들려주는 문장은 어느 쪽일까요?</small>
          </p>
        ) : (
          <>
            <div className="pair-target">
              <b>{q.target}</b>
              {ipa && <small>[ {ipa} ]</small>}
            </div>
            <p className="pair-q">어느 쪽이 맞는 발음일까요?</p>
          </>
        )}
        <div className="pair-cards">
          {q.cards.map((c, k) => (
            <button
              key={k}
              className={`pair-cardbtn ${picked !== null || mode === 'hard' ? 'open' : ''} ${picked !== null && k === q.answer ? 'right' : ''} ${picked === k && k !== q.answer ? 'wrong' : ''} ${playing === k && mode !== 'hard' ? 'playing' : ''}`}
              onClick={() => choose(k)}
            >
              {picked === null && mode !== 'hard' ? (
                <span className="card-back" />
              ) : (
                <span className="card-face">
                  <b>{c}</b>
                  {picked !== null && (
                  <span
                    className="say-btn"
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(c, slow);
                    }}
                  >
                    <Icon name="speaker" size={14} /> 발음해보기
                  </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="pair-play">
          <button className={`pair-speaker ${playing !== null ? 'on' : ''}`} onClick={() => playBoth(q)} aria-label="두 카드 듣기">
            <Icon name="speaker" size={46} />
          </button>
        </div>
      </main>
      <div className="pair-foot two">
        <button className="tool-btn" onClick={() => setLecture(true)}>
          <Icon name="play" size={22} />
          <span>강의 보기</span>
        </button>
        <button
          className="tool-btn"
          disabled={picked === null}
          onClick={() => {
            setPicked(null);
            setPlaying(null);
            setI((n) => n + 1);
          }}
        >
          <Icon name="play" size={22} />
          <span>다음 문제</span>
        </button>
      </div>
      {leaving && (
        <div className="modal-dim" onClick={() => setLeaving(false)}>
          <div className="modal leave-modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-title">
              지금 종료하면 현재까지의 학습 내용은
              <br />
              저장되지 않고 사라져요.
            </p>
            <p className="modal-desc">그래도 종료할까요?</p>
            <div className="modal-actions">
              <button className="btn gray" onClick={() => setLeaving(false)}>
                아니요
              </button>
              <button className="btn primary" onClick={() => nav(-1)}>
                네
              </button>
            </div>
          </div>
        </div>
      )}
      {lecture && (
        <div className="modal-dim" onClick={() => setLecture(false)}>
          <div className="opt-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{st.title}</h3>
            <p className="help-text">
              <Bracket text={st.sceneA} />
            </p>
            <p className="help-text">
              <Bracket text={st.sceneB} />
            </p>
            <p className="help-text">{mode === 'hard' ? '문장 하나를 들려줘요. 두 문장 중 들린 쪽을 고르세요.' : '두 카드를 차례로 들려줘요. 1번과 2번 중 위에 보이는 말을 바르게 발음한 카드를 고르세요. 소리 차이에 귀를 기울여 보세요.'}</p>
            <button className="btn primary big" onClick={() => setLecture(false)}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
