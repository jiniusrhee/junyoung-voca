import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SceneArt from '../components/SceneArt';
import SentenceKeyboard from '../components/SentenceKeyboard';
import { db } from '../db';
import { recordModeAnswer } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { canRecognize, recognizeOnce, speak, voiceErrorMessage } from '../lib/speech';
import { currentEpisode, getTalkProgress, gradeLetter, gradeTalk, saveEpisode, unlocked, type TalkGrade, type TalkProgress } from '../lib/talk';
import type { TalkLine, TalkStory } from '../types';

type Stage = 'intro' | 'play' | 'done';

function Stars({ n, big }: { n: number; big?: boolean }) {
  return (
    <span className={`t-stars ${big ? 'big' : ''}`}>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={big ? 30 : 24} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function GradeBadge({ g, size = 40 }: { g?: string; size?: number }) {
  return (
    <span className={`grade-badge g-${g ?? 'none'}`} style={{ width: size, height: size * 1.1, fontSize: size * 0.48 }}>
      {g ?? ''}
    </span>
  );
}

/** 대사 속 단어(점선) — 누르면 영어 표현 */
function KoWords({ line, onPeek }: { line: TalkLine; onPeek: (en: string) => void }) {
  const parts: ReactNode[] = [];
  let rest = line.ko;
  const ws = [...(line.words ?? [])].sort((a, b) => line.ko.indexOf(a.ko) - line.ko.indexOf(b.ko));
  let k = 0;
  for (const w of ws) {
    const i = rest.indexOf(w.ko);
    if (i < 0) continue;
    if (i > 0) parts.push(<span key={k++}>{rest.slice(0, i)}</span>);
    parts.push(
      <button key={k++} className="t-word" onClick={() => onPeek(w.en)}>
        {w.ko}
      </button>,
    );
    rest = rest.slice(i + w.ko.length);
  }
  if (rest) parts.push(<span key={k++}>{rest}</span>);
  return <>{parts}</>;
}

export default function TalkPlay() {
  const { story: sid = '', ep = '0' } = useParams();
  const [params] = useSearchParams();
  const reviewLine = params.get('line');
  const nav = useNavigate();
  const settings = useSettings();
  const story = useLiveQuery(() => db.tstories.get(sid), [sid]);
  const progAll = useLiveQuery(() => getTalkProgress(), []);
  const epIdx = Math.max(0, Number(ep) || 0);
  const episode = story?.episodes[epIdx];
  const meIdx = useMemo(() => (episode ? episode.lines.map((l, i) => (l.who === 'me' ? i : -1)).filter((i) => i >= 0) : []), [episode]);
  const [stage, setStage] = useState<Stage>(reviewLine != null ? 'play' : 'intro');
  const [pos, setPos] = useState(0); // meIdx 안의 위치
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(0); // 0 없음, 1 힌트 표시
  const [grade, setGrade] = useState<TalkGrade | null>(null);
  const [shown, setShown] = useState(false); // 모범 답안으로 넘어감
  const [stars, setStars] = useState<Record<number, number>>({});
  const [peek, setPeek] = useState<string | null>(null);
  const [tip, setTip] = useState(true);
  const [exprCard, setExprCard] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [goalCount, setGoalCount] = useState(0);
  const startedAt = useRef(Date.now());
  const spoke = useRef<string>('');
  const mode = settings?.talkInput ?? 'keyboard';

  useEffect(() => {
    if (reviewLine != null && meIdx.length) {
      const p = meIdx.indexOf(Number(reviewLine));
      if (p >= 0) setPos(p);
    }
  }, [reviewLine, meIdx]);

  const lineIndex = meIdx[pos];
  const line = episode && lineIndex != null ? episode.lines[lineIndex] : null;
  // 내 대사 바로 앞의 상대 대사들
  const npcBefore = useMemo(() => {
    if (!episode || lineIndex == null) return [];
    const out: TalkLine[] = [];
    for (let i = lineIndex - 1; i >= 0 && episode.lines[i].who === 'npc'; i--) out.unshift(episode.lines[i]);
    return out.slice(-2);
  }, [episode, lineIndex]);
  const npcAfterLast = useMemo(() => {
    if (!episode || !meIdx.length) return [];
    return episode.lines.slice(meIdx[meIdx.length - 1] + 1).filter((l) => l.who === 'npc');
  }, [episode, meIdx]);

  useEffect(() => {
    if (stage !== 'play' || !npcBefore.length || grade) return;
    const key = `${lineIndex}`;
    if (spoke.current === key) return;
    spoke.current = key;
    const say = (i: number) => {
      if (i >= npcBefore.length) return;
      speak(npcBefore[i].en ?? '', settings?.speechRate === 'slow', 1, () => say(i + 1));
    };
    window.setTimeout(() => say(0), 300);
  }, [stage, npcBefore, lineIndex, grade, settings?.speechRate]);

  if (!settings || story === undefined || progAll === undefined) return <div className="quiz-screen center" />;
  if (!story || !episode) {
    return (
      <div className="quiz-screen center col gap">
        <p className="quiz-msg">에피소드를 찾을 수 없어요</p>
        <button className="btn primary" onClick={() => nav('/talk')}>
          돌아가기
        </button>
      </div>
    );
  }
  const prog = progAll[episode.id] ?? {};
  const total = meIdx.length;
  const doneCount = Object.keys(stars).length;
  const avg = doneCount ? Object.values(stars).reduce((a, b) => a + b, 0) / doneCount : 0;
  const level = settings.talkLevel;

  const begin = (resume: boolean) => {
    const at = resume && prog.at != null ? Math.min(prog.at, total - 1) : 0;
    setPos(at);
    setStars(resume ? (prog.stars as Record<number, number>) ?? {} : {});
    setStage('play');
    resetTurn();
  };

  const resetTurn = () => {
    setInput('');
    setHint(0);
    setGrade(null);
    setShown(false);
    setPeek(null);
    setVoiceMsg(null);
    startedAt.current = Date.now();
  };

  const record = async (g: TalkGrade) => {
    if (lineIndex == null) return;
    const next = { ...stars, [lineIndex]: g.stars };
    setStars(next);
    const res = await recordModeAnswer(
      'talk',
      `${episode.id}:${lineIndex}`,
      { clean: g.stars === 3, wrong: g.stars >= 2 ? 0 : 1, failed: g.stars === 0, elapsedMs: Date.now() - startedAt.current },
      settings.talkGoal,
    );
    setGoalCount(res.total);
    if (reviewLine == null) await saveEpisode(episode.id, { stars: { ...(prog.stars ?? {}), ...next }, at: pos + 1 });
  };

  const submit = (text = input) => {
    if (!line || !text.trim() || grade) return;
    const g = gradeTalk(text, line, level);
    setInput(text);
    setGrade(g);
    void record(g);
  };

  const showModel = () => {
    if (!line) return;
    const g: TalkGrade = { stars: 0, label: 'Nice Try!', tone: 'red', feedback: line.hint ?? '', similarity: 0 };
    setShown(true);
    setHint(1);
    setGrade(g);
    void record(g);
  };

  const retry = () => {
    if (!line || lineIndex == null) return;
    const s = { ...stars };
    delete s[lineIndex];
    setStars(s);
    resetTurn();
  };

  const finishEpisode = async () => {
    const vals = Object.values(stars);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    const g = gradeLetter(a);
    const order = ['C', 'B', 'A', 'S'];
    const best = prog.grade && order.indexOf(prog.grade) > order.indexOf(g) ? prog.grade : g;
    await saveEpisode(episode.id, { done: true, grade: best, at: 0, stars });
    setStage('done');
  };

  const nextLine = () => {
    window.speechSynthesis?.cancel?.();
    if (reviewLine != null) {
      nav('/talk', { replace: true });
      return;
    }
    if (pos + 1 >= total) {
      if (npcAfterLast.length) speak(npcAfterLast.map((l) => l.en).join(' '), settings.speechRate === 'slow');
      void finishEpisode();
      return;
    }
    setPos(pos + 1);
    resetTurn();
  };

  const afterAnswer = () => {
    if (line?.expr && !exprCard) {
      setExprCard(true);
      return;
    }
    setExprCard(false);
    nextLine();
  };

  const voiceAnswer = async () => {
    if (listening || grade) return;
    setVoiceMsg(null);
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = alts.reduce((b, a) => (line && gradeTalk(a, line, level).similarity > gradeTalk(b, line, level).similarity ? a : b), alts[0] ?? '');
      submit(best.charAt(0).toUpperCase() + best.slice(1));
    } catch (e) {
      setVoiceMsg(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  const top = (
    <header className="talk-top">
      <button className="icon-btn light" onClick={() => (stage === 'play' && reviewLine == null ? setStage('intro') : nav('/talk'))} aria-label="나가기">
        <Icon name="back" size={24} />
      </button>
      <div className="talk-progress">
        <span className="trophy-badge purple">
          <Icon name="trophy" size={18} />
        </span>
        <div className="progress-track">
          <div className="progress-fill purple" style={{ width: `${Math.max(8, (doneCount / Math.max(1, total)) * 100)}%` }} />
        </div>
        {doneCount > 0 && <GradeBadge g={gradeLetter(avg)} size={26} />}
      </div>
      <button className="icon-btn light" onClick={() => nav('/settings/vocab')} aria-label="설정">
        <Icon name="gear" size={24} />
      </button>
    </header>
  );

  if (stage === 'intro') {
    const p = progAll;
    return (
      <div className="talk-screen">
        <SceneArt scene={story.scene} />
        <header className="talk-intro-head">
          <button className="vs-back light" onClick={() => nav('/talk')}>
            <Icon name="back" size={22} /> {story.title}
          </button>
          <button className="level-chip" onClick={() => nav('/talk/level')}>
            <Icon name="gear" size={16} /> 난이도 · {level}
          </button>
        </header>
        <div className="talk-ep-progress">
          <div className="ep-bar">
            <i style={{ width: `${((epIdx + 1) / story.episodes.length) * 100}%` }} />
          </div>
          <span>
            {epIdx + 1}/{story.episodes.length}
          </span>
          <button className="ep-all" onClick={() => setSheet(true)}>
            전체 에피소드 보기
          </button>
        </div>
        <div className="talk-mission">
          <p className="ep-name">
            Episode {epIdx + 1} · {episode.title}
          </p>
          <p>{episode.mission}</p>
          <p className="ep-partner">대화 상대: {episode.partner}</p>
        </div>
        <div className="talk-intro-actions">
          {prog.at && !prog.done ? (
            <>
              <button className="btn gray big" onClick={() => begin(false)}>
                처음부터 하기
              </button>
              <button className="btn primary big" onClick={() => begin(true)}>
                이어서 하기
              </button>
            </>
          ) : (
            <button className="btn primary big" onClick={() => begin(false)}>
              시작하기
            </button>
          )}
        </div>
        {sheet && <EpisodeSheet story={story} prog={p} current={epIdx} onClose={() => setSheet(false)} onPick={(i) => nav(`/talk/${story.id}/${i}`, { replace: true })} />}
      </div>
    );
  }

  if (stage === 'done') {
    const vals = Object.values(stars);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    const hasNext = epIdx + 1 < story.episodes.length;
    return (
      <div className="talk-screen">
        <SceneArt scene={story.scene} dim />
        <div className="talk-done">
          <GradeBadge g={gradeLetter(a)} size={96} />
          <p className="done-title">에피소드 완료!</p>
          <p className="done-sub">
            {episode.title} · 평균 별 {a.toFixed(1)}개
          </p>
          <div className="done-lines">
            {meIdx.map((li) => (
              <div key={li} className="done-line">
                <span>{episode.lines[li].ko}</span>
                <Stars n={stars[li] ?? 0} />
              </div>
            ))}
          </div>
          <div className="talk-intro-actions">
            <button className="btn gray big" onClick={() => nav('/talk')}>
              목록으로
            </button>
            {hasNext && (
              <button
                className="btn primary big"
                onClick={() => {
                  nav(`/talk/${story.id}/${epIdx + 1}`, { replace: true });
                  setStage('intro');
                  setStars({});
                }}
              >
                다음 에피소드
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!line) return null;
  return (
    <div className="talk-screen play">
      <SceneArt scene={story.scene} />
      {top}
      {goalCount > 0 && goalCount === settings.talkGoal && <div className="toast">오늘 목표 {settings.talkGoal}문장 달성! 🏆</div>}
      <div className="talk-stack">
        {npcBefore.map((n, i) => (
          <div key={i} className="npc-bubble">
            <div className="npc-en">
              <span>{n.en}</span>
              <button className="icon-btn small light" onClick={() => speak(n.en ?? '', settings.speechRate === 'slow')} aria-label="듣기">
                <Icon name="speaker" size={20} />
              </button>
            </div>
            <p className="npc-ko">{n.ko}</p>
          </div>
        ))}
        <div className={`me-panel ${grade ? 'graded' : ''}`}>
          {grade && <span className={`t-label ${grade.stars >= 3 ? 'perfect' : grade.stars === 0 ? 'nice' : 'mid'}`}>{grade.label}</span>}
          <Stars n={grade ? grade.stars : 0} />
          {tip && !grade && (line.words?.length ?? 0) > 0 && (
            <button className="t-tip" onClick={() => setTip(false)}>
              단어를 누르면 영어표현을 확인할 수 있어요
            </button>
          )}
          <p className="me-ko">
            <KoWords
              line={line}
              onPeek={(en) => {
                setPeek(en);
                setTip(false);
              }}
            />
          </p>
          {peek && !grade && (
            <button className="t-peek" onClick={() => setPeek(null)}>
              {peek}
            </button>
          )}
          {(hint > 0 || (grade && shown)) && <div className="t-box hint">{line.hint}</div>}
          {grade && !shown && <div className={`t-box ${grade.tone}`}>{grade.feedback}</div>}
          {voiceMsg && !grade && <div className="t-box red">{voiceMsg}</div>}
          {(input || grade) && !shown && <p className="me-input">{input}</p>}
          {grade && (
            <div className="model">
              <span className="note-tag alt">모범 답안</span>
              <p>{line.answer}</p>
            </div>
          )}
        </div>
      </div>

      {grade ? (
        <div className="talk-actions">
          <button onClick={() => speak(line.answer ?? '', settings.speechRate === 'slow')}>
            <Icon name="check" size={26} />
            <span>모범 답안 듣기</span>
          </button>
          <button onClick={retry}>
            <Icon name="retry" size={26} />
            <span>재도전</span>
          </button>
          <button onClick={afterAnswer}>
            <Icon name="play" size={26} />
            <span>{reviewLine != null ? '완료' : pos + 1 >= total ? '결과 보기' : '다음 문제'}</span>
          </button>
        </div>
      ) : mode === 'voice' ? (
        <div className="talk-voice">
          <button className="tool-btn light" onClick={() => (hint ? showModel() : setHint(1))}>
            <Icon name={hint ? 'check' : 'question'} size={26} />
            <span>{hint ? '모범 답안' : '힌트 보기'}</span>
          </button>
          <button className={`talk-mic ${listening ? 'listening' : ''}`} onClick={() => void voiceAnswer()} disabled={!canRecognize()} aria-label="말하기">
            {listening ? <span className="stop-square" /> : <Icon name="mic" size={34} />}
          </button>
          <button className="tool-btn light" onClick={() => void saveSettings({ talkInput: 'keyboard' })}>
            <Icon name="keyboard" size={26} />
            <span>키보드 모드</span>
          </button>
        </div>
      ) : (
        <div className="quiz-input talk-kb">
          <div className="toolbar two">
            <button className="tool-btn row" onClick={() => (hint ? showModel() : setHint(1))}>
              <Icon name={hint ? 'check' : 'question'} size={22} className="ic-purple" />
              <span>{hint ? '모범 답안' : '힌트 보기'}</span>
            </button>
            <button className="tool-btn row" onClick={() => void saveSettings({ talkInput: 'voice' })} disabled={!canRecognize()}>
              <Icon name="mic" size={22} className="ic-purple" />
              <span>음성 모드</span>
            </button>
          </div>
          <SentenceKeyboard value={input} onChange={setInput} onEnter={() => submit()} />
        </div>
      )}

      {exprCard && line.expr && (
        <div className="modal-dim">
          <div className="expr-card">
            <div className="expr-card-head">
              <b>{line.expr.en}</b>
              <span>{line.expr.ko}</span>
            </div>
            <p>{line.expr.note}</p>
            <p className="expr-ask">어휘 학습에 추가하시겠어요?</p>
            <div className="expr-card-actions">
              <button onClick={afterAnswer}>괜찮아요</button>
              <button
                onClick={async () => {
                  const cur = ((await db.kv.get('myExpressions'))?.value as { en: string; ko: string; note: string }[] | undefined) ?? [];
                  if (!cur.some((c) => c.en === line.expr!.en)) await db.kv.put({ key: 'myExpressions', value: [line.expr, ...cur] });
                  afterAnswer();
                }}
              >
                좋아요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function EpisodeSheet({ story, prog, current, onClose, onPick }: { story: TalkStory; prog: TalkProgress; current: number; onClose: () => void; onPick: (i: number) => void }) {
  const cur = currentEpisode(story, prog);
  return (
    <div className="modal-dim" onClick={onClose}>
      <div className="ep-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="extra-head">
          <span>{story.title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="ep-list">
          {story.episodes.map((e, i) => {
            const p = prog[e.id];
            const open = unlocked(story, prog, i);
            const isCur = i === (current ?? cur);
            return (
              <div key={e.id} className={`ep-row ${isCur ? 'cur' : ''} ${open ? '' : 'locked'}`}>
                <span className={`ep-dot ${p?.done ? 'done' : isCur ? 'now' : ''}`}>{p?.done ? <Icon name="check" size={14} /> : isCur ? <Icon name="play" size={12} /> : open ? '' : <Icon name="lock" size={14} />}</span>
                <div className="ep-text">
                  <small>Episode {i + 1}</small>
                  <b>{e.title}</b>
                  {isCur && open && (
                    <button className="btn primary ep-start" onClick={() => onPick(i)}>
                      <Icon name="book" size={16} /> 학습 시작
                    </button>
                  )}
                </div>
                {p?.grade ? <GradeBadge g={p.grade} size={34} /> : open && !isCur ? <button className="ep-go" onClick={() => onPick(i)}>›</button> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
