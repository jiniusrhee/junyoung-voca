import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
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
  if (!s) return null;
  const lv = CEFR_IDX.indexOf(s.talkLevel);
  const list = [...(stories ?? [])].sort((a, b) => {
    const ta = Math.max(...a.episodes.map((e) => prog?.[e.id]?.ts ?? 0));
    const tb = Math.max(...b.episodes.map((e) => prog?.[e.id]?.ts ?? 0));
    if (ta !== tb) return tb - ta;
    return Math.abs(CEFR_IDX.indexOf(a.cefr) - lv) - Math.abs(CEFR_IDX.indexOf(b.cefr) - lv);
  });
  const marks = useLiveQuery(() => getTalkReviewMarks(), []);
  const review = stories && prog ? pickReview(stories, prog, marks ?? []) : null;
  const cats = [...new Set((stories ?? []).map((x) => x.category))].sort((a, b) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(b));

  return (
    <div className="vs-page talk-home">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 실전 회화 학습
        </button>
        <button className="level-chip dark" onClick={() => nav('/talk/level')}>
          <Icon name="gear" size={16} /> 난이도 · {s.talkLevel}
        </button>
      </header>
      {!stories?.length && <p className="empty-note">회화 데이터를 받는 중이에요.</p>}
      <div className="story-carousel">
        {list.map((st) => {
          const done = st.episodes.filter((e) => prog?.[e.id]?.done).length;
          const cur = prog ? currentEpisode(st, prog) : 0;
          const started = st.episodes.some((e) => prog?.[e.id]?.ts);
          return (
            <div key={st.id} className="story-card">
              <SceneArt scene={st.scene} style={{ position: 'absolute', inset: 0 }} />
              <div className="story-shade" />
              <span className="story-cefr">{st.cefr}</span>
              <div className="story-text">
                <b>{st.title}</b>
                <span>{st.subtitle}</span>
                <button className="btn primary story-go" onClick={() => nav(`/talk/${st.id}/${cur}`)}>
                  <Icon name="play" size={16} /> {started ? '이어서 학습' : '학습 시작'}
                </button>
              </div>
              <div className="story-bar">
                <i style={{ width: `${(done / st.episodes.length) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {review && (
        <button className="review-card" onClick={() => nav(`/talk/${review.story.id}/${review.epIdx}?line=${review.lineIdx}`)}>
          <span className="review-tag">복습하기 ›</span>
          <p className="review-head">
            문장 복습 <span className="rec">★ 추천</span>
          </p>
          <p className="review-ko">{review.line.ko}</p>
          <p className="review-src">{review.story.episodes[review.epIdx].title}</p>
        </button>
      )}
      <Link to="/talk/recent" className="recent-row">
        최근 학습한 에피소드 <Icon name="chevron" size={18} />
      </Link>

      {cats.map((c) => (
        <section key={c} className="cat-sec">
          <h3>{c}</h3>
          <div className="cat-row">
            {(stories ?? [])
              .filter((x) => x.category === c)
              .map((st) => (
                <button key={st.id} className="cat-card" onClick={() => nav(`/talk/${st.id}/${prog ? currentEpisode(st, prog) : 0}`)}>
                  <SceneArt scene={st.scene} withCharacter={false} style={{ position: 'absolute', inset: 0 }} />
                  <span className="cat-shade" />
                  <b>{st.title}</b>
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

/** 학습 난이도 (CEFR) */
export function TalkLevel() {
  const nav = useNavigate();
  const s = useSettings();
  const [sel, setSel] = useState<Settings['talkLevel'] | null>(null);
  if (!s) return null;
  const cur = sel ?? s.talkLevel;
  return (
    <div className="vs-page level-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 학습 난이도
        </button>
      </header>
      <p className="level-intro">
        실전 회화의 난이도는
        <br />
        전 세계적으로 통용되는 언어 능력 기준인
        <br />
        <em>CEFR</em>을 기반으로 나누어져요.
      </p>
      <p className="level-sub">난이도가 낮을수록 채점이 너그러워지고, 내 난이도에 맞는 스토리가 먼저 보여요.</p>
      <div className="level-list">
        {CEFR.map((c) => (
          <button key={c.id} className={`level-card ${cur === c.id ? 'sel' : ''}`} onClick={() => setSel(c.id)}>
            <span className="radio" />
            <span>
              <b>{c.id}</b>
              <small>{c.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="level-actions">
        <button className="btn gray big" onClick={() => nav(-1)}>
          취소
        </button>
        <button
          className="btn primary big"
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
