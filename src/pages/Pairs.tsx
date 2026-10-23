import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { Backdrop } from '../components/StudyChrome';
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

const QUESTIONS = 10;
const PASS = 8;

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
                            <span>{sc[m] != null ? `${sc[m]}/${QUESTIONS}` : '--'}</span>
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
  /** 들려줄 쪽 0=a, 1=b */
  answer: 0 | 1;
  options: [string, string];
  speakText: string;
  ko?: string;
}

function buildQuestions(st: Stage, mode: 'easy' | 'hard'): PairQ[] {
  const out: PairQ[] = [];
  for (let i = 0; i < QUESTIONS; i++) {
    const answer = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
    if (mode === 'easy') {
      const p = st.easy[i % st.easy.length];
      out.push({ answer, options: [p[0], p[1]], speakText: p[answer] });
    } else {
      const h = st.hard[i % st.hard.length];
      out.push({ answer, options: [h.a, h.b], speakText: answer === 0 ? h.a : h.b, ko: h.ko });
    }
  }
  return out.sort(() => Math.random() - 0.5);
}

export function PairQuiz() {
  const { stage = '', mode = 'easy' } = useParams();
  const nav = useNavigate();
  const settings = useSettings();
  const data = usePairs();
  const st = useMemo(() => data?.levels.flatMap((l) => l.stages).find((s) => s.id === stage), [data, stage]);
  const [qs, setQs] = useState<PairQ[]>([]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const saved = useRef(false);

  useEffect(() => {
    if (st && !qs.length) setQs(buildQuestions(st, mode === 'hard' ? 'hard' : 'easy'));
  }, [st, mode, qs.length]);
  useEffect(() => {
    if (qs[i] && picked === null) {
      const t = window.setTimeout(() => speak(qs[i].speakText, mode === 'hard' ? false : true), 300);
      return () => window.clearTimeout(t);
    }
  }, [qs, i, picked, mode]);

  const finished = i >= QUESTIONS;
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
    return (
      <div className="result-screen">
        <Mascot size={120} mood={score >= PASS ? 'cheer' : 'happy'} />
        <p className="result-sub">
          {st.a} vs {st.b} · {mode.toUpperCase()}
        </p>
        <p className="result-level">
          {score}/{QUESTIONS}
        </p>
        <p className="result-desc">{score >= PASS ? '훌륭해요! 이 소리는 이제 잘 구분하네요.' : '조금만 더 연습해 봐요. 소리에 귀를 기울여 보세요.'}</p>
        <button className="btn primary big" onClick={() => nav(-1)}>
          완료
        </button>
      </div>
    );
  }

  const q = qs[i];
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.answer) setScore((s) => s + 1);
  };

  return (
    <div className="quiz-screen pair-quiz">
      <Backdrop theme={settings.studyTheme} />
      <header className="quiz-top">
        <button className="icon-btn light" onClick={() => nav(-1)} aria-label="나가기">
          <Icon name="back" size={24} />
        </button>
        <div className="quiz-progress">
          <div className="progress-track" style={{ marginLeft: 0 }}>
            <div className="progress-fill" style={{ width: `${Math.max((i / QUESTIONS) * 100, 14)}%` }}>
              <span>
                {i}/{QUESTIONS}
              </span>
            </div>
          </div>
        </div>
        <span className="icon-btn" />
      </header>
      <main className="quiz-stage">
        <div className="qcard pair-card">
          <div className="qcard-top">
            <p className="pair-q">
              <b>{st.a}</b> vs <b>{st.b}</b> 어느 쪽이 들렸나요?
            </p>
            {q.ko && picked !== null && <p className="note left">{q.ko}</p>}
          </div>
          <div className="pair-play">
            <button className="pair-speaker" onClick={() => speak(q.speakText, mode !== 'hard')} aria-label="다시 듣기">
              <Icon name="speaker" size={46} />
            </button>
          </div>
          <div className="pair-options">
            {q.options.map((o, k) => (
              <button
                key={k}
                className={`pair-opt ${picked !== null && k === q.answer ? 'right' : ''} ${picked === k && k !== q.answer ? 'wrong' : ''}`}
                onClick={() => choose(k)}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </main>
      <div className="pair-foot">
        {picked !== null ? (
          <button
            className="btn primary big"
            onClick={() => {
              setPicked(null);
              setI((n) => n + 1);
            }}
          >
            {picked === q.answer ? '정답! 다음' : '다음'}
          </button>
        ) : (
          <button className="btn line big" onClick={() => speak(q.speakText, mode !== 'hard', 0.8)}>
            천천히 듣기
          </button>
        )}
      </div>
    </div>
  );
}
