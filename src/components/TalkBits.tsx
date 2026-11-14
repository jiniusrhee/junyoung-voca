import type { CSSProperties } from 'react';

/**
 * 실전 회화 화면의 작은 그림들 — 말해보카 플립 화면을 보고(2026-11-14) 같은 크기·자리로 직접 그린 SVG.
 * 등급 배지(육각), 별, 접힌 말풍선의 아이콘, 동작 막대의 아이콘.
 */

type G = 'S' | 'A' | 'B' | 'C';
const GRADE: Record<G, { edge: string; face: [string, string]; ray: string; letter: string }> = {
  S: { edge: '#f5d35a', face: ['#f1c644', '#d9a62e'], ray: '#f8dc7c', letter: '#fdf0b4' },
  A: { edge: '#f7df6e', face: ['#efc94e', '#d9ac3a'], ray: '#f6dd82', letter: '#fdf3bb' },
  B: { edge: '#d3d9e2', face: ['#b3c0cf', '#96a5b6'], ray: '#c6d1dd', letter: '#eef2f6' },
  C: { edge: '#dfa771', face: ['#c58a62', '#a96f4c'], ray: '#d39a70', letter: '#f3c9a3' },
};
/** 꼭짓점이 위·아래에 있는 육각형 (모서리는 선의 둥근 이음으로 굴린다) */
const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');

