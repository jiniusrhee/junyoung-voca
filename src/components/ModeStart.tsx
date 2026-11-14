import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { modeSolved, modeToday } from '../lib/modeStudy';
import { saveSettings, useSettings } from '../lib/settings';
import { speak } from '../lib/speech';
import { daySolved } from '../lib/stats';
import { studyDateOf } from '../lib/time';
import type { StudyMode } from '../types';
import ExtraStudySheet, { RING_ARC, RING_LEN } from './ExtraStudySheet';
import { HBookOpen, HStar } from './HomeIcons';
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
    // 말해보카 플립 실측(2026-11-14): 어휘 시작 창에서 '학습 코스' 칸만 빠진 모양(330 x 396.33). 줄은 '새로운 문장' · '복습할 문장' 둘
    const goal = s.grammarGoal;
    const n = modeSolved(info?.today);
    const met = n >= goal;
    let target = goal;
    if (met) {
      target = goal + 10;
      while (target <= n) target += 10;
    }
    const left = Math.max(0, target - n);
    const review = Math.min((info?.due ?? 0) + (info?.wrong ?? 0), left);
    const fresh = Math.min(info?.fresh ?? 0, left - review);
    const fill = Math.min(1, n / target);
    return (
      <div className="modal-dim" onClick={onClose}>
        <div className="start-pop mode" onClick={(e) => e.stopPropagation()}>
          <div className="sp-head">
            <span>문법 학습</span>
            <button className="sp-close" onClick={onClose} aria-label="닫기">
              <svg width="11.667" height="11.667" viewBox="0 0 11.667 11.667" aria-hidden="true">
                <path d="M0.800 0.800l10.067 10.067M10.867 0.800L0.800 10.867" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <svg className="sp-ring" width="221.333" height="221.333" viewBox="0 0 210.333 210.333" aria-hidden="true">
            <path d={RING_ARC} className="sp-ring-track" />
            {fill > 0 && <path d={RING_ARC} className="sp-ring-fill" style={{ strokeDasharray: `${fill * RING_LEN} ${RING_LEN}` }} />}
          </svg>
          <ul className="sp-rows">
            <li>
              <span>새로운 문장</span>
              <b lang="en">{fresh}</b>
              <i>개</i>
            </li>
            <li>
              <span>복습할 문장</span>
              <b lang="en">{review}</b>
              <i>개</i>
            </li>
          </ul>
          <div className="sp-mascot">
            <Mascot size={62} mood="cheer" />
          </div>
          <p className="sp-count" lang="en">
            <b>{n}</b>
            <span>/{target}</span>
          </p>
          <button className="sp-start" onClick={() => nav(met ? `/grammar?target=${target}` : '/grammar')}>
            {met ? <HStar /> : <HBookOpen />}
            {met ? '추가 학습' : '오늘의 학습'}
          </button>
        </div>
      </div>
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
