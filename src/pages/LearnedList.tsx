import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { listenPool } from '../lib/listening';
import { toggleBookmark } from '../lib/modeStudy';
import { speak } from '../lib/speech';
import { formatAfter } from '../lib/time';
import type { StudyMode } from '../types';

interface Item {
  id: string;
  en: string;
  ko: string;
  sub?: string;
  link?: string;
  due?: Date;
  marked: boolean;
}

/** 내가 학습한 문법/문장, 북마크 목록 */
export default function LearnedList({ kind }: { kind: 'learned' | 'bookmarks' }) {
  const { mode = 'grammar' } = useParams();
  const m = mode as StudyMode;
  const items = useLiveQuery(async () => {
    const marks = new Set((await db.bookmarks.where('mode').equals(m).toArray()).map((b) => b.itemId));
    const ids =
      kind === 'learned'
        ? (await db.mcards.where('mode').equals(m).toArray()).sort((a, b) => (b.last_review?.getTime() ?? 0) - (a.last_review?.getTime() ?? 0))
        : (await db.bookmarks.where('mode').equals(m).reverse().sortBy('ts')).map((b) => ({ itemId: b.itemId, due: undefined as Date | undefined }));
    const out: Item[] = [];
    if (m === 'grammar') {
      const topics = new Map((await db.gtopics.toArray()).map((t) => [t.id, t]));
      for (const c of ids) {
        const s = await db.gsentences.get(c.itemId);
        if (!s) continue;
        const t = topics.get(s.topic);
        out.push({ id: s.id, en: s.en, ko: s.ko, sub: t ? `레벨 ${t.level} · ${t.title}` : undefined, link: `/grammar-dict/${s.topic}`, due: c.due, marked: marks.has(s.id) });
      }
    } else {
      const pool = new Map((await listenPool()).map((p) => [p.id, p]));
      for (const c of ids) {
        const p = pool.get(c.itemId);
        if (p) out.push({ id: p.id, en: p.en, ko: p.ko, sub: `레벨 ${p.level}`, due: c.due, marked: marks.has(p.id) });
      }
    }
    return out;
  }, [m, kind]);

  const title = kind === 'bookmarks' ? '북마크' : m === 'grammar' ? '내가 학습한 문법' : '내가 학습한 문장';

  return (
    <div className="screen sub">
      <SubHeader title={title} right={<span className="count-pill purple">{items?.length ?? 0}</span>} />
      {items && items.length === 0 && <p className="empty-note">{kind === 'bookmarks' ? '학습 화면에서 북마크한 문장이 여기에 모여요.' : '아직 학습한 문장이 없어요.'}</p>}
      {(items ?? []).map((it) => (
        <div key={it.id} className="sent-item">
          {it.sub && (
            <p className="ctx">
              {it.link ? <Link to={it.link}>{it.sub}</Link> : it.sub}
              {it.due && <span> · {formatAfter(it.due)} 복습</span>}
            </p>
          )}
          <p className="sent-en">{it.en}</p>
          <p className="sent-ko">{it.ko}</p>
          <div className="sent-actions">
            <button className="icon-btn small" onClick={() => speak(it.en)} aria-label="듣기">
              <Icon name="speaker" size={18} />
            </button>
            <button className={`icon-btn small ${it.marked ? 'pink' : ''}`} onClick={() => void toggleBookmark(m, it.id)} aria-label="북마크">
              <Icon name="bookmark" size={18} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