/** 등급 배지: 둥근 육각 메달 + 글자. S 는 양옆에 날개. 아직 등급이 없으면 어두운 빈 육각 */
export function GradeBadge({ g, size = 40 }: { g?: string; size?: number }) {
  const c = g && g in GRADE ? GRADE[g as G] : null;
  const id = `tkg-${g ?? 'none'}`;
  const wing = g === 'S';
  return (
    <svg className={`tk-grade g-${g ?? 'none'}`} width={wing ? size * 1.55 : size} height={size} viewBox={wing ? '-15.4 0 86.8 56' : '0 0 56 56'} aria-hidden="true" style={{ overflow: 'visible' }}>
      {c ? (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.face[0]} />
              <stop offset="1" stopColor={c.face[1]} />
            </linearGradient>
          </defs>
          {wing && (
            <g fill="#f2c94a" stroke="#f7e08a" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M9 22c-9-6-17-7-23-4 3 2 4 5 4 8 4 0 6 2 7 5 4-1 7 0 9 3 2-4 3-8 3-12z" />
              <path d="M47 22c9-6 17-7 23-4-3 2-4 5-4 8-4 0-6 2-7 5-4-1-7 0-9 3-2-4-3-8-3-12z" />
            </g>
          )}
          <polygon points={hex(28, 28, 23)} fill={c.edge} stroke={c.edge} strokeWidth="8" strokeLinejoin="round" />
          <polygon points={hex(28, 28, 18.5)} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="5" strokeLinejoin="round" />
          {/* 가운데에서 퍼지는 옅은 빛살 */}
          <g fill={c.ray} opacity="0.28">
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path key={a} d="M28 28 22.500 5.500h11z" transform={`rotate(${a + 30} 28 28)`} />
            ))}
          </g>
          <text x="28" y="38.200" textAnchor="middle" fontSize="28" fontWeight="900" fill={c.letter} style={{ fontFamily: 'system-ui, Roboto, sans-serif' }}>
            {g}
          </text>
        </>
      ) : (
        <polygon points={hex(28, 28, 21)} fill="#1b1c1e" stroke="#1b1c1e" strokeWidth="8" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * 별 하나 (금빛 범위 24.67 x 24.67): 통통하고 끝이 둥근 별 + 칸과 같은 색의 두꺼운 테두리.
 * 얻은 별은 금빛, 못 얻은 별은 회색(#363738). 테두리끼리 · 테두리와 칸이 이어져 칸의 윗변이 올록볼록 솟은 것처럼 보인다.
 */
const STAR = '12.33,1.20 16.21,7.66 23.56,9.35 18.61,15.04 19.27,22.55 12.33,19.60 5.40,22.55 6.06,15.04 1.11,9.35 8.45,7.66';
export function TalkStar({ on, style }: { on: boolean; style?: CSSProperties }) {
  return (
    <svg className={`tk-star${on ? ' on' : ''}`} viewBox="-5 -5 34.667 34.667" aria-hidden="true" style={style}>
      <defs>
        <linearGradient id="tkStarG" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#fbe07a" />
          <stop offset="0.55" stopColor="#f7c64b" />
          <stop offset="1" stopColor="#e99d33" />
        </linearGradient>
      </defs>
      <polygon className="tk-star-edge" points={STAR} fill="#242629" stroke="#242629" strokeWidth="12.400" strokeLinejoin="round" />
      <polygon points={STAR} fill={on ? 'url(#tkStarG)' : '#363738'} stroke={on ? '#f7c64b' : '#363738'} strokeWidth="3.200" strokeLinejoin="round" />
      {on && <path d="M12.33 3.400 14.900 9.600 12.330 12.800z" fill="#fff3b0" opacity="0.55" />}
    </svg>
  );
}

/** 접힌 말풍선의 말풍선 그림 (15.33 x 14.67) */
export function TkChat() {
  return (
    <svg viewBox="0 0 15.333 14.667" width="15.333" height="14.667" aria-hidden="true">
      <path d="M1.800 0h11.733a1.800 1.800 0 0 1 1.800 1.800v7.733a1.800 1.800 0 0 1-1.800 1.800H6.200L3.200 14.400v-3.067H1.800A1.800 1.800 0 0 1 0 9.533V1.800A1.800 1.800 0 0 1 1.800 0z" fill="currentColor" />
      <path d="M3.600 4h8.133M3.600 7h5.400" fill="none" stroke="var(--tk-ink, #252627)" strokeWidth="1.300" strokeLinecap="round" />
    </svg>
  );
}

/** 스피커 (16.33 x 13.33) — 상대 말풍선의 듣기 단추 */
export function TkSpeaker() {
  return (
    <svg viewBox="0 0 16.333 13.333" width="16.333" height="13.333" aria-hidden="true">
      <path d="M0.900 4.100h2.700l3.700-3.300c0.500-0.450 1.300-0.100 1.300 0.600v10.533c0 0.700-0.800 1.050-1.300 0.600l-3.700-3.300H0.900a0.900 0.900 0 0 1-0.900-0.900V5a0.900 0.900 0 0 1 0.900-0.900z" fill="currentColor" />
      <path d="M10.900 3.900a4 4 0 0 1 0 5.533" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" />
      <path d="M13.200 1.700a7.100 7.100 0 0 1 0 9.933" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" />
    </svg>
  );
}

/** 동작 막대: 귀 접힌 종이 + 체크 ('모범 답안 듣기') — 22.67 x 25 */
export function TkModel() {
  return (
    <svg viewBox="0 0 22.667 25" width="22.667" height="25" aria-hidden="true">
      <path d="M3 0h11.200l8.467 8.300V22a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z" fill="currentColor" />
      <path d="M6.300 13.200l3.500 3.600 6.600-7" fill="none" stroke="var(--tk-ink, #735cf4)" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** 동작 막대: 책갈피 ('복습에 추가' — 실제 앱의 AI 질문 답변 자리에 우리 기능을 둔다) — 20 x 25 */
export function TkMark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 25" width="20" height="25" aria-hidden="true">
      <path d="M3 0h14a3 3 0 0 1 3 3v20.300c0 1.300-1.500 2-2.500 1.200L10 19.300l-7.500 5.200C1.500 25.300 0 24.600 0 23.300V3a3 3 0 0 1 3-3z" fill="currentColor" />
      {on ? (
        <path d="M5.600 9.700l3.100 3.200 5.800-6.200" fill="none" stroke="var(--tk-ink, #735cf4)" strokeWidth="2.300" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M10 5v8M6 9h8" fill="none" stroke="var(--tk-ink, #735cf4)" strokeWidth="2.300" strokeLinecap="round" />
      )}
    </svg>
  );
}
/** 동작 막대: 되돌아가는 화살표 ('재도전') — 25 x 25 */
export function TkRetry() {
  return (
    <svg viewBox="0 0 25 25" width="25" height="25" aria-hidden="true">
      <path d="M21.800 13.600a9.300 9.300 0 1 1-3-7.500" fill="none" stroke="currentColor" strokeWidth="4.200" strokeLinecap="round" />
      <path d="M24.200 0.600v9.600h-9.600z" fill="currentColor" />
    </svg>
  );
}
/** 동작 막대: ▶ ('다음 문제') — 20 x 23.33 */
export function TkNext() {
  return (
    <svg viewBox="0 0 20 23.333" width="20" height="23.333" aria-hidden="true">
      <path d="M0 3.200C0 0.900 2.500-0.500 4.500 0.700l14 8.467c1.900 1.150 1.900 3.850 0 5L4.500 22.633C2.500 23.833 0 22.433 0 20.133z" fill="currentColor" />
    </svg>
  );
}
/** 동작 막대: 굵은 체크 ('학습 완료') — 25 x 20 */
export function TkDone() {
  return (
    <svg viewBox="0 0 25 20" width="25" height="20" aria-hidden="true">
      <path d="M2.500 10.500l6.500 6.500L22.500 3" fill="none" stroke="currentColor" strokeWidth="4.200" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** 도구 알약: 귀 접힌 종이 + 체크 (작게, '모범 답안') — 14.67 x 16 */
export function TkModelSmall() {
  return (
    <svg viewBox="0 0 14.667 16" width="14.667" height="16" aria-hidden="true">
      <path d="M2 0h7.200l5.467 5.300V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z" fill="currentColor" />
      <path d="M4.200 8.500l2.200 2.300 4.200-4.500" fill="none" stroke="var(--tk-ink, #363737)" strokeWidth="1.600" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
/** 도구 알약: 동그라미 물음표 ('힌트 보기') — 지름 16 */
export function TkHint() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M5.700 6.300a2.300 2.300 0 1 1 3.750 1.800c-0.940 0.700-1.450 1.100-1.450 2.050" fill="none" stroke="var(--tk-ink, #363737)" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12.300" r="1" fill="var(--tk-ink, #363737)" />
    </svg>
  );
}
/** 도구 알약: 마이크 ('음성 모드') — 12 x 16.33 */
export function TkMic() {
  return (
    <svg viewBox="0 0 12 16.333" width="12" height="16.333" aria-hidden="true">
      <rect x="3" y="0" width="6" height="10" rx="3" fill="currentColor" />
      <path d="M0.700 6.800v0.800a5.300 5.300 0 0 0 10.600 0v-0.800" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" />
      <path d="M6 13v2.600" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" />
    </svg>
  );
}
