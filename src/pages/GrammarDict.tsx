import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { speak } from '../lib/speech';
import type { LessonBlock } from '../types';

/** **굵게**, ==노란 강조== 를 화면용으로 */
export function richText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|==[^=]+==)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<b key={k++}>{t.slice(2, -2)}</b>);
    else out.push(<mark key={k++} className="hl-yellow">{t.slice(2, -2)}</mark>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function ExBubble({ en, ko, hl }: { en: string; ko: string; hl?: string }) {
  const parts = hl && en.includes(hl) ? [en.slice(0, en.indexOf(hl)), hl, en.slice(en.indexOf(hl) + hl.length)] : [en, '', ''];
  return (
    <div className="lesson-ex">
      <span className="lesson-avatar">
        <Mascot size={46} />
      </span>
      <button className="lesson-bubble" onClick={() => speak(en)}>
        <span className="lesson-en">
          {parts[0]}
          {parts[1] && <em>{parts[1]}</em>}
          {parts[2]}
        </span>
        <span className="lesson-ko">{ko}</span>
      </button>
    </div>
  );
}

function Block({ b }: { b: LessonBlock }) {
  switch (b.t) {
    case 'h':
      return <h3 className="lesson-h">{b.text}</h3>;
    case 'ex':
      return <ExBubble en={b.en ?? ''} ko={b.ko ?? ''} hl={b.hl} />;
    case 'tip':
      return (
        <div className="lesson-tip">
          <Mascot size={54} mood="cheer" />
          <p>{richText(b.text ?? '')}</p>
        </div>
      );
    case 'chunks':
      return (
        <div className="lesson-chunks">
          {(b.parts ?? []).map((p, i) => (
            <span key={i} className="chunk">
              <span className={`chunk-text ${p.label ? 'labeled' : ''}`}>{p.text}</span>
              <span className="chunk-label">{p.label}</span>
            </span>
          ))}
        </div>
      );
    default:
      return <p className="lesson-p">{richText(b.text ?? '')}</p>;
  }
}

/** 문법 사전 글 */
export function GrammarLesson() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const topic = useLiveQuery(() => db.gtopics.get(id), [id]);
  const sentences = useLiveQuery(() => db.gsentences.where('topic').equals(id).toArray(), [id]);
  const all = useLiveQuery(() => db.gtopics.orderBy('order').toArray(), []);
  if (topic === undefined) return <div className="vs-page" />;
  if (!topic) {
    return (
      <div className="vs-page">
        <header className="vs-head">
          <button className="vs-back" onClick={() => nav(-1)}>
            <Icon name="back" size={22} /> 문법 사전
          </button>
        </header>
        <p className="empty-note">문법 주제를 찾을 수 없어요.</p>
      </div>
    );
  }
  const idx = (all ?? []).findIndex((t) => t.id === topic.id);
  const prev = idx > 0 ? all![idx - 1] : null;
  const next = idx >= 0 && idx < (all?.length ?? 0) - 1 ? all![idx + 1] : null;
  const num = topic.level.split('-')[1];

  return (
    <div className="vs-page lesson-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 문법 사전
        </button>
      </header>
      <article className="lesson">
        <p className="lesson-cat">
          {topic.category} · 레벨 {topic.level}
        </p>
        <h2 className="lesson-title">
          <span className="lesson-num">{num}</span>
          {topic.title}
        </h2>
        <div className="lesson-sum-box">
          <span className="box-tag">한 줄 요약</span>
          <p className="lesson-summary">{topic.lesson.summary}</p>
        </div>
        {topic.lesson.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
        {sentences && sentences.length > 0 && (
          <>
            <h3 className="lesson-h">이 문법이 쓰인 문장</h3>
            {sentences.map((s) => (
              <button key={s.id} className="lesson-sent" onClick={() => speak(s.en)}>
                <span className="lesson-en">{s.en}</span>
                <span className="lesson-ko">{s.ko}</span>
              </button>
            ))}
          </>
        )}
      </article>
      <div className="lesson-foot">
        {next ? (
          <Link to={`/grammar-dict/${next.id}`} replace className="lesson-next">
            {next.level.split('-')[1]}. {next.title} <Icon name="chevron" size={14} />
          </Link>
        ) : prev ? (
          <Link to={`/grammar-dict/${prev.id}`} replace className="lesson-next">
            <Icon name="back" size={14} /> {prev.level.split('-')[1]}. {prev.title}
          </Link>
        ) : (
          <span />
        )}
        <button className="lesson-list" onClick={() => nav('/grammar-dict')}>
          <Icon name="list" size={16} /> 목록으로
        </button>
      </div>
    </div>
  );
}

/** 문법 & 문장 검색 */
export default function GrammarDict() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'grammar' | 'sentence'>('grammar');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const topics = useLiveQuery(() => db.gtopics.orderBy('order').toArray(), []);
  const cats = useMemo(() => [...new Set((topics ?? []).map((t) => t.category))], [topics]);
  const [cat, setCat] = useState<string | null>(null);
  const curCat = cat ?? cats[0];
  const q = submitted.trim().toLowerCase();
  const sentences = useLiveQuery(async () => {
    if (tab !== 'sentence' || !q) return [];
    const g = (await db.gsentences.toArray()).filter((s) => s.en.toLowerCase().includes(q) || s.ko.includes(q)).slice(0, 60);
    return g;
  }, [tab, q]);

  const list = (topics ?? []).filter((t) => (q && tab === 'grammar' ? t.title.toLowerCase().includes(q) || t.category.includes(q) : t.category === curCat));

  return (
    <div className="vs-page dict-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 문법 &amp; 문장 검색
        </button>
      </header>
      <nav className="dict-tabs2">
        <button className={tab === 'grammar' ? 'active' : ''} onClick={() => setTab('grammar')}>
          문법 검색
        </button>
        <button className={tab === 'sentence' ? 'active' : ''} onClick={() => setTab('sentence')}>
          문장 검색
        </button>
      </nav>
      {tab === 'grammar' ? (
        <div className="gd-body">
          {!q && (
            <aside className="gd-cats">
              {cats.map((c) => (
                <button key={c} className={c === curCat ? 'active' : ''} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </aside>
          )}
          <ul className="gd-list">
            {list.map((t) => (
              <li key={t.id}>
                <Link to={`/grammar-dict/${t.id}`}>
                  <span>{t.title}</span>
                  <Icon name="chevron" size={16} />
                </Link>
              </li>
            ))}
            {topics && topics.length === 0 && <li className="empty-note">문법 데이터를 받는 중이에요.</li>}
          </ul>
        </div>
      ) : (
        <ul className="sent-results">
          {(sentences ?? []).map((s) => (
            <li key={s.id}>
              <Link to={`/grammar-dict/${s.topic}`}>
                <span className="lesson-en">{s.en}</span>
                <span className="lesson-ko">{s.ko}</span>
              </Link>
            </li>
          ))}
          {q && sentences && sentences.length === 0 && <li className="empty-note">검색 결과가 없어요.</li>}
          {!q && <li className="empty-note">영어나 한국어로 문장을 검색해 보세요.</li>}
        </ul>
      )}
      <form
        className="dict-searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query);
        }}
      >
        <input placeholder="검색어를 입력해 주세요." value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit">확인</button>
      </form>
    </div>
  );
}
