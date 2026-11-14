import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import KoText from '../components/KoText';
import { QBack, QGear, QKeyboard, QTrophy } from '../components/QuizIcons';
import SceneArt, { sceneOf } from '../components/SceneArt';
import SentenceKeyboard from '../components/SentenceKeyboard';
import { GradeBadge, TalkStar, TkChat, TkDone, TkHint, TkMark, TkMic, TkModel, TkModelSmall, TkNext, TkRetry, TkSpeaker } from '../components/TalkBits';
import { db } from '../db';
import { recordModeAnswer } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { sfx } from '../lib/sfx';
import { canRecognize, recognizeOnce, speak, stopSpeaking, voiceErrorMessage } from '../lib/speech';
import { useNavBarColor, useStatusBarColor } from '../lib/statusBar';
import { currentEpisode, getTalkProgress, getTalkReviewMarks, gradeLetter, gradeTalk, saveEpisode, toggleTalkReview, unlocked, type TalkGrade, type TalkProgress } from '../lib/talk';
import type { TalkLine, TalkStory } from '../types';

export { GradeBadge } from '../components/TalkBits';

type Stage = 'intro' | 'play' | 'done';

/** 내가 할 말: 낱말 덩어리마다 점선 밑줄 — 누르면 그 덩어리의 영어 표현 */
function KoWords({ line, peek, onPeek }: { line: TalkLine; peek: string | null; onPeek: (ko: string, en: string, el: HTMLElement) => void }) {
  const parts: ReactNode[] = [];
  let rest = line.ko;
  const ws = [...(line.words ?? [])].filter((w) => line.ko.includes(w.ko)).sort((a, b) => line.ko.indexOf(a.ko) - line.ko.indexOf(b.ko));
  let k = 0;
  for (const w of ws) {
    const i = rest.indexOf(w.ko);
    if (i < 0) continue;
    if (i > 0) parts.push(<KoText key={k++} text={rest.slice(0, i)} />);
    parts.push(
      <button key={k++} className={`tk-word${peek === w.ko ? ' on' : ''}`} onClick={(e) => onPeek(w.ko, w.en, e.currentTarget)}>
        <KoText text={w.ko} />
      </button>,
    );
    rest = rest.slice(i + w.ko.length);
  }
  if (rest) parts.push(<KoText key={k++} text={rest} />);
  return <>{parts}</>;
}

