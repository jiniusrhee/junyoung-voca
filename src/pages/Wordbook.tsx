import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { MASTERY_KO, masteryOf } from '../lib/scheduler';
import { createWordbook, defaultBookName, deleteWordbook, removeFromWordbook, renameWordbook, useWordbooks } from '../lib/wordbook';

/** 내 단어장 목록 (말해보카: 이름 있는 단어장 여러 개) */
export default function Wordbook() {
  const nav = useNavigate();
  const books = useWordbooks();
  const [edit, setEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [help, setHelp] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const openCreate = () => {
    setName(defaultBookName((books?.length ?? 0) + 1));
    setCreating(true);
  };

  return (
    <div className="screen sub wb-page">
      <SubHeader
        title="내 단어장"
        right={
          <button className={`wb-edit ${edit ? 'on' : ''}`} onClick={() => setEdit((v) => !v)}>
            <Icon name="gear" size={18} /> {edit ? '완료' : '편집'}
          </button>
        }
      />
      <button className="wb-help" onClick={() => setHelp((v) => !v)} aria-label="도움말">
        ?
      </button>
      {help && <p className="vs-help-box">단어 정보 화면이나 목록의 ⋮ 메뉴에서 단어를 단어장에 담아요. 담은 단어는 어휘 학습에서 먼저 나와요.</p>}
      {books && books.length === 0 && (
        <div className="lw-empty">
          <Icon name="xcircle" size={28} />
          <p>내 단어장이 아직 없어요.</p>
        </div>
      )}
      <ul className="wb-list">
        {(books ?? []).map((b) => (
          <li key={b.id} className="wb-row">
            {renaming === b.id ? (
              <form
                className="wb-rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameWordbook(b.id, name);
                  setRenaming(null);
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={30} />
                <button type="submit" className="btn primary">
                  저장
                </button>
              </form>
            ) : (
              <button className="wb-main" onClick={() => (edit ? undefined : nav(`/wordbook/${b.id}`))}>
                <span className="wb-icon">
                  <Icon name="bookmark" size={20} />
                </span>
                <span className="wb-text">
                  <b>{b.name}</b>
                  <small>단어 {b.ids.length}개</small>
                </span>
                {!edit && <Icon name="chevron" size={18} className="muted-ic" />}
              </button>
            )}
            {edit && renaming !== b.id && (
              <span className="wb-actions">
                <button
                  onClick={() => {
                    setName(b.name);
                    setRenaming(b.id);
                  }}
                >
                  이름 바꾸기
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm(`'${b.name}' 단어장을 지울까요? 담긴 단어 ${b.ids.length}개도 함께 빠져요.`)) void deleteWordbook(b.id);
                  }}
                >
                  삭제
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {!edit && (
        <button className="wb-fab" onClick={openCreate}>
          <Icon name="plus" size={18} /> 새 단어장 만들기
        </button>
      )}
      {creating && (
        <div className="modal-dim" onClick={() => setCreating(false)}>
          <form
            className="opt-sheet wb-create"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void createWordbook(name).then(() => setCreating(false));
            }}
          >
            <h3>단어장 만들기</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
            <button type="submit" className="btn primary big">
              단어장 만들기
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** 단어장 하나: 담긴 단어 목록 */
export function WordbookDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const books = useWordbooks();
  const book = books?.find((b) => b.id === id);
  const ids = book?.ids ?? [];
  const rows = useLiveQuery(async () => {
    const words = await db.words.bulkGet(ids);
    const cards = await db.cards.bulkGet(ids);
    return ids.map((wid, i) => ({ id: wid, w: words[i], c: cards[i] })).filter((r) => r.w);
  }, [ids.join(',')]);

  if (books && !book) {
    return (
      <div className="screen sub">
        <SubHeader title="내 단어장" />
        <p className="empty-note">단어장을 찾을 수 없어요.</p>
      </div>
    );
  }
  return (
    <div className="screen sub wb-detail">
      <SubHeader title={book?.name ?? '내 단어장'} right={<span className="count-pill purple">{rows?.length ?? 0}</span>} />
      {rows && rows.length === 0 && <p className="empty-note">단어 정보 화면이나 목록의 ⋮ 메뉴에서 '단어장에 추가'를 누르면 여기에 모여요. 담은 단어는 어휘 학습에서 먼저 나와요.</p>}
      <ul className="dict-list">
        {(rows ?? []).map(({ id: wid, w, c }) => (
          <li key={wid}>
            <div className="dict-row">
              <Link to={`/words/${encodeURIComponent(wid)}`} className="dict-word">
                {w!.word}
              </Link>
              <span className="dict-mean">{w!.meanings[0]}</span>
              {c && <span className={`chip m-${masteryOf(c)}`}>{MASTERY_KO[masteryOf(c)]}</span>}
              <button className="icon-btn small" onClick={() => void removeFromWordbook(id, wid)} aria-label="단어장에서 빼기">
                <Icon name="close" size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {rows && rows.length > 0 && (
        <div className="nb-foot">
          <button className="btn primary big" onClick={() => nav(`/quiz?ids=${ids.join(',')}`)}>
            단어장 학습 ({rows.length}개) <Icon name="chevron" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
