import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { KoSentence } from '../components/QuizCard';
import { db } from '../db';
import { courseProgress } from '../lib/expr';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { shiftDate, studyDateOf } from '../lib/time';

const DECO_DAILY = ['☕', '🛍️', '🏠', '🍰', '🎬', '📱'];
const DECO_TRAVEL = ['🧳', '✈️', '🏨', '🗺️', '🍽️', '🎡'];

/** 표현 학습 메인: 코스 지도 */
export default function ExprHome() {
  const nav = useNavigate();
  const s = useSettings();
  const courses = useLiveQuery(() => db.ecourses.orderBy('order').toArray(), []);
  const cid = s?.exprCourse ?? courses?.[0]?.id ?? '';
  const course = courses?.find((c) => c.id === cid);
  const data = useLiveQuery(async () => {
    const patterns = await db.epatterns.where('course').equals(cid).sortBy('order');
    const seen = new Set((await db.mcards.where('mode').equals('expr').toArray()).map((c) => c.itemId));
    const items = await db.eitems.where('course').equals(cid).toArray();
    const done = patterns.map((p) => {
      const its = items.filter((i) => i.pkey === p.key);
      return its.length > 0 && its.every((i) => seen.has(i.id));
    });
    const daily = await db.daily.toArray();
    const trophies = daily.filter((d) => (d.byMode?.expr?.total ?? 0) >= (s?.exprGoal ?? 15)).length;
    return { patterns, done, trophies, stars: seen.size };
  }, [cid, s?.exprGoal]);

  const nodes = data?.patterns ?? [];
  const firstOpen = data ? data.done.findIndex((d) => !d) : -1;
  const H = nodes.length * 96 + 230;
  const pos = useMemo(() => nodes.map((_, i) => ({ x: 50 + 28 * Math.sin(i * 0.95), y: 70 + i * 96 })), [nodes]);
  const deco = course?.icon === 'plane' ? DECO_TRAVEL : DECO_DAILY;
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'center' });
  }, [firstOpen, cid]);

  return (
    <div className="expr-home">
      <header className="vs-head expr-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 표현 학습 <sup className="beta">beta</sup>
        </button>
        <span className="expr-stats">
          <Icon name="trophy" size={22} className="ic-gold" /> {data?.trophies ?? 0}
          <Icon name="star" size={22} className="ic-pink" /> {data?.stars ?? 0}
        </span>
      </header>
      <div className="expr-tools">
        <button className="course-pill" onClick={() => nav('/expr/courses')}>
          {course?.title ?? '코스 선택'} <Icon name="caret" size={14} />
        </button>
        <button className="note-round" onClick={() => nav('/expr/notebook')} aria-label="일별 학습 문장">
          <Icon name="book" size={22} />
        </button>
      </div>
      <div className="expr-map" style={{ height: H }}>
        {pos.length > 0 && (
          <svg className="map-path" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none">
            <path d={pos.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + ` L 50 ${H - 90}`} />
          </svg>
        )}
        {nodes.map((_, i) =>
          i % 3 === 1 ? (
            <span key={`d${i}`} className="map-deco" style={{ left: pos[i].x > 50 ? '14%' : '86%', top: pos[i].y }} aria-hidden="true">
              {deco[Math.floor(i / 3) % deco.length]}
            </span>
          ) : null,
        )}
        {nodes.map((p, i) => (
          <button
            key={p.key}
            ref={i === firstOpen ? nextRef : undefined}
            className={`coin ${data?.done[i] ? 'done' : i === firstOpen ? 'next' : 'todo'}`}
            style={{ left: `${pos[i].x}%`, top: pos[i].y }}
            onClick={() => nav(`/expr-dict/${encodeURIComponent(p.key)}`)}
            aria-label={p.ko}
          >
            <Icon name="star" size={30} />
            {i === firstOpen && <span className="coin-label">{p.ko}</span>}
          </button>
        ))}
        <span className="finish" style={{ top: H - 90 }}>
          FINISH
        </span>
      </div>
      <div className="expr-start">
        <button className="today-btn" onClick={() => nav('/expr/quiz')}>
          <Icon name="book" size={24} /> 오늘의 학습
        </button>
      </div>
    </div>
  );
}

