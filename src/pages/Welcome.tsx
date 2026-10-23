import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import { db } from '../db';
import { syncContent } from '../lib/content';

export default function Welcome() {
  const nav = useNavigate();
  const count = useLiveQuery(() => db.words.count(), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const retry = async () => {
    setBusy(true);
    setErr(null);
    try {
      await syncContent();
    } catch {
      setErr('받기에 실패했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="welcome">
      <div className="welcome-top">
        <p className="welcome-kicker">문장으로 뉘앙스까지 한 번에</p>
        <h1>준영보카</h1>
        <Mascot size={150} mood="cheer" />
      </div>
      <div className="welcome-card">
        <p className="welcome-title">20문제만 풀면 내 레벨을 찾아드려요</p>
        <p className="welcome-desc">모르는 단어는 힌트 보기나 정답 보기를 눌러도 괜찮아요. 테스트에서 푼 단어도 학습 기록에 남아요.</p>
        {count === undefined ? (
          <p className="muted">준비 중…</p>
        ) : count === 0 ? (
          <>
            <p className="muted small">{busy ? '단어 데이터를 받는 중…' : '단어 데이터가 아직 없어요.'}</p>
            {err && <p className="msg-warn">{err}</p>}
            <button className="btn primary big" onClick={retry} disabled={busy}>
              단어 데이터 받기
            </button>
          </>
        ) : (
          <button className="btn primary big" onClick={() => nav('/test')}>
            레벨 테스트 시작
          </button>
        )}
        <p className="muted tiny center-text">단어 {count ?? 0}개 준비됨</p>
      </div>
    </div>
  );
}
