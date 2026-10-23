import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { masteryOf, MASTERY_KO } from '../lib/scheduler';
import { toggleWordbook, useWordbook } from '../lib/wordbook';

/** 내 단어장 */
export default function Wordbook() {
  const ids = useWordbook();
  const rows = useLiveQuery(async () => {
    if (!ids) return undefined;
    const words = await db.words.bulkGet(ids);
    const cards = await db.cards.bulkGet(ids);
    return ids.map((id, i) => ({ id, w: words[i], c: cards[i] })).filter((r) => r.w);
  }, [ids?.join(',')]);

  return (
    <div className="screen sub">
      <SubHeader title="내 단어장" right={<span className="count-pill purple">{rows?.length ?? 0}</span>} />
      {rows && rows.length === 0 && <p className="empty-note">단어 정보 화면에서 '단어장에 추가'를 누르면 여기에 모여요. 담은 단어는 어휘 학습에서 먼저 나와요.</p>}
      <ul className="dict-list">
        {(rows ?? []).map(({ id, w, c }) => (
          <li key={id}>
            <div className="dict-row">
              <Link to={`/words/${encodeURIComponent(id)}`} className="dict-word">
                {w!.word}
              </Link>
              <span className="dict-mean">{w!.meanings[0]}</span>
              {c && <span className={`chip m-${masteryOf(c)}`}>{MASTERY_KO[masteryOf(c)]}</span>}
              <button className="icon-btn small" onClick={() => void toggleWordbook(id)} aria-label="단어장에서 빼기">
                <Icon name="close" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
