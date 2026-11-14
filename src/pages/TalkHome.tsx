import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import KoText from '../components/KoText';
import { QBack, QGear } from '../components/QuizIcons';
import SceneArt from '../components/SceneArt';
import { db } from '../db';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { CEFR, currentEpisode, getTalkProgress, getTalkReviewMarks, pickReview } from '../lib/talk';
import type { Settings } from '../types';
import { GradeBadge } from './TalkPlay';

const CAT_ORDER = ['일상', '연애', '학교', '직장', '여행', '스페셜'];
const CEFR_IDX = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** 실전 회화 메인 */
export default function TalkHome() {
  const nav = useNavigate();
  const s = useSettings();
  const stories = useLiveQuery(() => db.tstories.orderBy('order').toArray(), []);
  const prog = useLiveQuery(() => getTalkProgress(), []);
  const marks = useLiveQuery(() => getTalkReviewMarks(), []);
  if (!s) return null;
  const lv = CEFR_IDX.indexOf(s.talkLevel);
  const list = [...(stories ?? [])].sort((a, b) => {
    const ta = Math.max(...a.episodes.map((e) => prog?.[e.id]?.ts ?? 0));
    const tb = Math.max(...b.episodes.map((e) => prog?.[e.id]?.ts ?? 0));
    if (ta !== tb) return tb - ta;
    return Math.abs(CEFR_IDX.indexOf(a.cefr) - lv) - Math.abs(CEFR_IDX.indexOf(b.cefr) - lv);
  });
  const review = stories && prog ? pickReview(stories, prog, marks ?? []) : null;
  const cats = [...new Set((stories ?? []).map((x) => x.category))].sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));

  return (
    <div className="th2">
      <header className="th2-head">
        <button className="th2-back" onClick={() => nav(-1)}>
          <QBack />
          <span>실전 회화 학습</span>
        </button>
        <button className="th2-level" onClick={() => nav('/talk/level')}>
          <QGear />
          <span>
            난이도 · <i lang="en">{s.talkLevel}</i>
          </span>
        </button>
      </header>
      {!stories?.length && <p className="empty-note">회화 데이터를 받는 중이에요.</p>}
      <div className="th2-carousel">
        {list.map((st) => {
          const done = st.episodes.filter((e) => prog?.[e.id]?.done).length;
          const cur = prog ? currentEpisode(st, prog) : 0;
          const started = st.episodes.some((e) => prog?.[e.id]?.ts);
          return (
            <div key={st.id} className="th2-story">
              <SceneArt scene={st.scene} style={{ position: 'absolute', inset: 0 }} />
              <div className="th2-shade" />
              <b>
                <KoText text={st.title} />
              </b>
              <span>
                <KoText text={st.subtitle} />
              </span>
              <button onClick={() => nav(`/talk/${st.id}/${cur}`)}>
                <svg viewBox="0 0 9 10.667" width="9" height="10.667" aria-hidden="true">
                  <path d="M0 1.300C0 0.300 1.100-0.300 1.950 0.250l6.300 4.033c0.800 0.500 0.800 1.633 0 2.150L1.950 10.417C1.100 10.967 0 10.367 0 9.367z" fill="#fff" />
                </svg>
                {started ? '이어서 학습' : '학습 시작'}
              </button>
              <div className="th2-bar">
                <i style={{ width: `${(done / st.episodes.length) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {review && (
        <button className="th2-review" onClick={() => nav(`/talk/${review.story.id}/${review.epIdx}?line=${review.lineIdx}`)}>
          <span className="th2-rtag">
            복습하기
            <svg viewBox="0 0 6 10" width="5.333" height="9" aria-hidden="true">
              <path d="M1 1l4 4-4 4" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="th2-rhead">
            문장 복습
            <span className="th2-rec">
              <svg viewBox="0 0 10 10" width="7.667" height="7.667" aria-hidden="true">
                <path d="M5 0.400 6.350 3.500 9.700 3.800 7.150 6 7.950 9.300 5 7.500 2.050 9.300 2.850 6 0.300 3.800 3.650 3.500z" fill="#4fbe2d" />
              </svg>
              추천
            </span>
          </p>
          <p className="th2-rko">
            <KoText text={review.line.ko} />
          </p>
          <p className="th2-rsrc">
            <i>
              <SceneArt scene={review.story.scene} withCharacter={false} style={{ position: 'absolute', inset: 0 }} />
            </i>
            <KoText text={review.story.episodes[review.epIdx].title} />
          </p>
        </button>
      )}
      <Link to="/talk/recent" className="th2-recent">
        최근 학습한 에피소드
        <svg viewBox="0 0 7 12" width="6.667" height="11.333" aria-hidden="true">
          <path d="M1 1l5 5-5 5" fill="none" stroke="#50575d" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {cats.map((c) => (
        <section key={c} className="th2-cat">
          <h3>{c}</h3>
          <div className="th2-tiles">
            {(stories ?? [])
              .filter((x) => x.category === c)
              .map((st) => (
                <button key={st.id} className="th2-tile" onClick={() => nav(`/talk/${st.id}/${prog ? currentEpisode(st, prog) : 0}`)}>
                  <SceneArt scene={st.scene} withCharacter={false} style={{ position: 'absolute', inset: 0 }} />
                  <span className="th2-tshade" />
                  <b>
                    <KoText text={st.title} />
                  </b>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** 최근 학습한 에피소드 */
export function TalkRecent() {
  const nav = useNavigate();
  const stories = useLiveQuery(() => db.tstories.toArray(), []);
  const prog = useLiveQuery(() => getTalkProgress(), []);
  const rows = (stories ?? [])
    .flatMap((st) => st.episodes.map((e, i) => ({ st, e, i, p: prog?.[e.id] })))
    .filter((r) => r.p?.ts)
    .sort((a, b) => (b.p!.ts ?? 0) - (a.p!.ts ?? 0));
  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 최근 학습한 에피소드
        </button>
      </header>
      {rows.length === 0 && <p className="empty-note">아직 학습한 에피소드가 없어요.</p>}
      {rows.map(({ st, e, i, p }) => (
        <button key={e.id} className="menu-row" onClick={() => nav(`/talk/${st.id}/${i}`)}>
          <span className="menu-text">
            <span>{st.title}</span>
            <b>
              Episode {i + 1} · {e.title}
            </b>
          </span>
          {p?.grade ? <GradeBadge g={p.grade} size={34} /> : <span className="muted small">진행 중</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * 학습 난이도 (CEFR) — 말해보카 플립 실측(2026-11-14).
 * 머리줄 아래 안내 글은 제자리에 있고 그 아래로 난이도 칸 여섯이 흐른다. 고른 칸은 보라 테두리 + 그 난이도의 예문이 펼쳐진다.
 * '확인'은 지금 난이도와 다른 것을 골랐을 때만 또렷해진다.
 */
export function TalkLevel() {
  const nav = useNavigate();
  const s = useSettings();
  const [sel, setSel] = useState<Settings['talkLevel'] | null>(null);
  if (!s) return null;
  const cur = sel ?? s.talkLevel;
  const changed = cur !== s.talkLevel;
  return (
    <div className="th2 th2-lv">
      <header className="th2-head">
        <button className="th2-back" onClick={() => nav(-1)}>
          <QBack />
          <span>학습 난이도</span>
        </button>
      </header>
      <div className="th2-lvintro">
        <p>
          실전 회화의 난이도는
          <br />
          전 세계적으로 통용되는 언어 능력 기준인
          <br />
          <em lang="en">CEFR</em>을 기반으로 나누어져요.
        </p>
        <small>난이도가 낮을수록 채점이 너그러워지고, 내 난이도의 스토리가 먼저 보여요.</small>
      </div>
      <div className="th2-lvlist">
        {CEFR.map((c) => (
          <button key={c.id} className={`th2-lvcard${cur === c.id ? ' sel' : ''}`} onClick={() => setSel(c.id)} aria-pressed={cur === c.id}>
            <i className="th2-radio" />
            <b lang="en">{c.id}</b>
            <span>
              <KoText text={c.desc} />
            </span>
            {cur === c.id && (
              <span className="th2-lvex">
                <span>
                  <KoText text={c.ex.ko} />
                </span>
                <span lang="en">{c.ex.en}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="th2-lvfoot">
        <button className="th2-lvcancel" onClick={() => nav(-1)}>
          취소
        </button>
        <button
          className={`th2-lvok${changed ? ' on' : ''}`}
          onClick={() => {
            void saveSettings({ talkLevel: cur });
            nav(-1);
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

interface SavedExpr {
  en: string;
  ko: string;
  note: string;
}

/** 회화 중 '좋아요'로 모은 표현 */
export function TalkSaved() {
  const nav = useNavigate();
  const rows = useLiveQuery(async () => ((await db.kv.get('myExpressions'))?.value as SavedExpr[] | undefined) ?? [], []);
  const remove = async (en: string) => {
    await db.kv.put({ key: 'myExpressions', value: (rows ?? []).filter((r) => r.en !== en) });
  };
  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 내가 추가한 표현
        </button>
        <span className="count-pill purple">{rows?.length ?? 0}</span>
      </header>
      {rows && rows.length === 0 && <p className="empty-note">실전 회화에서 표현 카드의 '좋아요'를 누르면 여기에 모여요.</p>}
      {(rows ?? []).map((r) => (
        <div key={r.en} className="sent-item">
          <p className="sent-en">{r.en}</p>
          <p className="sent-ko">{r.ko}</p>
          <p className="ctx">{r.note}</p>
          <div className="sent-actions">
            <button className="icon-btn small" onClick={() => speak(r.en)} aria-label="듣기">
              <Icon name="speaker" size={18} />
            </button>
            <button className="icon-btn small" onClick={() => void remove(r.en)} aria-label="삭제">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