/**
 * 실전 회화 — 말해보카 플립 실측(2026-11-14)으로 다시 만듦 (수치는 docs/SPEC.md 맨 끝 "실전 회화" 절, 스타일은 styles/talk.css).
 *
 * 시작 화면: 장면 그림 위에 스토리 제목 · 난이도, 에피소드 진행 막대 · '전체 에피소드 보기', 가운데 아래 미션 글, '시작하기'.
 * 대화: 장면이 조금 다가오고, 아래에서부터 [상대 말풍선] [내 칸(할 말 · 힌트 · 내가 친 글)] [도구 알약 + 문장 자판]이 쌓인다.
 *   내 칸의 오른쪽 위에 별 셋. 한국어의 점선 덩어리를 누르면 영어 표현이 뜬다. '힌트 보기' → 보라 상자, 단추는 '모범 답안'으로.
 * 채점: 자판이 내려가고 내 칸이 아래로 내려앉으며(아래 끝 고정) 등급 글자 · 별 · 설명 상자 · 내 답 · 점선 · '모범 답안'이 보인다.
 *   상대 말풍선은 작은 알약으로 접힌다. 아래에는 보라 동작 막대(모범 답안 듣기 · 복습에 추가 · 재도전 · 다음 문제).
 *   재도전: 자판이 다시 올라오고, 앞서 친 글이 남아 있어 이어서 고친다.
 * 머리줄 막대: 얻은 별만큼 보라색이 차고, 잃은 별만큼 막대 자체가 오른쪽에서 줄어든다(다음 문제로 넘어갈 때).
 * 채점은 AI 없이 핵심 표현 + 낱말 겹침으로 한다(lib/talk.ts).
 */
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
  const [hint, setHint] = useState(false);
  const [grade, setGrade] = useState<TalkGrade | null>(null);
  /** 모범 답안으로 넘어갔다 (설명 상자 자리에 힌트가 남는다) */
  const [shown, setShown] = useState(false);
  /** 재도전 중: 결과는 그대로 보이고 자판으로 다시 고친다 */
  const [retrying, setRetrying] = useState(false);
  const [stars, setStars] = useState<Record<number, number>>({});
  /** 머리줄 막대에서 줄어든 별 수 (다음 문제로 넘어갈 때 반영) */
  const [lost, setLost] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [openAns, setOpenAns] = useState<number | null>(null);
  const reviewMarks = useLiveQuery(() => getTalkReviewMarks(), []);
  const [peek, setPeek] = useState<{ ko: string; en: string; x: number } | null>(null);
  /** '단어를 누르면 영어표현을 확인할 수 있어요' — 한 번 닫거나 낱말을 눌러 보면 다시 뜨지 않는다 */
  const [wordTip, setWordTip] = useState(() => {
    try {
      return localStorage.getItem('talkWordTip') !== '1';
    } catch {
      return true;
    }
  });
  const dismissWordTip = () => {
    setWordTip(false);
    try {
      localStorage.setItem('talkWordTip', '1');
    } catch {
      /* 저장 못 해도 이번에는 닫힌다 */
    }
  };
  /** 음성 모드의 '마이크 버튼을 눌러 말해 보세요' — 턴마다, 마이크를 누르기 전까지 */
  const [micTip, setMicTip] = useState(true);
  const [npcOpen, setNpcOpen] = useState(false);
  const [exprCard, setExprCard] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [listening, setListening] = useState(false);
  /** 음성으로 알아들은 말이 입력 줄에 들어가 있다 → 마이크 자리의 단추가 '제출' */
  const [heard, setHeard] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [starPop, setStarPop] = useState(0);
  const [entering, setEntering] = useState(false);
  const [leavingIntro, setLeavingIntro] = useState(false);
  const startedAt = useRef(Date.now());
  const spoke = useRef<string>('');
  const meRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const mode = settings?.talkInput === 'voice' && canRecognize() ? 'voice' : 'keyboard';

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
    later(() => setToast((t) => (t === msg ? null : t)), 2400);
  };

  useEffect(() => {
    if (reviewLine != null && meIdx.length) {
      const p = meIdx.indexOf(Number(reviewLine));
      if (p >= 0) setPos(p);
    }
  }, [reviewLine, meIdx]);

  const lineIndex = meIdx[pos];
  const line = episode && lineIndex != null ? episode.lines[lineIndex] : null;
  // 내 대사 바로 앞의 상대 대사들 (말풍선 하나에 이어서 보여 준다)
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
  const npcEn = npcBefore.map((n) => n.en ?? '').join(' ');
  const npcKo = npcBefore.map((n) => n.ko).join(' ');
  const graded = !!grade && !retrying;

  // 시스템 막대: 실제 앱은 장면 그림이 막대 뒤까지 이어진다. 우리 웹뷰는 막대 사이에 있으므로 그림의 맨 위 · 맨 아래 색으로 칠한다
  const sc = sceneOf(story?.scene ?? 'street');
  const lum = (hex: string) => (parseInt(hex.slice(1, 3), 16) * 299 + parseInt(hex.slice(3, 5), 16) * 587 + parseInt(hex.slice(5, 7), 16) * 114) / 1000;
  // 전체 에피소드 판이 떠 있는 동안에는 뒤가 어두워지므로 상태바도 어둡게
  const dimmed = (hex: string) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.45).toString(16).padStart(2, '0')).join('')}`;
  useStatusBarColor(stage === 'done' ? '#111111' : sheet ? dimmed(sc.sky[0]) : sc.sky[0], stage === 'done' || sheet || lum(sc.sky[0]) < 140);
  // 시작 화면은 아래쪽이 어둡게 덮여 있으므로(검정 50%) 바닥 색도 그만큼 어둡게.
  // 자료를 읽기 전에는 건드리지 않는다 — App 의 기본 색 칠하기가 이 화면의 첫 칠보다 늦게 돌아 덮어쓰기 때문
  const half = (hex: string) => `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) / 2).toString(16).padStart(2, '0')).join('')}`;
  useNavBarColor(!story || !settings ? null : stage === 'done' ? '#111111' : stage === 'intro' ? half(sc.ground) : !graded && mode === 'keyboard' ? '#2b2b2b' : sc.ground);

  // 상대의 말을 들려준다 (새 턴이 뜰 때 한 번)
  useEffect(() => {
    if (stage !== 'play' || !npcEn || grade) return;
    const key = `${lineIndex}`;
    if (spoke.current === key) return;
    spoke.current = key;
    const t = window.setTimeout(() => speak(npcEn, settings?.speechRate === 'slow'), 350);
    return () => window.clearTimeout(t);
  }, [stage, npcEn, lineIndex, grade, settings?.speechRate]);

  if (!settings || story === undefined || progAll === undefined) return <div className="talk2 tk-loading" />;
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
  const level = settings.talkLevel;
  const maxStars = Math.max(1, total * 3);
  const earned = Object.values(stars).reduce((a, b) => a + b, 0);

  const resetTurn = () => {
    setInput('');
    setHint(false);
    setGrade(null);
    setShown(false);
    setRetrying(false);
    setPeek(null);
    setNpcOpen(false);
    setStarPop(0);
    setHeard(false);
    setMicTip(true);
    startedAt.current = Date.now();
  };

  const begin = (resume: boolean) => {
    const at = resume && prog.at != null ? Math.min(prog.at, total - 1) : 0;
    const kept = resume ? ((prog.stars as Record<number, number>) ?? {}) : {};
    setPos(at);
    setStars(kept);
    // 이어서 할 때: 앞서 끝낸 턴에서 잃은 별만큼 막대가 줄어 있다
    setLost(meIdx.slice(0, at).reduce((a, li) => a + (3 - (kept[li] ?? 0)), 0));
    resetTurn();
    // 시작 화면의 글과 단추가 사라지고(0.2초) 장면이 다가오며 대화 칸이 올라온다
    setLeavingIntro(true);
    later(() => {
      setLeavingIntro(false);
      setStage('play');
      setEntering(true);
      later(() => setEntering(false), 420);
    }, 220);
  };

  const record = async (g: TalkGrade) => {
    if (lineIndex == null) return;
    // 재도전으로 등급이 내려가지는 않는다
    const best = Math.max(g.stars, stars[lineIndex] ?? 0);
    const next = { ...stars, [lineIndex]: best };
    setStars(next);
    const res = await recordModeAnswer(
      'talk',
      `${episode.id}:${lineIndex}`,
      { clean: g.stars === 3, wrong: g.stars >= 2 ? 0 : 1, failed: g.stars === 0, elapsedMs: Date.now() - startedAt.current },
      settings.talkGoal,
    );
    if (res.metNow) showToast(`오늘 목표 ${settings.talkGoal}문장 달성! 🏆`);
    if (reviewLine == null) await saveEpisode(episode.id, { stars: { ...(prog.stars ?? {}), ...next }, at: pos + 1 });
  };

  const showResult = (g: TalkGrade) => {
    setGrade(g);
    setRetrying(false);
    setPeek(null);
    setNpcOpen(false);
    setStarPop(0);
    if (g.stars > 0) sfx('correct');
    // 별이 하나씩 켜진다 (0.13초 간격)
    for (let i = 1; i <= g.stars; i++) later(() => setStarPop(i), 140 + i * 130);
    void record(g);
  };

  const submit = (text = input) => {
    if (!line || !text.trim() || graded) return;
    stopSpeaking();
    const g = gradeTalk(text, line, level);
    setInput(text);
    setShown(false);
    if (lineIndex != null) setAnswers((m) => ({ ...m, [lineIndex]: text }));
    showResult(g);
  };

  const showModel = () => {
    if (!line || graded) return;
    stopSpeaking();
    setShown(true);
    setHint(true);
    showResult({ stars: 0, label: 'Nice Try!', tone: 'nice', feedback: line.hint ?? '', similarity: 0 });
  };

  /** 재도전: 자판이 다시 올라온다. 앞서 친 글은 그대로 남아 이어서 고친다 (플립 실측) */
  const retry = () => {
    if (!line || lineIndex == null) return;
    stopSpeaking();
    setRetrying(true);
    setHeard(false);
    startedAt.current = Date.now();
  };

  const finishEpisode = async () => {
    const vals = meIdx.map((li) => stars[li] ?? 0);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    const g = gradeLetter(a);
    const order = ['C', 'B', 'A', 'S'];
    const best = prog.grade && order.indexOf(prog.grade) > order.indexOf(g) ? prog.grade : g;
    await saveEpisode(episode.id, { done: true, grade: best, at: 0, stars });
    setStage('done');
  };

  const nextLine = () => {
    stopSpeaking();
    if (reviewLine != null) {
      nav('/talk', { replace: true });
      return;
    }
    // 이 턴에서 잃은 별만큼 막대가 줄어든다
    if (lineIndex != null) setLost((n) => n + (3 - (stars[lineIndex] ?? 0)));
    if (pos + 1 >= total) {
      if (npcAfterLast.length) speak(npcAfterLast.map((l) => l.en).join(' '), settings.speechRate === 'slow');
      void finishEpisode();
      return;
    }
    setPos(pos + 1);
    resetTurn();
    setEntering(true);
    later(() => setEntering(false), 420);
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
    if (listening || graded) return;
    stopSpeaking();
    setListening(true);
    try {
      const alts = await recognizeOnce();
      const best = alts.reduce((b, a) => (line && gradeTalk(a, line, level).similarity > gradeTalk(b, line, level).similarity ? a : b), alts[0] ?? '');
      // 알아들은 말이 입력 칸에 들어간다. 마이크를 한 번 더 누르면 제출 (말해보카: '누르면 입력한 답안이 제출돼요')
      if (best) {
        setInput(best.charAt(0).toUpperCase() + best.slice(1));
        setHeard(true);
      }
    } catch (e) {
      if (!(e instanceof Error && (e.message === 'aborted' || e.message === 'no-speech'))) showToast(voiceErrorMessage(e));
    } finally {
      setListening(false);
    }
  };

  /* ---------- 시작 화면 ---------- */
  if (stage === 'intro') {
    return (
      <div className={`talk2 tk-intro${leavingIntro ? ' leaving' : ''}`}>
        <SceneArt scene={story.scene} />
        <div className="tk-shade" />
        <header className="tk-ihead">
          <button className="tk-iback" onClick={() => nav('/talk')}>
            <QBack />
            <span>
              <KoText text={story.title} />
            </span>
          </button>
          <button className="tk-level" onClick={() => nav('/talk/level')}>
            <QGear />
            <span>
              난이도 · <i lang="en">{level}</i>
            </span>
          </button>
        </header>
        <div className="tk-epbar">
          <div className="tk-epbar-track">
            <i style={{ width: `${((epIdx + 1) / story.episodes.length) * 100}%` }} />
          </div>
          <span lang="en">
            {epIdx + 1}/{story.episodes.length}
          </span>
          <button className="tk-epall" onClick={() => setSheet(true)}>
            전체 에피소드 보기
          </button>
        </div>
        <p className="tk-mission">
          <KoText text={episode.mission} />
        </p>
        <div className="tk-istart">
          {prog.at && !prog.done ? (
            <>
              <button className="tk-btn gray" onClick={() => begin(false)}>
                처음부터 하기
              </button>
              <button className="tk-btn" onClick={() => begin(true)}>
                이어서 하기
              </button>
            </>
          ) : (
            <button className="tk-btn" onClick={() => begin(false)}>
              시작하기
            </button>
          )}
        </div>
        {sheet && <EpisodeSheet story={story} prog={progAll} current={epIdx} onClose={() => setSheet(false)} onPick={(i) => nav(`/talk/${story.id}/${i}`, { replace: true })} />}
      </div>
    );
  }

  /* ---------- 결과 화면 ---------- */
  if (stage === 'done') {
    const vals = meIdx.map((li) => stars[li] ?? 0);
    const a = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
    const g = gradeLetter(a);
    const hasNext = epIdx + 1 < story.episodes.length;
    const comment =
      g === 'S'
        ? '모든 문장을 자연스럽게 말했어요. 이 상황은 이제 실전에서도 문제없겠어요!'
        : g === 'A'
          ? '핵심 표현을 잘 살렸어요. 몇 문장만 더 다듬으면 완벽해요!'
          : g === 'B'
            ? '뜻은 잘 전달됐어요. 모범 답안과 견주며 표현을 익혀 보세요.'
            : '포기하지 않고 끝까지 해냈어요. 복습에 추가해서 한 번 더 말해 보세요!';
    return (
      <div className="talk2 tk-done">
        <div className="tk-dscroll">
          <section className={`tk-dcard tk-dhero g-${g}`}>
            <div className="tk-drays" />
            <span className="tk-dbadge">
              <GradeBadge g={g} size={64} />
            </span>
            <h2>
              <KoText text={`${episode.title} 완료!`} />
            </h2>
            <p>
              <KoText text={comment} />
            </p>
          </section>
          <section className="tk-dcard tk-dscript">
            <i className="tk-dring l" />
            <i className="tk-dring r" />
            <h3>대화 스크립트</h3>
            {episode.lines.map((l, li) =>
              l.who === 'npc' ? (
                <div key={li} className="tk-dnpc">
                  <p lang="en">{l.en}</p>
                  <small>
                    <KoText text={l.ko} />
                  </small>
                </div>
              ) : (
                <div key={li} className="tk-dme-wrap">
                  <div className="tk-dme" onClick={() => setOpenAns((o) => (o === li ? null : li))}>
                    <p lang="en">{l.answer}</p>
                    <small>
                      <KoText text={l.ko} />
                    </small>
                    {openAns === li && (
                      <p className="tk-dmine" lang="en">
                        <b lang="ko">내 답안</b>
                        {answers[li] || '—'}
                      </p>
                    )}
                  </div>
                  <label className="tk-dreview">
                    복습에 추가하기
                    <input type="checkbox" checked={reviewMarks?.includes(`${episode.id}:${li}`) ?? false} onChange={() => void toggleTalkReview(`${episode.id}:${li}`)} />
                    <span className="tk-toggle" />
                  </label>
                </div>
              ),
            )}
          </section>
        </div>
        <div className="tk-dfoot">
          <button
            className="tk-btn"
            onClick={() => {
              if (hasNext) {
                nav(`/talk/${story.id}/${epIdx + 1}`, { replace: true });
                setStage('intro');
                setStars({});
                setAnswers({});
                setLost(0);
                setPos(0);
              } else nav('/talk');
            }}
          >
            학습 완료
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 대화 ---------- */
  if (!line) return null;
  const marked = reviewMarks?.includes(`${episode.id}:${lineIndex}`) ?? false;
  const shownStars = graded || retrying ? (grade ? Math.min(grade.stars, graded ? starPop : grade.stars) : 0) : 0;
  const showBox = hint && (!grade || shown);
  const last = pos + 1 >= total;
  const trackT = Math.max(0, (maxStars - lost) / maxStars);
  const fillT = earned / maxStars;
  const typing = !graded;
  const onPeek = (ko: string, en: string, el: HTMLElement) => {
    dismissWordTip();
    if (peek?.ko === ko) {
      setPeek(null);
      return;
    }
    const base = meRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPeek({ ko, en, x: r.left + r.width / 2 - (base?.left ?? 0) });
  };

  return (
    <div className={`talk2 tk-play tk-${mode}${graded ? ' graded' : ''}${entering ? ' entering' : ''}`} onClick={() => peek && setPeek(null)}>
      <SceneArt scene={story.scene} />
      <header className="tk-top">
        <button className="tk-back" onClick={() => (reviewLine == null ? setStage('intro') : nav('/talk'))} aria-label="나가기">
          <QBack />
        </button>
        <div className="tk-prog" style={{ '--t': trackT, '--f': fillT } as CSSProperties}>
          <div className="tk-track">{earned > 0 && <i className="tk-fill" />}</div>
          <span className="tk-disc">
            <QTrophy />
          </span>
        </div>
        <button className="tk-gear" onClick={() => nav('/settings/mode/talk')} aria-label="설정">
          <QGear />
        </button>
      </header>
      {toast && <div className="toast">{toast}</div>}

      <div className="tk-col">
        {npcEn &&
          (graded && !npcOpen ? (
            <div className="tk-npc-pill">
              <button onClick={() => setNpcOpen(true)} aria-label="상대의 말 보기">
                <TkChat />
              </button>
              <i />
              <button onClick={() => speak(npcEn, settings.speechRate === 'slow')} aria-label="듣기">
                <TkSpeaker />
              </button>
            </div>
          ) : (
            <div className="tk-npc" onClick={() => graded && setNpcOpen(false)}>
              <p className="tk-npc-en" lang="en">
                {npcEn}
              </p>
              <p className="tk-npc-ko">
                <KoText text={npcKo} />
              </p>
              <button
                className="tk-npc-spk"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(npcEn, settings.speechRate === 'slow');
                }}
                aria-label="듣기"
              >
                <TkSpeaker />
              </button>
            </div>
          ))}
        <div className="tk-me" ref={meRef}>
          {grade && (
            <span className={`tk-label ${grade.tone}`} key={`${grade.label}${graded ? 1 : 0}`} lang="en">
              {grade.label}
            </span>
          )}
          <span className="tk-stars">
            {[0, 1, 2].map((i) => (
              <TalkStar key={i} on={i < shownStars} />
            ))}
          </span>
          {wordTip && !grade && (line.words?.length ?? 0) > 0 && (
            <button className="tk-tip" onClick={dismissWordTip}>
              단어를 누르면 영어표현을 확인할 수 있어요
            </button>
          )}
          {peek && !graded && (
            <div className="tk-peek" style={{ '--x': `${peek.x}px` } as CSSProperties} lang="en" onClick={(e) => e.stopPropagation()}>
              {peek.en}
            </div>
          )}
          <p className="tk-ko">
            <KoWords line={line} peek={graded ? null : (peek?.ko ?? null)} onPeek={onPeek} />
          </p>
          {showBox && (
            <div className="tk-box nice">
              <KoText text={line.hint ?? ''} />
            </div>
          )}
          {grade && !shown && (
            <div className={`tk-box ${grade.tone}`}>
              <KoText text={grade.feedback} />
            </div>
          )}
          <p className="tk-typed" lang="en">
            <span>{shown && graded ? '' : input}</span>
            {typing && mode === 'keyboard' && <i className="tk-caret" />}
          </p>
          {grade && (
            <div className="tk-model">
              <span className="tk-tag">모범 답안</span>
              <p lang="en">{line.answer}</p>
            </div>
          )}
          {mode === 'voice' && !graded && (
            <div className="tk-voice">
              <button className="tk-vside" onClick={() => (listening ? window.dispatchEvent(new Event('voca:stop-listening')) : hint ? showModel() : setHint(true))}>
                {listening ? (
                  <svg className="tk-vcancel" viewBox="0 0 17.333 17.333" width="17.333" height="17.333" aria-hidden="true">
                    <circle cx="8.667" cy="8.667" r="8.667" fill="currentColor" />
                    <path d="M5.800 5.800l5.733 5.733M11.533 5.800 5.800 11.533" fill="none" stroke="#242629" strokeWidth="1.700" strokeLinecap="round" />
                  </svg>
                ) : hint ? (
                  <TkModelSmall />
                ) : (
                  <TkHint />
                )}
                <span>{listening ? '음성 인식 취소' : hint ? '모범 답안' : '힌트 보기'}</span>
              </button>
              <button
                className={`tk-vmic${listening ? ' listening' : ''}`}
                onClick={() => {
                  setMicTip(false);
                  if (listening) window.dispatchEvent(new Event('voca:stop-listening'));
                  else if (heard && input.trim()) submit();
                  else void voiceAnswer();
                }}
                aria-label={listening ? '듣는 중' : heard ? '제출' : '말하기'}
              >
                {listening || heard ? (
                  <svg viewBox="0 0 22 17" width="22" height="17" aria-hidden="true">
                    <path d="M2 8.800l6 6L20 2.200" fill="none" stroke="#fff" strokeWidth="3.600" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 22.333" width="16" height="22.333" aria-hidden="true">
                    <rect x="4" y="0" width="8" height="13.600" rx="4" fill="#fff" />
                    <path d="M1 9.300v1a7 7 0 0 0 14 0v-1" fill="none" stroke="#fff" strokeWidth="1.800" strokeLinecap="round" />
                    <path d="M8 17.600v3.700" fill="none" stroke="#fff" strokeWidth="1.800" strokeLinecap="round" />
                  </svg>
                )}
                {listening && <small>듣고 있어요</small>}
              </button>
              <button className="tk-vside" onClick={() => void saveSettings({ talkInput: 'keyboard' })}>
                <QKeyboard />
                <span>키보드 모드</span>
              </button>
              {!listening && !heard && micTip && <span className="tk-vtip">마이크 버튼을 눌러 말해 보세요</span>}
              {(listening || heard) && <span className="tk-vtip">누르면 입력한 답안이 제출돼요</span>}
            </div>
          )}
        </div>
      </div>

      {graded ? (
        <div className="tk-actions">
          <button onClick={() => speak(line.answer ?? '', settings.speechRate === 'slow')}>
            <TkModel />
            <span>모범 답안 듣기</span>
          </button>
          <button className={marked ? 'on' : ''} onClick={() => void toggleTalkReview(`${episode.id}:${lineIndex}`).then(() => showToast(marked ? '복습에서 뺐어요.' : '복습에 추가했어요.'))}>
            <TkMark on={marked} />
            <span>{marked ? '복습에 추가됨' : '복습에 추가'}</span>
          </button>
          <button onClick={retry}>
            <TkRetry />
            <span>재도전</span>
          </button>
          <button onClick={afterAnswer}>
            {last || reviewLine != null ? <TkDone /> : <TkNext />}
            <span>{reviewLine != null ? '완료' : last ? '학습 완료' : '다음 문제'}</span>
          </button>
        </div>
      ) : (
        mode === 'keyboard' && (
          <div className="tk-kb">
            <div className="tk-pill">
              {/* 힌트를 봤거나 재도전 중이면 '모범 답안' */}
              <button onClick={() => (hint || retrying ? showModel() : setHint(true))}>
                {hint || retrying ? <TkModelSmall /> : <TkHint />}
                <span>{hint || retrying ? '모범 답안' : '힌트 보기'}</span>
              </button>
              <i />
              <span className="tk-pill-mid" />
              <i />
              <button onClick={() => void saveSettings({ talkInput: 'voice' })} disabled={!canRecognize()}>
                <TkMic />
                <span>음성 모드</span>
              </button>
            </div>
            <SentenceKeyboard value={input} onChange={setInput} onEnter={() => submit()} />
          </div>
        )
      )}

      {exprCard && line.expr && (
        <div className="modal-dim" onClick={(e) => e.stopPropagation()}>
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

/** 전체 에피소드: 세로 타임라인. 끝낸 에피소드는 초록 체크 + 등급 배지, 지금 할 에피소드는 보라 테두리 칸 + '학습 시작', 그 뒤는 잠금 */
export function EpisodeSheet({ story, prog, current, onClose, onPick }: { story: TalkStory; prog: TalkProgress; current: number; onClose: () => void; onPick: (i: number) => void }) {
  const cur = currentEpisode(story, prog);
  return (
    <div className="tk-sheet-dim" onClick={onClose}>
      <div className="tk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="tk-sheet-head">
          <span>
            <KoText text={story.title} />
          </span>
          <button onClick={onClose} aria-label="닫기">
            <svg width="11.667" height="11.667" viewBox="0 0 11.667 11.667" aria-hidden="true">
              <path d="M0.800 0.800l10.067 10.067M10.867 0.800L0.800 10.867" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="tk-eplist">
          {story.episodes.map((e, i) => {
            const p = prog[e.id];
            const open = unlocked(story, prog, i);
            const isCur = i === (current ?? cur);
            return (
              <div key={e.id} className={`tk-ep${isCur ? ' cur' : ''}${open ? '' : ' locked'}`} onClick={() => open && !isCur && onPick(i)}>
                <span className={`tk-epdot${p?.done ? ' done' : isCur ? ' now' : ''}`}>
                  {p?.done ? (
                    <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true">
                      <path d="M1 4l2.800 2.800L9 1.200" fill="none" stroke="#fff" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isCur ? (
                    <svg viewBox="0 0 7 8" width="7" height="8" aria-hidden="true">
                      <path d="M0.600 0.600v6.800L6.400 4z" fill="#fff" />
                    </svg>
                  ) : open ? null : (
                    <svg viewBox="0 0 9 11" width="9" height="11" aria-hidden="true">
                      <rect x="0" y="4.500" width="9" height="6.500" rx="1.500" fill="#4a4c50" />
                      <path d="M2.200 4.500V3a2.300 2.300 0 0 1 4.600 0v1.500" fill="none" stroke="#4a4c50" strokeWidth="1.300" />
                    </svg>
                  )}
                </span>
                <div className="tk-eptext">
                  <small lang="en">Episode {i + 1}</small>
                  <b>
                    <KoText text={e.title} />
                  </b>
                </div>
                <span className="tk-epgrade">{p?.grade ? <GradeBadge g={p.grade} size={27} /> : isCur ? <GradeBadge size={27} /> : null}</span>
                {isCur && open && (
                  <button
                    className="tk-epstart"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onPick(i);
                    }}
                  >
                    <svg viewBox="0 0 14 11.333" width="14" height="11.333" aria-hidden="true">
                      <path d="M0 1.300C2.300 0.700 4.600 1.100 6.400 2.300v9C4.600 10.200 2.300 9.800 0 10.300zM14 1.300c-2.300-0.600-4.600-0.200-6.400 1v9c1.800-1.100 4.100-1.500 6.400-1z" fill="#fff" />
                    </svg>
                    학습 시작
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
