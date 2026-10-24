import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { UPDATES } from '../updates';
import type { Settings, StudyMode } from '../types';

const GOALS = [5, 10, 15, 20, 30, 50];
const THEME_LABEL: Record<Settings['theme'], string> = { system: '시스템 설정', dark: '다크 모드', light: '라이트 모드' };
const STUDY_THEME_LABEL: Record<Settings['studyTheme'], string> = { dino: '다이노를 찾아서', sky: '하늘' };
const SPEECH_LABEL: Record<Settings['speechLevel'], string> = { loose: '느슨하게', normal: '보통', strict: '엄격하게' };
const ACCENT_LABEL: Record<Settings['voiceAccent'], string> = { us: '미국식', uk: '영국식' };
const GENDER_LABEL: Record<Settings['voiceGender'], string> = { random: '랜덤', male: '남성', female: '여성' };
const SPEED_LABEL: Record<Settings['speechRate'], string> = { real: '실전 속도', slow: '듣기 평가 속도' };
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

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="ms-row slider-row">
      <span className="ms-row-text">
        <b>{label}</b>
      </span>
      <Icon name="speaker" size={20} className="ic-purple" />
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function ToggleRow({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="ms-row toggle-row">
      <span className="ms-row-text">
        <b>
          {label} {help && <i className="qmark" title={help}>?</i>}
        </b>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle" />
    </label>
  );
}

