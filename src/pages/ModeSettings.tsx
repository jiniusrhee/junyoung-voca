import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { UPDATES } from '../updates';
import type { Settings, StudyMode } from '../types';

const GOALS = [5, 10, 15, 20, 30, 50];
const TITLES: Record<string, string> = {
  grammar: '문법 학습',
  expr: '표현 학습',
  talk: '실전 회화 학습',
  listening: '리스닝 학습',
  voice: '음성 및 효과음',
  favorites: '즐겨찾기',
  updates: '업데이트 히스토리',
};
const HOME_TABS: [StudyMode, string][] = [
  ['grammar', '문법'],
  ['expr', '표현'],
  ['talk', '실전 회화'],
  ['listening', '리스닝'],
];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg-full">
      {options.map(([v, label]) => (
        <button key={v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, desc, children, onClick }: { title: string; desc?: string; children?: React.ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="ms-row-text">
        <b>{title}</b>
        {desc && <span>{desc}</span>}
      </span>
      {children}
      {onClick && <Icon name="chevron" size={18} className="muted-ic" />}
    </>
  );
  return onClick ? (
    <button className="ms-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="ms-row">{body}</div>
  );
}

/** 설정 > 모드별 학습 설정 / 음성 / 즐겨찾기 / 업데이트 히스토리 (말해보카 설정 메뉴 구성) */
export default function ModeSettings() {
  const { mode = '' } = useParams();
  const nav = useNavigate();
  const s = useSettings();
  if (!s) return null;
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const goalRow = (key: 'grammarGoal' | 'exprGoal' | 'talkGoal' | 'listeningGoal') => (
    <Row title="1일 학습 목표" desc={`하루에 ${s[key]}문제`}>
      <div className="goal-grid">
        {GOALS.map((g) => (
          <button key={g} className={`chip-btn ${s[key] === g ? 'active' : ''}`} onClick={() => set({ [key]: g })}>
            {g}개
          </button>
        ))}
      </div>
    </Row>
  );
  const speedRow = (
    <Row title="원어민 음성 속도" desc="폰 내장 음성으로 읽어요">
      <Seg
        value={s.speechRate}
        options={[
          ['real', '실전 속도'],
          ['slow', '듣기 평가 속도'],
        ]}
        onChange={(v) => set({ speechRate: v })}
      />
    </Row>
  );

  return (
    <div className="vs-page ms-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> {TITLES[mode] ?? '설정'}
        </button>
      </header>

      {mode === 'grammar' && (
        <>
          {goalRow('grammarGoal')}
          {speedRow}
        </>
      )}
      {mode === 'expr' && (
        <>
          {goalRow('exprGoal')}
          <Row title="학습 코스" desc="일상 영어 / 여행 영어 × 필수 / 레벨 업" onClick={() => nav('/expr/courses')} />
          {speedRow}
        </>
      )}
      {mode === 'talk' && (
        <>
          {goalRow('talkGoal')}
          <Row title="학습 난이도" desc={`CEFR ${s.talkLevel} · 낮을수록 채점이 너그러워요`} onClick={() => nav('/talk/level')} />
          <Row title="내 차례 입력 방식">
            <Seg
              value={s.talkInput}
              options={[
                ['keyboard', '키보드'],
                ['voice', '음성'],
              ]}
              onChange={(v) => set({ talkInput: v })}
            />
          </Row>
          {speedRow}
        </>
      )}
      {mode === 'listening' && (
        <>
          {goalRow('listeningGoal')}
          <Row title="학습 모드">
            <Seg
              value={s.listeningMode}
              options={[
                ['mc', '객관식 모드'],
                ['subjective', '주관식 모드'],
              ]}
              onChange={(v) => set({ listeningMode: v })}
            />
          </Row>
          <Row title="원어민 음성 속도">
            <Seg
              value={s.listeningSpeed}
              options={[
                ['real', '실전 속도'],
                ['slow', '듣기 평가 속도'],
              ]}
              onChange={(v) => set({ listeningSpeed: v })}
            />
          </Row>
          <Row title="주관식 입력 방식">
            <Seg
              value={s.listeningInput}
              options={[
                ['voice', '음성'],
                ['keyboard', '키보드'],
              ]}
              onChange={(v) => set({ listeningInput: v })}
            />
          </Row>
          <Row title="발음 구분 연습" desc="f/p, l/r 같은 소리 구분" onClick={() => nav('/pairs')} />
        </>
      )}
      {mode === 'voice' && (
        <>
          {speedRow}
          <Row title="정답 후 자동 발음" desc="정답을 맞히면 예문을 바로 읽어줘요">
            <Seg
              value={s.autoSpeak ? 'on' : 'off'}
              options={[
                ['on', '켜기'],
                ['off', '끄기'],
              ]}
              onChange={(v) => set({ autoSpeak: v === 'on' })}
            />
          </Row>
          <button className="volume-check" onClick={() => speak('Hello! Can you hear me clearly?', s.speechRate === 'slow')}>
            <Icon name="speaker" size={18} /> 음성 들어보기
          </button>
          <p className="vs-help-box">원어민 녹음 대신 폰에 내장된 영어 음성을 써요. 폰 설정 &gt; 일반 &gt; 텍스트 음성 변환에서 영어 음성을 바꿀 수 있어요.</p>
        </>
      )}
      {mode === 'favorites' && (
        <>
          <p className="vs-help-box">홈 화면 오른쪽에 표시할 학습 모드를 고르세요. 어휘 학습은 항상 표시돼요.</p>
          {HOME_TABS.map(([m, label]) => {
            const on = !s.homeTabs || s.homeTabs.includes(m);
            return (
              <label key={m} className="ms-row toggle-row">
                <span className="ms-row-text">
                  <b>{label}</b>
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => {
                    const cur = s.homeTabs ?? HOME_TABS.map(([k]) => k);
                    set({ homeTabs: e.target.checked ? [...new Set([...cur, m])] : cur.filter((x) => x !== m) });
                  }}
                />
                <span className="toggle" />
              </label>
            );
          })}
        </>
      )}
      {mode === 'updates' && (
        <ul className="upd-list">
          {UPDATES.map((u) => (
            <li key={u.date + u.text}>
              <span>{u.date}</span>
              <p>{u.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
