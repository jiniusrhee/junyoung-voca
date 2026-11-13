import { useEffect, useState, type ReactNode } from 'react';
import { isNativeApp, nativeNotifyPermission, nativeNotifyRequest } from '../lib/nativeNotify';
import { useNavigate, useParams } from 'react-router-dom';
import GoalModal, { MODE_PRESETS } from '../components/GoalModal';
import { HTabExpr, HTabGrammar, HTabListen, HTabTalk } from '../components/HomeIcons';
import Icon from '../components/Icon';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { UPDATES } from '../updates';
import type { Settings, StudyMode } from '../types';

type Option<T extends string> = [T, string];

const THEME_OPTS: Option<Settings['theme']>[] = [
  ['system', '시스템 설정 따르기'],
  ['dark', '켜기'],
  ['light', '끄기'],
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
const ACCENT_OPTS: Option<Settings['voiceAccent']>[] = [
  ['us', '미국식'],
  ['uk', '영국식'],
];
const GENDER_OPTS: Option<Settings['voiceGender']>[] = [
  ['random', '랜덤'],
  ['male', '남성'],
  ['female', '여성'],
];
const SPEED_OPTS: Option<Settings['speechRate']>[] = [
  ['real', '실전 속도'],
  ['slow', '듣기 평가 속도'],
];
const TALK_INPUT_OPTS: Option<Settings['talkInput']>[] = [
  ['keyboard', '키보드'],
  ['voice', '음성'],
];
const LISTEN_MODE_OPTS: Option<Settings['listeningMode']>[] = [
  ['mc', '객관식 모드'],
  ['subjective', '주관식 모드'],
];
const LISTEN_INPUT_OPTS: Option<Settings['listeningInput']>[] = [
  ['voice', '음성'],
  ['keyboard', '키보드'],
];
const MODE_LABEL: Record<'vocab' | 'grammar' | 'expr' | 'talk' | 'listening', string> = { vocab: '어휘 학습', grammar: '문법 학습', expr: '표현 학습', talk: '실전 회화 학습', listening: '리스닝 학습' };
const TITLES: Record<string, string> = {
  grammar: '문법 학습',
  expr: '표현 학습',
  talk: '실전 회화 학습',
  listening: '리스닝 학습',
  voice: '음성 및 효과음',
  favorites: '즐겨찾기',
  updates: '업데이트 히스토리',
  screen: '화면',
  theme: '학습 테마',
  notice: '알림',
  studynotice: '학습 알림',
  dnd: '방해 금지 시간',
};
/** 즐겨찾기(홈 모드 탭)에 올릴 수 있는 학습: 동그란 그림의 색은 말해보카 실측 */
const HOME_TABS: { mode: StudyMode; label: string; color: string; icon: ReactNode }[] = [
  { mode: 'grammar', label: '문법 학습', color: '#70a6ca', icon: <HTabGrammar /> },
  { mode: 'expr', label: '표현 학습', color: '#e07f96', icon: <HTabExpr /> },
  { mode: 'talk', label: '실전 회화 학습', color: '#9ab261', icon: <HTabTalk /> },
  { mode: 'listening', label: '리스닝 학습', color: '#f1a15e', icon: <HTabListen /> },
];

const label = <T extends string>(opts: Option<T>[], v: T) => opts.find((o) => o[0] === v)?.[1] ?? v;

/* ---- 줄 (말해보카 설정 화면 공통: 46 간격, 이름 15px · 값 13px · '>' — 치수는 styles/subhead.css 의 .vs-row) ---- */
function Row({ title, value, onClick, children }: { title: string; value?: string; onClick?: () => void; children?: ReactNode }) {
  const body = (
    <>
      <span>{title}</span>
      {children}
      {onClick && (
        <span className="vs-value">
          {value}
          <Icon name="chevron" size={16} />
        </span>
      )}
    </>
  );
  return onClick ? (
    <button className="vs-row" onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className="vs-row">{body}</div>
  );
}

function ToggleRow({ title, checked, onChange, help }: { title: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="vs-row toggle-row">
      <span className="vs-row-label">
        {title}
        {help && (
          <i className="vs-q" title={help}>
            ?
          </i>
        )}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle" />
    </label>
  );
}

/** 소리 크기 줄: 스피커 그림(16 x 12.67) + 가는 막대(높이 4) + 동그란 손잡이(13.33) */
function SliderRow({ title, value, onChange }: { title: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="vs-row slider-row">
      <span>{title}</span>
      <svg className="vs-spk" width="16" height="12.667" viewBox="0 0 16 12.667" aria-hidden="true">
        <path d="M0.800 4.300h2.500l3.700-3.300c0.500-0.450 1.300-0.100 1.300 0.600v9.467c0 0.700-0.800 1.050-1.300 0.600l-3.700-3.300H0.800a0.800 0.800 0 0 1-0.800-0.800V5.100a0.800 0.800 0 0 1 0.800-0.800z" fill="currentColor" />
        <path d="M10.300 4.000c0.900 0.600 1.400 1.400 1.400 2.333s-0.500 1.733-1.400 2.333M12.300 1.700c1.700 1.100 2.700 2.700 2.700 4.633s-1.000 3.533-2.700 4.633" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" />
      </svg>
      <input type="range" min={0} max={1} step={0.05} value={value} style={{ '--v': `${value * 100}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Help({ children }: { children: ReactNode }) {
  return <p className="vs-help-box">{children}</p>;
}

/** 설정 > 화면 / 알림 / 음성 및 효과음 / 모드별 학습 설정 / 즐겨찾기 / 업데이트 히스토리 (말해보카 설정 메뉴 구성, 플립 실측 2026-11-13) */
export default function ModeSettings() {
  const { mode = '' } = useParams();
  const nav = useNavigate();
  const s = useSettings();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported' | 'prompt'>(isNativeApp() ? 'prompt' : typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [picker, setPicker] = useState<null | { title: string; value: string; options: Option<string>[]; onPick: (v: string) => void }>(null);
  const [goalKey, setGoalKey] = useState<null | 'grammarGoal' | 'exprGoal' | 'talkGoal' | 'listeningGoal'>(null);
  // 즐겨찾기: '확인'을 눌러야 적용된다 (그 전까지는 여기 든 값만 바뀐다)
  const [favDraft, setFavDraft] = useState<null | { tabs: StudyMode[]; left: boolean }>(null);
  useEffect(() => {
    if (isNativeApp()) void nativeNotifyPermission().then((p) => setPerm(p === 'prompt' ? 'default' : p));
  }, []);
  if (!s) return null;
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const open = <T extends string>(title: string, value: T, options: Option<T>[], onPick: (v: T) => void) => setPicker({ title, value, options, onPick: (v) => onPick(v as T) });
  const askPermission = () => {
    if (isNativeApp()) {
      void nativeNotifyRequest().then((p) => setPerm(p === 'prompt' ? 'default' : p));
      return;
    }
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then(setPerm);
  };

  const themeRows = (
    <section className="vs-sec">
      <h3>화면 설정</h3>
      <Row title="다크모드" value={label(THEME_OPTS, s.theme)} onClick={() => open('다크모드', s.theme, THEME_OPTS, (v) => set({ theme: v }))} />
      <Row title="학습테마" value={label(STUDY_THEME_OPTS, s.studyTheme)} onClick={() => open('학습테마', s.studyTheme, STUDY_THEME_OPTS, (v) => set({ studyTheme: v }))} />
    </section>
  );
  const goalRow = (key: 'grammarGoal' | 'exprGoal' | 'talkGoal' | 'listeningGoal') => <Row title="1일 학습 목표" value={`${s[key]}개`} onClick={() => setGoalKey(key)} />;
  const speechRow = <Row title="발음인식 기준" value={label(SPEECH_OPTS, s.speechLevel)} onClick={() => open('발음인식 기준', s.speechLevel, SPEECH_OPTS, (v) => set({ speechLevel: v }))} />;
  const accentRow = <Row title="원어민 발음" value={label(ACCENT_OPTS, s.voiceAccent)} onClick={() => open('원어민 발음', s.voiceAccent, ACCENT_OPTS, (v) => set({ voiceAccent: v }))} />;
  const genderRow = <Row title="원어민 음성 성별" value={label(GENDER_OPTS, s.voiceGender)} onClick={() => open('원어민 음성 성별', s.voiceGender, GENDER_OPTS, (v) => set({ voiceGender: v }))} />;
  const speedRow = <Row title="원어민 음성 속도" value={label(SPEED_OPTS, s.speechRate)} onClick={() => open('원어민 음성 속도', s.speechRate, SPEED_OPTS, (v) => set({ speechRate: v }))} />;
  const listenSpeedRow = (
    <Row title="원어민 음성 속도" value={label(SPEED_OPTS, s.listeningSpeed)} onClick={() => open('원어민 음성 속도', s.listeningSpeed, SPEED_OPTS, (v) => set({ listeningSpeed: v }))} />
  );
  const soundCommon = (
    <>
      <SliderRow title="음성" value={s.ttsVolume} onChange={(v) => set({ ttsVolume: v })} />
      <SliderRow title="효과음" value={s.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
      <SliderRow title="키 입력 시 소리" value={s.keySoundVolume} onChange={(v) => set({ keySoundVolume: v })} />
      <ToggleRow title="키 입력 시 진동" checked={s.keyVibrate} onChange={(v) => set({ keyVibrate: v })} />
      <ToggleRow title="연속 학습 달성 시 진동" checked={s.streakVibrate} onChange={(v) => set({ streakVibrate: v })} />
      <ToggleRow title="앱 무음 모드로 시작하기" checked={s.muteStart} onChange={(v) => set({ muteStart: v })} help="앱을 열 때 소리를 끈 상태로 시작해요." />
    </>
  );
  const manage = (
    <section className="vs-sec">
      <h3>학습 관리</h3>
      <Row title="학습 기록 관리" onClick={() => nav('/settings/data')} />
    </section>
  );

  const fav = favDraft ?? { tabs: s.homeTabs ?? HOME_TABS.map((t) => t.mode), left: !!s.leftHanded };
  const favDirty = !!favDraft;

  return (
    <div className={`vs-page ms-page ms2 ms-${mode}`}>
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> {TITLES[mode] ?? '설정'}
        </button>
      </header>

      {mode === 'screen' && (
        <>
          <section className="vs-sec">
            <h3>다크 모드 설정</h3>
            <div className="dm-cards">
              {(
                [
                  ['light', '라이트 모드'],
                  ['dark', '다크 모드'],
                  ['system', '시스템 설정'],
                ] as const
              ).map(([v, name]) => (
                <button key={v} className={`dm-card ${v} ${s.theme === v ? 'sel' : ''}`} onClick={() => set({ theme: v })}>
                  <span className="dm-thumb">
                    <span className="dm-sheet">
                      <i />
                      <i />
                    </span>
                    <span className="dm-sheet next" />
                  </span>
                  <span className="dm-name">{name}</span>
                  <span className="dm-radio" />
                </button>
              ))}
            </div>
          </section>
          <section className="vs-sec">
            <h3>학습 화면 설정</h3>
            <Row title="학습 테마" value={label(STUDY_THEME_OPTS, s.studyTheme)} onClick={() => nav('/settings/mode/theme')} />
          </section>
        </>
      )}
      {mode === 'theme' && (
        <div className="theme-cards">
          {(
            [
              ['dino', '다이노를 찾아서', '공룡이 사는 초록 들판'],
              ['sky', '하늘', '맑은 하늘색 기본 화면'],
            ] as const
          ).map(([v, name, desc]) => (
            <button key={v} className={`theme-card ${v} ${s.studyTheme === v ? 'sel' : ''}`} onClick={() => set({ studyTheme: v })}>
              <span className="theme-thumb" />
              <span className="theme-text">
                <b>{name}</b>
                <small>{desc}</small>
              </span>
              <span className="theme-tag">{s.studyTheme === v ? '사용 중' : 'MY'}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'notice' && (
        <section className="vs-sec plain">
          {perm !== 'granted' && (
            <button className="notice-banner" onClick={askPermission}>
              <svg className="notice-warn" width="23" height="21.333" viewBox="0 0 23 21.333" aria-hidden="true">
                <path d="M9.300 1.300c1.000-1.700 3.400-1.700 4.400 0l8.900 15.900c1.000 1.700-0.250 3.900-2.200 3.900H2.600c-1.950 0-3.200-2.200-2.200-3.900z" fill="#d9b354" />
                <rect x="10.300" y="6.200" width="2.400" height="7.400" rx="1.200" fill="#2e3136" />
                <circle cx="11.500" cy="16.700" r="1.450" fill="#2e3136" />
              </svg>
              <span className="notice-text">
                <b>{perm === 'unsupported' ? '이 브라우저는 알림을 지원하지 않아요.' : '기기의 알림 설정이 꺼져 있어요!'}</b>
                <small>설정을 변경하고 학습에 도움이 되는 알림을 받아 보세요.</small>
              </span>
              <Icon name="chevron" size={14} className="muted-ic" />
            </button>
          )}
          <Row title="학습 알림" value={s.notifyStudy ? s.notifyTime : ''} onClick={() => nav('/settings/mode/studynotice')} />
          <Row title="방해 금지 시간" value={s.dndOn ? `${s.dndFrom} ~ ${s.dndTo}` : ''} onClick={() => nav('/settings/mode/dnd')} />
        </section>
      )}
      {mode === 'studynotice' && (
        <section className="vs-sec plain">
          <ToggleRow
            title="학습 알림 받기"
            checked={s.notifyStudy}
            onChange={(v) => {
              set({ notifyStudy: v });
              if (v) askPermission();
            }}
          />
          <Row title="알림 시간">
            <input type="time" className="time-input" value={s.notifyTime} onChange={(e) => set({ notifyTime: e.target.value })} />
          </Row>
          <Help>{isNativeApp() ? '정한 시각에 매일 알림을 보내요. 앱이 꺼져 있어도 울려요.' : '정한 시각에 오늘 학습이 없으면 알림을 띄워요. 서버가 없는 앱이라 앱(설치한 바로가기)이 켜져 있을 때만 울려요.'}</Help>
        </section>
      )}
      {mode === 'dnd' && (
        <section className="vs-sec plain">
          <ToggleRow title="방해 금지 시간 사용" checked={s.dndOn} onChange={(v) => set({ dndOn: v })} />
          <Row title="시작">
            <input type="time" className="time-input" value={s.dndFrom} onChange={(e) => set({ dndFrom: e.target.value })} />
          </Row>
          <Row title="종료">
            <input type="time" className="time-input" value={s.dndTo} onChange={(e) => set({ dndTo: e.target.value })} />
          </Row>
          <Help>이 시간에는 학습 알림을 보내지 않아요.</Help>
        </section>
      )}

      {mode === 'grammar' && (
        <>
          {themeRows}
          <section className="vs-sec">
            <h3>기본 설정</h3>
            {goalRow('grammarGoal')}
          </section>
          <section className="vs-sec">
            <h3>음성 속도 및 크기</h3>
            {accentRow}
            {genderRow}
            {speedRow}
            {soundCommon}
          </section>
          {manage}
        </>
      )}
      {mode === 'expr' && (
        <>
          {themeRows}
          <section className="vs-sec">
            <h3>학습 설정</h3>
            {speechRow}
            {goalRow('exprGoal')}
            <Row title="학습 코스" onClick={() => nav('/expr/courses')} />
          </section>
          <section className="vs-sec">
            <h3>음성 속도 및 크기</h3>
            {speedRow}
            {soundCommon}
          </section>
          {manage}
        </>
      )}
      {mode === 'talk' && (
        <>
          <section className="vs-sec">
            <h3>학습 설정</h3>
            <Row title="학습 난이도" value={s.talkLevel} onClick={() => nav('/talk/level')} />
            {goalRow('talkGoal')}
            <Row title="내 차례 입력 방식" value={label(TALK_INPUT_OPTS, s.talkInput)} onClick={() => open('내 차례 입력 방식', s.talkInput, TALK_INPUT_OPTS, (v) => set({ talkInput: v }))} />
          </section>
          <section className="vs-sec">
            <h3>음성 및 효과음 크기</h3>
            {soundCommon}
          </section>
          {manage}
        </>
      )}
      {mode === 'listening' && (
        <>
          {themeRows}
          <section className="vs-sec">
            <h3>기본 설정</h3>
            {speechRow}
            {goalRow('listeningGoal')}
            <Row title="학습 모드" value={label(LISTEN_MODE_OPTS, s.listeningMode)} onClick={() => open('학습 모드', s.listeningMode, LISTEN_MODE_OPTS, (v) => set({ listeningMode: v }))} />
            <Row title="주관식 입력 방식" value={label(LISTEN_INPUT_OPTS, s.listeningInput)} onClick={() => open('주관식 입력 방식', s.listeningInput, LISTEN_INPUT_OPTS, (v) => set({ listeningInput: v }))} />
            <Row title="발음 구분 연습" onClick={() => nav('/pairs')} />
          </section>
          <section className="vs-sec">
            <h3>음성 속도 및 크기</h3>
            {genderRow}
            {listenSpeedRow}
            {soundCommon}
          </section>
          {manage}
        </>
      )}
      {mode === 'voice' && (
        <>
          <section className="vs-sec">
            <h3>공통</h3>
            {soundCommon}
            <ToggleRow title="정답 후 자동 발음" checked={s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} help="정답을 맞히면 예문을 바로 읽어줘요." />
          </section>
          {(['vocab', 'grammar', 'expr', 'talk', 'listening'] as const).map((m) => (
            <section className="vs-sec" key={m}>
              <h3>{MODE_LABEL[m]}</h3>
              {accentRow}
              {genderRow}
              {m === 'listening' ? listenSpeedRow : speedRow}
            </section>
          ))}
          <section className="vs-sec">
            <button className="volume-check" onClick={() => speak('Hello! Can you hear me clearly?', s.speechRate === 'slow')}>
              <Icon name="speaker" size={18} /> 음성 들어보기
            </button>
            <Help>원어민 녹음 대신 폰에 내장된 영어 음성을 써요. 발음·성별은 폰에 설치된 음성 중에서 고르며, 폰 설정 &gt; 일반 &gt; 텍스트 음성 변환에서 음성을 더 설치할 수 있어요.</Help>
          </section>
        </>
      )}
      {mode === 'favorites' && (
        <>
          <section className="vs-sec fav-sec">
            <h3>학습 설정</h3>
            <Help>홈의 큰 카드 옆에 표시할 학습을 켜고 끌 수 있어요. 어휘 학습은 항상 표시되며 끌 수 없어요.</Help>
            <div className="fav-row">
              <span className="fav-ic" style={{ background: '#9d82e9' }}>
                <svg width="18" height="16" viewBox="0 0 18 16" aria-hidden="true">
                  <circle cx="9" cy="2.500" r="2.300" fill="#fff" />
                  <path d="M1.300 5.300c2.700 0 5.700 0.900 7.700 2.700 2.000-1.800 5.000-2.700 7.700-2.700 0.700 0 1.300 0.600 1.300 1.300v6.400c0 0.650-0.500 1.200-1.150 1.300-2.800 0.250-5.300 0.900-7.150 1.900-0.450 0.250-0.950 0.250-1.400 0-1.850-1.000-4.350-1.650-7.150-1.900C0.500 14.200 0 13.650 0 13.000V6.600c0-0.700 0.600-1.300 1.300-1.300z" fill="#fff" />
                </svg>
              </span>
              <span className="fav-name">어휘 학습</span>
              <svg className="fav-pin" width="14.667" height="16.667" viewBox="0 0 14.667 16.667" aria-hidden="true">
                <path d="M8.600 0.300l5.700 4.300-1.300 1.700-1.100-0.300-2.300 4.300 0.700 2.400-1.500 1.300-3.000-2.300-3.600 4.700-0.600-0.450 2.400-5.150-3.000-2.300 0.900-1.800 2.500 0.100 3.500-3.400-0.600-1.000z" fill="#50575d" />
              </svg>
            </div>
            {HOME_TABS.map((t) => {
              const on = fav.tabs.includes(t.mode);
              return (
                <label key={t.mode} className="fav-row">
                  <span className="fav-ic" style={{ background: t.color, '--cut': t.color } as React.CSSProperties}>
                    {t.icon}
                  </span>
                  <span className="fav-name">{t.label}</span>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setFavDraft({ ...fav, tabs: e.target.checked ? HOME_TABS.map((x) => x.mode).filter((m) => m === t.mode || fav.tabs.includes(m)) : fav.tabs.filter((m) => m !== t.mode) })}
                  />
                  <span className="toggle" />
                  <i className="fav-grip" aria-hidden="true" />
                </label>
              );
            })}
          </section>
          <section className="vs-sec fav-sec">
            <h3>위치 설정</h3>
            <Help>즐겨찾기가 표시될 위치를 설정할 수 있어요.</Help>
            <label className="vs-row toggle-row">
              <span>왼손 사용자 모드</span>
              <input type="checkbox" checked={fav.left} onChange={(e) => setFavDraft({ ...fav, left: e.target.checked })} />
              <span className="toggle" />
            </label>
          </section>
          <div className="fav-actions">
            <button className="fav-cancel" onClick={() => nav(-1)}>
              취소
            </button>
            <button
              className={`fav-ok ${favDirty ? 'on' : ''}`}
              onClick={() => {
                if (favDraft) set({ homeTabs: favDraft.tabs, leftHanded: favDraft.left });
                nav(-1);
              }}
            >
              확인
            </button>
          </div>
        </>
      )}
      {mode === 'updates' && (
        <div className="upd-check">
          <span>현재 버전 {__APP_VERSION__}</span>
          <button className="btn primary" onClick={() => window.dispatchEvent(new Event('voca:check-update'))}>
            새 버전 확인
          </button>
        </div>
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
      {goalKey && (
        <GoalModal
          presets={MODE_PRESETS}
          current={s[goalKey]}
          onClose={() => setGoalKey(null)}
          onSave={(n) => {
            set({ [goalKey]: n });
            setGoalKey(null);
          }}
        />
      )}
    </div>
  );
}
