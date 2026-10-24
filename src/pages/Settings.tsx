import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import Mascot from '../components/Mascot';
import VocabSettings from '../components/VocabSettings';
import { db } from '../db';
import { exportBackup, importBackup, resetAll } from '../lib/backup';
import { syncContent } from '../lib/content';
import { getImported, importedRange } from '../lib/imported';
import { saveSettings, useSettings } from '../lib/settings';

/** 말해보카 설정: /settings (메뉴), /settings/vocab (어휘 학습), /settings/data (데이터) */
export default function Settings() {
  const s = useSettings();
  const nav = useNavigate();
  const { section } = useParams();
  const firstDay = useLiveQuery(async () => {
    const local = (await db.daily.orderBy('date').first())?.date;
    const imp = importedRange(await getImported())?.from;
    return [local, imp].filter((x): x is string => !!x).sort()[0];
  }, []);
  if (!s) return null;

  const back = () => (window.history.length > 1 ? nav(-1) : nav('/'));
  const reset = async () => {
    if (!confirm('모든 학습 기록과 설정을 지웁니다. 되돌릴 수 없어요. 계속할까요?')) return;
    await resetAll();
    nav('/welcome', { replace: true });
  };

  if (section === 'vocab') {
    return <VocabSettings s={s} onBack={back} onRetest={() => nav('/test')} onReset={() => void reset()} />;
  }
  if (section === 'data') return <DataSettings onBack={back} />;

  const days = firstDay ? Math.floor((Date.now() - new Date(firstDay + 'T12:00:00').getTime()) / 86_400_000) + 1 : 1;
  const rename = () => {
    const n = prompt('이름을 입력하세요', s.nickname);
    if (n && n.trim()) void saveSettings({ nickname: n.trim().slice(0, 12) });
  };

  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={back}>
          <Icon name="back" size={22} /> 설정
        </button>
      </header>
      <button className="profile" onClick={rename}>
        <span className="profile-avatar">
          <Mascot size={86} />
        </span>
        <span className="profile-text">
          <b>{s.nickname}</b>
          <span>준영보카 {days}일째!</span>
        </span>
        <Icon name="chevron" size={20} className="muted-ic" />
      </button>
      <div className="stats-sep" />
      <h3 className="menu-title">설정</h3>
      <MenuRow icon="gear" tint="blue" title="화면" desc="다크 모드 설정, 학습 화면 테마" onClick={() => nav('/settings/mode/screen')} />
      <MenuRow icon="bell" tint="orange" title="알림" desc="학습 시간 알림, 방해 금지 시간" onClick={() => nav('/settings/mode/notice')} />
      <MenuRow icon="speaker" tint="orange" title="음성 및 효과음" desc="학습 음성 및 효과음 설정" onClick={() => nav('/settings/mode/voice')} />
      <MenuRow icon="star" tint="pink" title="즐겨찾기" desc="홈에 표시할 학습 모드 설정" onClick={() => nav('/settings/mode/favorites')} />
      <MenuRow icon="bookPerson" tint="purple" title="어휘 학습" desc="퀴즈 방식, 단어장 변경, 난이도 및 복습 단어 비율 조정" onClick={() => nav('/settings/vocab')} />
      <MenuRow icon="gbook" tint="blue" title="문법 학습" desc="일일 학습 목표, 음성 속도 및 볼륨 설정" onClick={() => nav('/settings/mode/grammar')} />
      <MenuRow icon="chat" tint="pink" title="표현 학습" desc="학습 설정, 음성 속도 및 볼륨 설정" onClick={() => nav('/settings/mode/expr')} />
      <MenuRow icon="talk" tint="purple" title="실전 회화 학습" desc="학습 설정, 음성 및 효과음 볼륨 설정" onClick={() => nav('/settings/mode/talk')} />
      <MenuRow icon="headphones" tint="orange" title="리스닝 학습" desc="학습 모드, 발음 인식 기준, 발음 구분 연습 설정" onClick={() => nav('/settings/mode/listening')} />
      <MenuRow icon="chart" tint="orange" title="어휘력 측정" desc="레벨 테스트 다시 하기" onClick={() => nav('/test')} />
      <MenuRow icon="note" tint="pink" title="계정 관리" desc="학습 기록 백업과 복원, 단어 데이터 업데이트, 초기화" onClick={() => nav('/settings/data')} />
      <MenuRow icon="clock" tint="blue" title="업데이트 히스토리" desc={`앱 버전: ${__APP_VERSION__}`} onClick={() => nav('/settings/mode/updates')} />
    </div>
  );
}

