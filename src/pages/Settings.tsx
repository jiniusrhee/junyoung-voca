import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import GoalModal from '../components/GoalModal';
import Icon from '../components/Icon';
import { db } from '../db';
import { exportBackup, importBackup, resetAll } from '../lib/backup';
import { syncContent } from '../lib/content';
import { clampLevel } from '../lib/levelLogic';
import { saveSettings, useSettings } from '../lib/settings';
import type { Settings as S } from '../types';

export default function Settings() {
  const s = useSettings();
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const packs = useLiveQuery(() => db.packs.toArray(), []);
  const wordCount = useLiveQuery(() => db.words.count(), []);
  if (!s) return null;

  const set = (patch: Partial<S>) => void saveSettings(patch);

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
    <div className="screen settings">
      <h1 className="page-title">설정</h1>

      <section className="info-card">
        <h3>어휘 학습</h3>
        <Row label="내 레벨" hint="새 단어가 나오는 범위예요. 학습 결과에 따라 자동으로도 조정돼요.">
          <div className="stepper">
            <button onClick={() => set({ level: clampLevel((s.level ?? 10) - 1) })}>−</button>
            <span>레벨 {s.level}</span>
            <button onClick={() => set({ level: clampLevel((s.level ?? 10) + 1) })}>+</button>
          </div>
        </Row>
        <Row label="하루 목표">
          <button className="goal-select" onClick={() => setGoalOpen(true)}>
            <b>{s.dailyGoal}개</b> <Icon name="caret" size={14} />
          </button>
        </Row>
        <Row label="새 단어 난이도">
          <Seg
            value={s.newWordDifficulty}
            options={[
              ['easy', '쉬운 위주'],
              ['normal', '보통'],
              ['hard', '어려운 위주'],
            ]}
            onChange={(v) => set({ newWordDifficulty: v as S['newWordDifficulty'] })}
          />
        </Row>
        <Row label="기본 입력 방식">
          <Seg
            value={s.inputMode}
            options={[
              ['keyboard', '키보드'],
              ['voice', '음성'],
            ]}
            onChange={(v) => set({ inputMode: v as S['inputMode'] })}
          />
        </Row>
        <Toggle label="정답을 다 입력하면 바로 채점" checked={s.autoCheck} onChange={(v) => set({ autoCheck: v })} />
        <Toggle label="빈칸 길이를 정답 길이에 맞추기" checked={s.blankMatchesLength} onChange={(v) => set({ blankMatchesLength: v })} />
        <Toggle label="정답 후 문장 읽어주기" checked={s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} />
        <Toggle label="듣기평가 속도로 읽기" checked={s.speechRate === 'slow'} onChange={(v) => set({ speechRate: v ? 'slow' : 'real' })} />
        <button className="btn line full" onClick={() => nav('/test')}>
          레벨 테스트 다시 하기
        </button>
      </section>

      <section className="info-card">
        <h3>데이터</h3>
        <p className="muted small">
          단어 {wordCount ?? 0}개 · 단어 팩 {packs?.length ?? 0}개
        </p>
        <div className="btn-col">
          <button className="btn line" onClick={onSync} disabled={!!busy}>
            단어 데이터 업데이트
          </button>
          <button className="btn line" onClick={() => void exportBackup()}>
            학습 기록 백업 내보내기
          </button>
          <button className="btn line" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            백업 파일 가져오기
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
        {busy && <p className="muted small">{busy}</p>}
        {msg && <p className="small">{msg}</p>}
        <p className="muted small">학습 기록은 이 폰의 브라우저에만 저장돼요. 브라우저 데이터를 지우면 사라지니 가끔 백업 파일을 내보내 두세요.</p>
      </section>

      <section className="info-card danger-zone">
        <h3>초기화</h3>
        <button className="btn danger full" onClick={onReset}>
          학습 기록 모두 지우기
        </button>
      </section>

      {goalOpen && (
        <GoalModal
          current={s.dailyGoal}
          onClose={() => setGoalOpen(false)}
          onSave={(n) => {
            set({ dailyGoal: n });
            setGoalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label">
        <span>{label}</span>
        {hint && <span className="muted tiny">{hint}</span>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function Seg({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle" />
    </label>
  );
}