/** 코스 선택 */
export function ExprCourses() {
  const nav = useNavigate();
  const s = useSettings();
  const courses = useLiveQuery(() => db.ecourses.orderBy('order').toArray(), []);
  const prog = useLiveQuery(() => courseProgress(), []);
  const cur = s?.exprCourse ?? courses?.[0]?.id;
  const card = (c: NonNullable<typeof courses>[number], sel: boolean) => {
    const p = prog?.get(c.id) ?? { done: 0, total: 1 };
    const pct = Math.round((p.done / Math.max(1, p.total)) * 100);
    return (
      <button
        key={c.id + (sel ? '-cur' : '')}
        className={`course-card ${sel ? 'sel' : ''}`}
        onClick={() => {
          void saveSettings({ exprCourse: c.id });
          nav('/expr', { replace: true });
        }}
      >
        <span className="course-icon">
          <Icon name={c.icon === 'plane' ? 'plane' : 'cup'} size={24} />
        </span>
        <span className="course-main">
          <b>{c.title}</b>
          <span className="course-bar">
            <i style={{ width: `${pct}%` }} />
          </span>
        </span>
        <span className="course-side">
          <span className="course-stars">
            {[1, 2, 3].map((n) => (
              <Icon key={n} name="star" size={14} className={n <= c.stars ? 'ic-gold' : 'muted-ic'} />
            ))}
          </span>
          <span className="course-pct">{pct}%</span>
        </span>
      </button>
    );
  };
  return (
    <div className="vs-page course-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} />
        </button>
        <sup className="beta pill">beta</sup>
      </header>
      <p className="course-title">
        학습할 <em>카테고리</em>를 선택해 주세요
      </p>
      <p className="course-sub">코스는 언제든지 바꿀 수 있어요</p>
      {courses && cur && (
        <section className="course-now">
          <p>▪ 현재 학습 중인 코스</p>
          {courses.filter((c) => c.id === cur).map((c) => card(c, false))}
        </section>
      )}
      <h3 className="menu-title">전체 코스</h3>
      <div className="course-list">{(courses ?? []).map((c) => card(c, c.id === cur))}</div>
    </div>
  );
}

