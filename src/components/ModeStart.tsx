import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { modeToday } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { daySolved } from '../lib/stats';
import { studyDateOf } from '../lib/time';
import type { StudyMode } from '../types';
import ExtraStudySheet from './ExtraStudySheet';
import Icon from './Icon';
import Mascot from './Mascot';
import { StartSheet } from './StudyChrome';

export const MODE_INFO: Record<string, { label: string; color: string; route?: string }> = {
  vocab: { label: '어휘', color: 'voca', route: '/quiz' },
  grammar: { label: '문법', color: 'grammar', route: '/grammar' },
  expr: { label: '표현', color: 'expr' },
  talk: { label: '실전 회화', color: 'talk' },
  listening: { label: '리스닝', color: 'listen', route: '/listening' },
};

function Selector<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const i = Math.max(0, options.findIndex((o) => o[0] === value));
  const step = (d: number) => onChange(options[(i + d + options.length) % options.length][0]);
  return (
    <div className="sel-row">
      <span>{label}</span>
      <div className="sel-ctrl">
        <button onClick={() => step(-1)} aria-label="이전">
          ‹
        </button>
        <b>{options[i][1]}</b>
        <button onClick={() => step(1)} aria-label="다음">
          ›
        </button>
      </div>
    </div>
  );
}

/** 각 학습 모드의 ▶ 를 눌렀을 때 뜨는 시작 팝업 */
export default function ModeStart({ mode, onClose }: { mode: StudyMode; onClose: () => void }) {
  const nav = useNavigate();
  const s = useSettings();
  const info = useLiveQuery(async () => {
    const today = await modeToday(mode);
    const now = new Date();
    const dueRows = await db.mcards.where('[mode+due]').between([mode, new Date(0)], [mode, now], true, true).toArray();
    const wrong = dueRows.filter((c) => c.lapses > 0 || c.state === 3).length;
    const due = dueRows.length - wrong;
    const seen = await db.mcards.where('mode').equals(mode).count();
    const total = mode === 'grammar' ? await db.gsentences.count() : 0;
    return { today, due, wrong, fresh: Math.max(0, total - seen) };
  }, [mode]);
  const vocabToday = useLiveQuery(async () => daySolved(await db.daily.get(studyDateOf())), []);
  if (!s) return null;

  if (mode === 'vocab') {
    return <ExtraStudySheet todayTotal={vocabToday ?? 0} goal={s.dailyGoal} met={(vocabToday ?? 0) >= s.dailyGoal} onClose={onClose} onStart={(target) => nav(`/quiz?target=${target}`)} />;
  }

  if (mode === 'grammar') {
    const goal = s.grammarGoal;
    const n = info?.today.total ?? 0;
    return (
      <StartSheet
        title="문법 학습"
        onClose={onClose}
        action={
          <button className="extra-start" onClick={() => nav(n >= goal ? `/grammar?target=${n + 10}` : '/grammar')}>
            <Icon name={n >= goal ? 'star' : 'book'} size={22} /> {n >= goal ? '추가 학습' : '오늘의 학습'}
          </button>
        }
      >
        <div className="extra-body ring-body">
          <svg className="start-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="ring-track" />
            <circle cx="60" cy="60" r="52" className="ring-fill" style={{ strokeDasharray: `${Math.min(1, n / goal) * 326.7} 326.7` }} />
          </svg>
          <div className="extra-counts in-ring">
            <p>
              새로운 문장 <b>{Math.min(info?.fresh ?? 0, Math.max(0, goal - (info?.due ?? 0) - (info?.wrong ?? 0)))}</b> 개
            </p>
            <p>
              복습할 문장 <b>{info?.due ?? 0}</b> 개
            </p>
            <p>
              틀린 문장 <b>{info?.wrong ?? 0}</b> 개
            </p>
          </div>
          <div className="extra-mascot ring-mascot">
            <Mascot size={110} mood="cheer" />
          </div>
          <p className="extra-progress ring-progress">
            <b>{n}</b>/{goal}
          </p>
        </div>
      </StartSheet>
    );
  }

  if (mode === 'listening') {
    return (
      <StartSheet
        title="리스닝 학습"
        onClose={onClose}
        action={
          <button className="extra-start" onClick={() => nav('/listening')}>
            <Icon name="book" size={22} /> 오늘의 학습
          </button>
        }
      >
        <div className="listen-start">
          <Selector
            label="학습 모드"
            value={s.listeningMode}
            options={[
              ['subjective', '주관식 모드'],
              ['mc', '객관식 모드'],
            ]}
            onChange={(v) => void saveSettings({ listeningMode: v })}
          />
          <Selector
            label="원어민 음성 속도"
            value={s.listeningSpeed}
            options={[
              ['real', '실전 속도'],
              ['slow', '듣기 평가 속도'],
            ]}
            onChange={(v) => void saveSettings({ listeningSpeed: v })}
          />
          <div className="volume-box">
            <span className="headphones">
              <Icon name="headphones" size={64} />
            </span>
            <p>
              정확한 듣기를 위해
              <br />
              스피커 볼륨을 확인해 주세요.
            </p>
            <button className="volume-check" onClick={() => speak('Hello! Can you hear me clearly?', s.listeningSpeed === 'slow')}>
              볼륨 확인용 음성 재생 <Icon name="speaker" size={18} />
            </button>
          </div>
        </div>
      </StartSheet>
    );
  }
  return null;
}