function MenuRow({ icon, tint, title, desc, onClick }: { icon: IconName; tint: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button className="menu-row" onClick={onClick}>
      <span className={`menu-icon ${tint}`}>
        <Icon name={icon} size={24} />
      </span>
      <span className="menu-text">
        <b>{title}</b>
        <span>{desc}</span>
      </span>
      <Icon name="chevron" size={18} className="muted-ic" />
    </button>
  );
}

function DataSettings({ onBack }: { onBack: () => void }) {
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const packs = useLiveQuery(() => db.packs.toArray(), []);
  const wordCount = useLiveQuery(() => db.words.count(), []);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    if (!confirm('현재 학습 기록을 백업 파일 내용으로 덮어씁니다. 계속할까요?')) return;
    setBusy('가져오는 중…');
    try {
      const r = await importBackup(f);
      setMsg(`복원 완료: 단어 기록 ${r.cards}개, 학습 로그 ${r.reviews}개`);
    } catch (e) {
      setMsg(`가져오기 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const onSync = async () => {
    setBusy('단어 데이터 확인 중…');
    try {
      const r = await syncContent();
      setMsg(r.updated.length ? `${r.updated.length}개 단어 팩을 업데이트했어요` : '이미 최신 상태예요');
    } catch {
      setMsg('업데이트 실패. 인터넷 연결을 확인해 주세요');
    } finally {
      setBusy(null);
    }
  };
  const onReset = async () => {
    if (!confirm('모든 학습 기록과 설정을 지웁니다. 되돌릴 수 없어요. 계속할까요?')) return;
    await resetAll();
    nav('/welcome', { replace: true });
  };

  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={onBack}>
          <Icon name="back" size={22} /> 데이터
        </button>
      </header>
      <section className="vs-sec">
        <h3>단어 데이터</h3>
        <p className="vs-help-box">
          단어 {wordCount ?? 0}개 · 단어 팩 {packs?.length ?? 0}개
        </p>
        <button className="vs-row" onClick={onSync} disabled={!!busy}>
          <span>단어 데이터 업데이트</span>
          <span className="vs-value">
            <Icon name="chevron" size={16} />
          </span>
        </button>
      </section>
      <section className="vs-sec">
        <h3>학습 기록</h3>
        <button className="vs-row" onClick={() => void exportBackup()}>
          <span>백업 파일 내보내기</span>
          <span className="vs-value">
            <Icon name="chevron" size={16} />
          </span>
        </button>
        <button className="vs-row" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          <span>백업 파일 가져오기</span>
          <span className="vs-value">
            <Icon name="chevron" size={16} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
        <p className="vs-help-box">학습 기록은 이 폰의 브라우저에만 저장돼요. 브라우저 데이터를 지우면 사라지니 가끔 백업 파일을 내보내 두세요.</p>
        {busy && <p className="vs-msg">{busy}</p>}
        {msg && <p className="vs-msg">{msg}</p>}
      </section>
      <section className="vs-sec">
        <h3>학습 관리</h3>
        <button className="vs-row danger" onClick={() => void onReset()}>
          <span>학습 기록 모두 지우기</span>
          <span className="vs-value">
            <Icon name="chevron" size={16} />
          </span>
        </button>
      </section>
    </div>
  );
}
