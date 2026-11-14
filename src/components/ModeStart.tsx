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
import Mascot from './Mascot';

export const MODE_INFO: Record<string, { label: string; color: string; route?: string }> = {
  vocab: { label: '어휘', color: 'voca', route: '/quiz' },
  grammar: { label: '문법', color: 'grammar', route: '/grammar' },
  expr: { label: '표현', color: 'expr' },
  talk: { label: '실전 회화', color: 'talk' },
  listening: { label: '리스닝', color: 'listen', route: '/listening' },
};

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
    // 말해보카 플립 실측(2026-11-14): 창 335.33 x 531.67. 줄 둘(학습 모드 · 원어민 음성 속도, ‹ 값 › 으로 바꾼다) + 볼륨 확인 칸 + '오늘의 학습'
    const modes: [typeof s.listeningMode, string][] = [
      ['subjective', '주관식 모드'],
      ['mc', '객관식 모드'],
    ];
    const speeds: [typeof s.listeningSpeed, string][] = [
      ['real', '실전 속도'],
      ['slow', '듣기 평가 속도'],
    ];
    const row = <T extends string>(label: string, value: T, opts: [T, string][], set: (v: T) => void) => {
      const i = Math.max(0, opts.findIndex((o) => o[0] === value));
      const step = (d: number) => set(opts[(i + d + opts.length) % opts.length][0]);
      return (
        <div className="spl-row">
          <span>{label}</span>
          <button className="spl-chev l" onClick={() => step(-1)} aria-label="이전">
            <svg viewBox="0 0 6 10" aria-hidden="true">
              <path d="M4.900 0.800 1.100 5l3.800 4.200" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <b>{opts[i][1]}</b>
          <button className="spl-chev r" onClick={() => step(1)} aria-label="다음">
            <svg viewBox="0 0 6 10" aria-hidden="true">
              <path d="M1.100 0.800 4.900 5l-3.800 4.200" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      );
    };
    return (
      <div className="modal-dim" onClick={onClose}>
        <div className="start-pop listen" onClick={(e) => e.stopPropagation()}>
          <div className="sp-head">
            <span>리스닝 학습</span>
            <button className="sp-close" onClick={onClose} aria-label="닫기">
              <svg width="11.667" height="11.667" viewBox="0 0 11.667 11.667" aria-hidden="true">
                <path d="M0.800 0.800l10.067 10.067M10.867 0.800L0.800 10.867" fill="none" stroke="currentColor" strokeWidth="1.500" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {row('학습 모드', s.listeningMode, modes, (v) => void saveSettings({ listeningMode: v }))}
          {row('원어민 음성 속도', s.listeningSpeed, speeds, (v) => void saveSettings({ listeningSpeed: v }))}
          <i className="spl-dash" />
          <div className="spl-box">
            <ListenPhones />
            <p>
              정확한 듣기를 위해
              <br />
              스피커 볼륨을 확인해 주세요.
            </p>
            <i className="spl-line" />
            <button className="spl-vol" onClick={() => speak('Hello! Can you hear me clearly?', s.listeningSpeed === 'slow')}>
              <span>볼륨 확인용 음성 재생</span>
              <em>
                <svg viewBox="0 0 17.667 14.667" aria-hidden="true">
                  <path d="M1 4.600h2.900l4-3.500c0.550-0.450 1.400-0.050 1.400 0.650v11.200c0 0.700-0.850 1.100-1.400 0.650l-4-3.500H1a1 1 0 0 1-1-1V5.600a1 1 0 0 1 1-1z" fill="#fff" />
                  <path d="M11.700 4.200a4.300 4.300 0 0 1 0 6.300" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" />
                  <path d="M14.100 1.700a7.800 7.800 0 0 1 0 11.300" fill="none" stroke="#fff" strokeWidth="1.500" strokeLinecap="round" />
                </svg>
              </em>
            </button>
          </div>
          <button className="sp-start" onClick={() => nav('/listening')}>
            <HBookOpen />
            오늘의 학습
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/** 헤드폰 그림 (직접 그린 것: 67.67 x 63 — 어두운 보랏빛 머리띠와 귀마개, 바깥쪽에 밝은 보라 판) */
function ListenPhones() {
  return (
    <svg className="spl-phones" viewBox="0 0 67.667 63" aria-hidden="true">
      <defs>
        <linearGradient id="splCup" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a66bf0" />
          <stop offset="1" stopColor="#6a4be8" />
        </linearGradient>
      </defs>
      {/* 머리띠 */}
      <path d="M8.500 37C6 17 17 3.500 33.800 3.500S61.700 17 59.200 37" fill="none" stroke="#dcd8e6" strokeWidth="3.400" strokeLinecap="round" />
      <path d="M13.500 20.500C17 9 24.500 4.500 33.800 4.500S50.600 9 54.200 20.500" fill="none" stroke="#56506e" strokeWidth="7" strokeLinecap="round" />
      {/* 왼쪽 귀마개 */}
      <ellipse cx="9.300" cy="44" rx="7.300" ry="12.800" fill="url(#splCup)" transform="rotate(-12 9.300 44)" />
      <ellipse cx="18.600" cy="45.200" rx="10.400" ry="15" fill="#4a4560" transform="rotate(-12 18.600 45.200)" />
      <ellipse cx="20.200" cy="45.500" rx="5.600" ry="10" fill="#37334a" transform="rotate(-12 20.200 45.500)" />
      {/* 오른쪽 귀마개 */}
      <ellipse cx="47.800" cy="45.200" rx="10.400" ry="15" fill="#4a4560" transform="rotate(12 47.800 45.200)" />
      <ellipse cx="56.400" cy="44.300" rx="8.600" ry="13.200" fill="url(#splCup)" transform="rotate(12 56.400 44.300)" />
      <ellipse cx="57.600" cy="44.300" rx="5.400" ry="9.600" fill="#c7a6f7" opacity="0.35" transform="rotate(12 57.600 44.300)" />
    </svg>
  );
}