/** 일별 학습 문장 */
export function ExprNotebook() {
  const nav = useNavigate();
  const [date, setDate] = useState(studyDateOf());
  const [koFirst, setKoFirst] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rows = useLiveQuery(async () => {
    const reviews = await db.reviews.where('studyDate').equals(date).filter((r) => r.studyMode === 'expr').toArray();
    const ids = [...new Set(reviews.map((r) => r.wordId))];
    const items = (await db.eitems.bulkGet(ids)).filter((x): x is NonNullable<typeof x> => !!x);
    return items.map((it) => ({ it, r: reviews.filter((r) => r.wordId === it.id) })).filter((x) => !wrongOnly || x.r.some((r) => !r.firstTry));
  }, [date, wrongOnly]);
  const today = studyDateOf();
  const label = date === today ? '오늘' : date === shiftDate(today, -1) ? '어제' : date.slice(5).replace('-', '.');

  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 일별 학습 문장
        </button>
        <label className="vs-help">
          학습 기록
          <input type="checkbox" checked={showLog} onChange={(e) => setShowLog(e.target.checked)} />
          <span className="toggle" />
        </label>
      </header>
      <div className="nb-filters">
        <button className="chip-btn" onClick={() => setKoFirst((v) => !v)}>
          {koFirst ? '뜻 먼저 보기' : '영어 먼저 보기'} ▾
        </button>
        <button className="chip-btn" onClick={() => setWrongOnly((v) => !v)}>
          {wrongOnly ? '틀린 문장만 보기' : '모든 문장 보기'} ▾
        </button>
        <span className="nb-date">
          <button onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="이전 날">
            ‹
          </button>
          <b>{label}</b>
          <button onClick={() => setDate((d) => (d < today ? shiftDate(d, 1) : d))} aria-label="다음 날">
            ›
          </button>
        </span>
      </div>
      {rows && rows.length === 0 && <p className="empty-note">표시할 문장이 없어요.</p>}
      <div className="nb-list">
        {(rows ?? []).map(({ it, r }) => {
          const shown = open.has(it.id);
          const en = it.en.replace('___', it.answer);
          return (
            <button
              key={it.id}
              className="sent-item nb-item"
              onClick={() =>
                setOpen((o) => {
                  const n = new Set(o);
                  if (n.has(it.id)) n.delete(it.id);
                  else n.add(it.id);
                  return n;
                })
              }
            >
              {koFirst ? (
                <>
                  <p className="sent-ko big">
                    <KoSentence ko={it.ko} />
                  </p>
                  {shown && <p className="sent-en">{en}</p>}
                </>
              ) : (
                <>
                  <p className="sent-en">{en}</p>
                  {shown && (
                    <p className="sent-ko">
                      <KoSentence ko={it.ko} />
                    </p>
                  )}
                </>
              )}
              {showLog && <p className="note left">{r.map((x) => (x.firstTry ? '한 번에 정답' : `오답 ${x.wrongAttempts}번`)).join(' · ')}</p>}
              <span
                className="nb-play"
                role="button"
                aria-label="듣기"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(en);
                }}
              >
                <Icon name="speaker" size={18} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="nb-foot">
        <button className="btn primary big" onClick={() => nav('/expr/quiz')} disabled={!rows?.length}>
          히스토리 학습 ({rows?.length ?? 0}개) <Icon name="chevron" size={16} />
        </button>
      </div>
      <Link to="/expr-dict" className="sr-only">
        표현 사전
      </Link>
    </div>
  );
}

/** 표현 사전: 목록 / 상세 */
export function ExprDict({ keyParam }: { keyParam?: string }) {
  const nav = useNavigate();
  const courses = useLiveQuery(() => db.ecourses.orderBy('order').toArray(), []);
  const patterns = useLiveQuery(() => db.epatterns.toArray(), []);
  const detail = useLiveQuery(async () => {
    if (!keyParam) return null;
    const p = await db.epatterns.get(keyParam);
    const items = await db.eitems.where('pkey').equals(keyParam).sortBy('order');
    return p ? { p, items } : null;
  }, [keyParam]);
  const [q, setQ] = useState('');

  if (keyParam) {
    const paras = (detail?.p.note ?? '').split(/\n+/).filter(Boolean);
    return (
      <div className="vs-page lesson-page xd-page">
        <button className="xd-close" onClick={() => nav(-1)} aria-label="닫기">
          <Icon name="close" size={22} />
        </button>
        {detail && (
          <article className="lesson xd">
            <h2 className="xd-title">{detail.p.en.replace(/~/g, '~')}</h2>
            <p className="xd-ko">{detail.p.ko}</p>
            <p className="lesson-cat xd-cat">{courses?.find((c) => c.id === detail.p.course)?.title}</p>
            <button className="xd-bubble" onClick={() => speak(detail.p.en.replace(/~/g, ''))}>
              <span className="xd-avatar">
                <Icon name="chat" size={22} />
              </span>
              <span className="xd-bubble-text">
                <b>{detail.p.en}</b>
                <small>{detail.p.ko}</small>
              </span>
            </button>
            <p className="xd-p lead">{detail.p.meaning}</p>
            {paras.map((t, i) => (
              <p key={i} className="xd-p">
                {t}
              </p>
            ))}
            <h3 className="lesson-h">예문</h3>
            {detail.items.map((it) => (
              <div key={it.id} className="lesson-ex">
                <span className="lesson-avatar">
                  <Icon name="chat" size={22} />
                </span>
                <button className="lesson-bubble" onClick={() => speak(it.en.replace('___', it.answer))}>
                  <span className="lesson-ko">{it.partner.en}</span>
                  <span className="lesson-en">
                    {it.en.split('___')[0]}
                    <em>{it.answer}</em>
                    {it.en.split('___')[1]}
                  </span>
                  <span className="lesson-ko">
                    <KoSentence ko={it.ko} />
                  </span>
                </button>
              </div>
            ))}
          </article>
        )}
      </div>
    );
  }

  const term = q.trim().toLowerCase();
  return (
    <div className="vs-page dict-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 표현 사전
        </button>
      </header>
      {(courses ?? []).map((c) => {
        const list = (patterns ?? []).filter((p) => p.course === c.id && (!term || p.ko.includes(term) || p.en.toLowerCase().includes(term))).sort((a, b) => a.order - b.order);
        if (!list.length) return null;
        return (
          <section key={c.id} className="vs-sec">
            <h3>{c.title}</h3>
            {list.map((p) => (
              <Link key={p.key} to={`/expr-dict/${encodeURIComponent(p.key)}`} className="al-row">
                <span className="al-label">
                  {p.ko}
                  <small className="muted"> {p.en}</small>
                </span>
                <Icon name="chevron" size={16} className="muted-ic" />
              </Link>
            ))}
          </section>
        );
      })}
      <form className="dict-searchbar" onSubmit={(e) => e.preventDefault()}>
        <input placeholder="표현을 검색해 주세요." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit">확인</button>
      </form>
    </div>
  );
}
