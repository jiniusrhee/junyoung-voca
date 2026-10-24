import { useState, type ReactNode } from 'react';
import { clampLevel } from '../lib/levelLogic';
import { saveSettings } from '../lib/settings';
import type { Settings } from '../types';
import GoalModal from './GoalModal';
import Icon from './Icon';

type Option<T extends string> = [T, string];

const THEME_OPTS: Option<Settings['theme']>[] = [
  ['system', '시스템 설정 따르기'],
  ['dark', '켜기'],
  ['light', '끄기'],
];
const DIFF_OPTS: Option<Settings['newWordDifficulty']>[] = [
  ['easy', '쉬운 단어를 더 많이'],
  ['normal', '보통'],
  ['hard', '어려운 단어를 더 많이'],
];
const INPUT_OPTS: Option<Settings['inputMode']>[] = [
  ['keyboard', '키보드 모드'],
  ['voice', '음성 모드'],
];
const STUDY_THEME_OPTS: Option<Settings['studyTheme']>[] = [
  ['dino', '다이노를 찾아서'],
  ['sky', '하늘'],
];
const SPEECH_OPTS: Option<Settings['speechLevel']>[] = [
  ['loose', '느슨하게'],
  ['normal', '보통'],
  ['strict', '엄격하게'],
];
const RATIO_OPTS: Option<Settings['reviewRatio']>[] = [
  ['normal', '일반 모드'],
  ['more', '복습 우선'],
  ['less', '새 단어 우선'],
];
const SPEED_OPTS: Option<Settings['speechRate']>[] = [
  ['real', '실전 속도'],
  ['slow', '듣기평가 속도'],
];

interface Props {
  s: Settings;
  onBack: () => void;
  onRetest?: () => void;
  onReset?: () => void;
}

/** 말해보카 '어휘 학습' 설정 화면 (퀴즈 톱니바퀴 / 설정 메뉴에서 열림) */
export default function VocabSettings({ s, onBack, onRetest, onReset }: Props) {
  const [help, setHelp] = useState(true);
  const [picker, setPicker] = useState<null | { title: string; value: string; options: Option<string>[]; onPick: (v: string) => void }>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const label = <T extends string>(opts: Option<T>[], v: T) => opts.find((o) => o[0] === v)?.[1] ?? v;
  const open = <T extends string>(title: string, value: T, options: Option<T>[], onPick: (v: T) => void) =>
    setPicker({ title, value, options, onPick: (v) => onPick(v as T) });

  return (
    <div className="vs-page">
      <header className="vs-head">
        <button className="vs-back" onClick={onBack}>
          <Icon name="back" size={22} /> 어휘 학습
        </button>
        <label className="vs-help">
          도움말 보기
          <input type="checkbox" checked={help} onChange={(e) => setHelp(e.target.checked)} />
          <span className="toggle" />
        </label>
      </header>

      <section className="vs-sec">
        <h3>화면 설정</h3>
        <Row label="다크모드" value={label(THEME_OPTS, s.theme)} onClick={() => open('다크모드', s.theme, THEME_OPTS, (v) => set({ theme: v }))} />
        <Row label="학습테마" value={label(STUDY_THEME_OPTS, s.studyTheme)} onClick={() => open('학습테마', s.studyTheme, STUDY_THEME_OPTS, (v) => set({ studyTheme: v }))} />
      </section>

      <section className="vs-sec">
        <h3>학습 설정</h3>
        <Row label="퀴즈 방식" value={label(INPUT_OPTS, s.inputMode)} onClick={() => open('퀴즈 방식', s.inputMode, INPUT_OPTS, (v) => set({ inputMode: v }))} />
        {help && <Help>퀴즈를 시작할 때 키보드로 입력할지, 말로 답할지 정할 수 있어요. 학습 화면에서도 언제든 바꿀 수 있어요.</Help>}
        <Row label="발음인식 기준" value={label(SPEECH_OPTS, s.speechLevel)} onClick={() => open('발음인식 기준', s.speechLevel, SPEECH_OPTS, (v) => set({ speechLevel: v }))} />
        {help && <Help>말해보기에서 발음을 얼마나 엄격하게 채점할지 정해요.</Help>}
        <Row
          label="새 단어 난이도"
          value={label(DIFF_OPTS, s.newWordDifficulty)}
          onClick={() => open('새 단어 난이도', s.newWordDifficulty, DIFF_OPTS, (v) => set({ newWordDifficulty: v }))}
        />
        {help && <Help>나의 학습 성향에 맞춰 단어 난이도를 변경할 수 있어요. 내가 가장 재밌게 학습할 수 있는 난이도를 선택해 보세요.</Help>}
        <Row label="1일 학습 목표" value={`${s.dailyGoal}개`} onClick={() => setGoalOpen(true)} />
        <div className="vs-row">
          <span>내 레벨</span>
          <div className="stepper">
            <button onClick={() => set({ level: clampLevel((s.level ?? 10) - 1) })} aria-label="레벨 낮추기">
              −
            </button>
            <span>레벨 {s.level ?? '-'}</span>
            <button onClick={() => set({ level: clampLevel((s.level ?? 10) + 1) })} aria-label="레벨 높이기">
              +
            </button>
          </div>
        </div>
        {help && <Help>새 단어가 나오는 범위예요. 학습 결과에 따라 자동으로도 조정돼요.</Help>}
        <Row label="복습 단어 비율" value={label(RATIO_OPTS, s.reviewRatio)} onClick={() => open('복습 단어 비율', s.reviewRatio, RATIO_OPTS, (v) => set({ reviewRatio: v }))} />
        {help && <Help>새 단어와 복습 단어가 나오는 비율이에요. 복습 우선은 복습할 단어를 먼저 모두 내 줘요.</Help>}
      </section>

      <section className="vs-sec">
        <h3>음성 속도 및 크기</h3>
        <Row label="원어민 음성 속도" value={label(SPEED_OPTS, s.speechRate)} onClick={() => open('원어민 음성 속도', s.speechRate, SPEED_OPTS, (v) => set({ speechRate: v }))} />
        <Toggle label="정답 후 문장 읽어주기" checked={s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} />
        {help && <Help>문장 읽기는 폰에 내장된 음성을 사용해요.</Help>}
      </section>

      {(onRetest || onReset) && (
        <section className="vs-sec">
          <h3>학습 관리</h3>
          {onRetest && <Row label="어휘력 측정 (레벨 테스트) 다시 하기" onClick={onRetest} />}
          {onReset && <Row label="어휘 학습 초기화" danger onClick={onReset} />}
        </section>
      )}

      {picker && (
        <div className="sheet-dim" onClick={() => setPicker(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" />
            <p className="sheet-title">{picker.title}</p>
            {picker.options.map(([v, l]) => (
              <button
                key={v}
                className={`pick-row ${v === picker.value ? 'sel' : ''}`}
                onClick={() => {
                  picker.onPick(v);
                  setPicker(null);
                }}
              >
                {l}
                {v === picker.value && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </div>
      )}
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

function Row({ label, value, onClick, danger }: { label: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`vs-row ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span>{label}</span>
      <span className="vs-value">
        {value}
        <Icon name="chevron" size={16} />
      </span>
    </button>
  );
}

function Help({ children }: { children: ReactNode }) {
  return <p className="vs-help-box">{children}</p>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="vs-row toggle-row">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle" />
    </label>
  );
}
