import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import SubHeader from '../components/SubHeader';
import { db } from '../db';
import { GRAMMAR_BOOKMARKS, createFolder, deleteFolder, removeFromFolder, renameFolder, useFolders } from '../lib/folders';
import { speak } from '../lib/speech';

const KEY = GRAMMAR_BOOKMARKS;

/** 문법 북마크: 이름 있는 북마크 폴더 여러 개 (말해보카 '문법 북마크' — 내 단어장과 같은 구조) */
export default function GBookmarks() {
  const nav = useNavigate();
  const folders = useFolders(KEY);
  const [edit, setEdit] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);

  const openCreate = () => {
    setName(`${(folders?.length ?? 0) + 1}. 북마크`);
    setCreating(true);
  };

  return (
    <div className="screen sub wb-page">
      <SubHeader
        title="문법 북마크"
        right={
          <button className={`wb-edit ${edit ? 'on' : ''}`} onClick={() => setEdit((v) => !v)}>
            <Icon name="gear" size={18} /> {edit ? '완료' : '편집'}
          </button>
        }
      />
      {folders && folders.length === 0 && (
        <div className="lw-empty">
          <Icon name="info" size={28} />
          <p>내가 만든 북마크가 아직 없어요.</p>
        </div>
      )}
      <ul className="wb-list">
        {(folders ?? []).map((f) => (
          <li key={f.id} className="wb-row">
            {renaming === f.id ? (
              <form
                className="wb-rename"
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameFolder(KEY, f.id, name);
                  setRenaming(null);
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={30} />
                <button type="submit" className="btn primary">
                  저장
                </button>
              </form>
            ) : (
              <button className="wb-main" onClick={() => (edit ? undefined : nav(`/bookmarks/grammar/${f.id}`))}>
                <span className="wb-icon">
                  <Icon name="bookmark" size={20} />
                </span>
                <span className="wb-text">
                  <b>{f.name}</b>
                  <small>문장 {f.ids.length}개</small>
                </span>
                {!edit && <Icon name="chevron" size={18} className="muted-ic" />}
              </button>
            )}
            {edit && renaming !== f.id && (
              <span className="wb-actions">
                <button
                  onClick={() => {
                    setName(f.name);
                    setRenaming(f.id);
                  }}
                >
                  이름 바꾸기
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm(`'${f.name}' 북마크를 지울까요? 담긴 문장 ${f.ids.length}개도 함께 빠져요.`)) void deleteFolder(KEY, f.id);
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
          <Icon name="plus" size={18} /> 새 북마크 만들기
        </button>
      )}
      {creating && (
        <div className="modal-dim" onClick={() => setCreating(false)}>
          <form
            className="opt-sheet wb-create"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void createFolder(KEY, name).then(() => setCreating(false));
            }}
          >
            <h3>북마크 만들기</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus />
            <button type="submit" className="btn primary big">
              북마크 만들기
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** 북마크 폴더 하나: 담긴 문법 문장 목록 */
export function GBookmarkDetail() {
  const { id = '' } = useParams();
  const folders = useFolders(KEY);
  const folder = folders?.find((f) => f.id === id);
  const ids = folder?.ids ?? [];
  const rows = useLiveQuery(async () => {
    const sents = await db.gsentences.bulkGet(ids);
    const topics = new Map((await db.gtopics.toArray()).map((t) => [t.id, t]));
    return ids.map((sid, i) => ({ id: sid, s: sents[i], topic: sents[i] ? topics.get(sents[i].topic) : undefined })).filter((r) => r.s);
  }, [ids.join(',')]);
  const [menu, setMenu] = useState<string | null>(null);

  return (
    <div className="screen sub lw-page">
      <SubHeader title={folder?.name ?? '문법 북마크'} />
      {rows && rows.length === 0 && (
        <div className="lw-empty">
          <Icon name="info" size={28} />
          <p>담긴 문장이 없어요.</p>
        </div>
      )}
      <div className="lw-list">
        {(rows ?? []).map((r) => (
          <div key={r.id} className="lw-card">
            <button className="lw-body" onClick={() => speak(r.s!.en)}>
              <b className="lw-en">{r.s!.en}</b>
              <span className="lw-ko">{r.s!.ko}</span>
              {r.topic && (
                <span className="lw-log">
                  레벨 {r.topic.level} · {r.topic.title}
                </span>
              )}
            </button>
            <button className="lw-more" onClick={() => setMenu((m) => (m === r.id ? null : r.id))} aria-label="더 보기">
              ⋮
            </button>
            {menu === r.id && (
              <div className="lw-pop">
                <button onClick={() => speak(r.s!.en)}>
                  <Icon name="speaker" size={16} /> 발음 듣기
                </button>
                <button
                  onClick={() => {
                    void removeFromFolder(KEY, id, r.id);
                    setMenu(null);
                  }}
                >
                  <Icon name="xcircle" size={16} /> 북마크에서 빼기
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