function Row({ title, desc, children, onClick }: { title: string; desc?: string; children?: React.ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="ms-row-text">
        <b>{title}</b>
        {desc && !onClick && <span>{desc}</span>}
      </span>
      {desc && onClick && <span className="ms-value">{desc}</span>}
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

const cycle = <T extends string>(list: readonly T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];

/** 설정 > 화면 / 알림 / 음성 및 효과음 / 모드별 학습 설정 / 즐겨찾기 / 업데이트 히스토리 (말해보카 설정 메뉴 구성) */
export default function ModeSettings() {
  const { mode = '' } = useParams();
  const nav = useNavigate();
  const s = useSettings();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  if (!s) return null;
  const set = (patch: Partial<Settings>) => void saveSettings(patch);
  const askPermission = () => {
    if (typeof Notification === 'undefined') return;
    void Notification.requestPermission().then(setPerm);
  };
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
  const soundCommon = (
    <>
      <Slider label="음성" value={s.ttsVolume} onChange={(v) => set({ ttsVolume: v })} />
      <Slider label="효과음" value={s.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
      <Slider label="키 입력 시 소리" value={s.keySoundVolume} onChange={(v) => set({ keySoundVolume: v })} />
      <ToggleRow label="키 입력 시 진동" checked={s.keyVibrate} onChange={(v) => set({ keyVibrate: v })} />
      <ToggleRow label="연속 학습 달성 시 진동" checked={s.streakVibrate} onChange={(v) => set({ streakVibrate: v })} />
      <ToggleRow label="앱 무음 모드로 시작하기" checked={s.muteStart} onChange={(v) => set({ muteStart: v })} help="앱을 열 때 소리를 끈 상태로 시작해요." />
    </>
  );

  return (
    <div className="vs-page ms-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> {TITLES[mode] ?? '설정'}
        </button>
      </header>

      {mode === 'screen' && (
        <>
          <h3 className="ms-sec">다크 모드 설정</h3>
          <div className="dm-cards">
            {(
              [
                ['light', '라이트 모드'],
                ['dark', '다크 모드'],
                ['system', '시스템 설정'],
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={`dm-card ${v} ${s.theme === v ? 'sel' : ''}`} onClick={() => set({ theme: v })}>
                <span className="dm-thumb">
                  <i />
                  <i />
                  <i />
                </span>
                <span>{label}</span>
                <span className="radio" />
              </button>
            ))}
          </div>
          <h3 className="ms-sec">학습 화면 설정</h3>
          <Row title="학습 테마" desc={STUDY_THEME_LABEL[s.studyTheme]} onClick={() => nav('/settings/mode/theme')} />
        </>
      )}
      {mode === 'theme' && (
        <div className="theme-cards">
          {(
            [
              ['dino', '다이노를 찾아서', '공룡이 사는 초록 들판'],
              ['sky', '하늘', '맑은 하늘색 기본 화면'],
            ] as const
          ).map(([v, label, desc]) => (
            <button key={v} className={`theme-card ${v} ${s.studyTheme === v ? 'sel' : ''}`} onClick={() => set({ studyTheme: v })}>
              <span className="theme-thumb" />
              <span className="theme-text">
                <b>{label}</b>
                <small>{desc}</small>
              </span>
              <span className="theme-tag">{s.studyTheme === v ? '사용 중' : 'MY'}</span>
            </button>
          ))}
        </div>
      )}
      {mode === 'notice' && (
        <>
          {perm !== 'granted' && (
            <button className="notice-banner" onClick={askPermission}>
              <span className="notice-warn">!</span>
              <span className="notice-text">
                <b>{perm === 'unsupported' ? '이 브라우저는 알림을 지원하지 않아요.' : '기기의 알림 설정이 꺼져 있어요!'}</b>
                <small>설정을 변경하고 학습에 도움이 되는 알림을 받아 보세요.</small>
              </span>
              <Icon name="chevron" size={18} className="muted-ic" />
            </button>
          )}
          <h3 className="ms-sec">최근 받은 알림</h3>
          <p className="vs-help-box">알림을 끄면 푸시 알림을 받을 수 없어요. 앱 내 알림함에서는 확인할 수 있어요.</p>
          <div className="lw-empty">
            <Icon name="bell" size={26} />
            <p>받은 알림이 없어요.</p>
          </div>
          <Row title="학습 알림" desc={s.notifyStudy ? `매일 ${s.notifyTime}` : '꺼짐'} onClick={() => nav('/settings/mode/studynotice')} />
          <Row title="방해 금지 시간" desc={s.dndOn ? `${s.dndFrom} ~ ${s.dndTo}` : '꺼짐'} onClick={() => nav('/settings/mode/dnd')} />
        </>
      )}
      {mode === 'studynotice' && (
        <>
          <ToggleRow
            label="학습 알림 받기"
            checked={s.notifyStudy}
            onChange={(v) => {
              set({ notifyStudy: v });
              if (v) askPermission();
            }}
          />
          <Row title="알림 시간">
            <input type="time" className="time-input" value={s.notifyTime} onChange={(e) => set({ notifyTime: e.target.value })} />
          </Row>
          <p className="vs-help-box">정한 시각에 오늘 학습이 없으면 알림을 띄워요. 서버가 없는 앱이라 앱(설치한 바로가기)이 켜져 있을 때만 울려요.</p>
        </>
      )}
      {mode === 'dnd' && (
        <>
          <ToggleRow label="방해 금지 시간 사용" checked={s.dndOn} onChange={(v) => set({ dndOn: v })} />
          <Row title="시작">
            <input type="time" className="time-input" value={s.dndFrom} onChange={(e) => set({ dndFrom: e.target.value })} />
          </Row>
          <Row title="종료">
            <input type="time" className="time-input" value={s.dndTo} onChange={(e) => set({ dndTo: e.target.value })} />
          </Row>
          <p className="vs-help-box">이 시간에는 학습 알림을 보내지 않아요.</p>
        </>
      )}

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
          <h3 className="ms-sec">공통</h3>
          {soundCommon}
          <ToggleRow label="정답 후 자동 발음" checked={s.autoSpeak} onChange={(v) => set({ autoSpeak: v })} help="정답을 맞히면 예문을 바로 읽어줘요." />
          {(['vocab', 'grammar', 'expr', 'talk', 'listening'] as const).map((m) => (
            <Fragment key={m}>
              <h3 className="ms-sec">{MODE_LABEL[m]}</h3>
              <Row title="원어민 발음" desc={ACCENT_LABEL[s.voiceAccent]} onClick={() => set({ voiceAccent: cycle(['us', 'uk'] as const, s.voiceAccent) })} />
              <Row title="원어민 음성 성별" desc={GENDER_LABEL[s.voiceGender]} onClick={() => set({ voiceGender: cycle(['random', 'male', 'female'] as const, s.voiceGender) })} />
              {m === 'listening' ? (
                <Row title="원어민 음성 속도" desc={SPEED_LABEL[s.listeningSpeed]} onClick={() => set({ listeningSpeed: cycle(['real', 'slow'] as const, s.listeningSpeed) })} />
              ) : (
                <Row title="원어민 음성 속도" desc={SPEED_LABEL[s.speechRate]} onClick={() => set({ speechRate: cycle(['real', 'slow'] as const, s.speechRate) })} />
              )}
            </Fragment>
          ))}
          <button className="volume-check" onClick={() => speak('Hello! Can you hear me clearly?', s.speechRate === 'slow')}>
            <Icon name="speaker" size={18} /> 음성 들어보기
          </button>
          <p className="vs-help-box">원어민 녹음 대신 폰에 내장된 영어 음성을 써요. 발음·성별은 폰에 설치된 음성 중에서 고르며, 폰 설정 &gt; 일반 &gt; 텍스트 음성 변환에서 음성을 더 설치할 수 있어요.</p>
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
      {(mode === 'grammar' || mode === 'expr' || mode === 'talk' || mode === 'listening') && (
        <>
          <h3 className="ms-sec">화면 설정</h3>
          <Row title="다크모드" desc={THEME_LABEL[s.theme]} onClick={() => set({ theme: cycle(['system', 'dark', 'light'] as const, s.theme) })} />
          <Row title="학습테마" desc={STUDY_THEME_LABEL[s.studyTheme]} onClick={() => set({ studyTheme: s.studyTheme === 'dino' ? 'sky' : 'dino' })} />
          <h3 className="ms-sec">발음 인식</h3>
          <Row title="발음인식 기준" desc={SPEECH_LABEL[s.speechLevel]} onClick={() => set({ speechLevel: cycle(['loose', 'normal', 'strict'] as const, s.speechLevel) })} />
          <h3 className="ms-sec">음성 속도 및 크기</h3>
          {soundCommon}
          <h3 className="ms-sec">학습 관리</h3>
          <Row title="학습 기록 관리" desc="백업·복원·초기화" onClick={() => nav('/settings/data')} />
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
