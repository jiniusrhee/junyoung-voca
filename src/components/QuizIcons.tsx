/**
 * 어휘 퀴즈 전용 아이콘 — 플립에서 말해보카 화면을 재어(2026-11-11) 같은 크기·굵기로 직접 그린 SVG.
 * 크기는 CSS px 그대로 viewBox 에 넣었다(1 단위 = 1 CSS px). 색은 currentColor.
 */

/** 뒤로 '<' : 잉크 10 × 17.33, 획 2.5 */
export function QBack() {
  return (
    <svg className="qi qi-back" viewBox="0 0 10 17.333" width="10" height="17.333" aria-hidden="true">
      <polyline points="8.75,1.25 1.3,8.667 8.75,16.08" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 톱니: 19 × 20, 이 6개(위·아래에 하나씩), 가운데 구멍 지름 6.3 */
export function QGear() {
  return (
    <svg className="qi qi-gear" viewBox="0 0 19 20" width="19" height="20" aria-hidden="true">
      <path
        d="M11.86 4.16 L11.12 1.25 L7.88 1.25 L7.14 4.16 L5.62 5.04 L2.73 4.22 L1.11 7.03 L3.26 9.12 L3.26 10.88 L1.11 12.97 L2.73 15.78 L5.62 14.96 L7.14 15.84 L7.88 18.75 L11.12 18.75 L11.86 15.84 L13.38 14.96 L16.27 15.78 L17.89 12.97 L15.74 10.88 L15.74 9.12 L17.89 7.03 L16.27 4.22 L13.38 5.04Z M5.30 10.00 a4.20 4.20 0 1 0 8.40 0 a4.20 4.20 0 1 0 -8.40 0Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 진행 막대 왼쪽 동그라미(지름 33.33): 연한 불꽃 + 흰 물방울 */
export function QStreak() {
  return (
    <svg className="qi qi-streak" viewBox="0 0 100 100" width="33.333" height="33.333" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="currentColor" />
      <path d="M46 27C43 35 27 44 27 59c0 11.500 10 19.500 23 19.500S74 70.500 74 59c0-8-4-16-11-23-.500 3.500-2.500 5.500-5.500 6.500C56 36 51.500 30.500 46 27z" fill="#d2dfca" />
      <path d="M49.500 46.500c-3 5.500-8 9-8 14 0 3.800 3.500 6.300 8 6.300s8-2.500 8-6.300c0-5-5-8.500-8-14z" fill="#fff" />
    </svg>
  );
}

/**
 * 진행 막대 왼쪽 동그라미의 트로피: 그날의 연속 학습을 아직 달성하지 못한 동안 불꽃 대신 보인다
 * (플립 실측 2026-11-14: 4/10 까지 트로피, 5/10 부터 불꽃). 흰 컵 — 동그라미 안에서 x 8~25.67, y 10.33~23.67.
 */
export function QTrophy() {
  return (
    <svg className="qi qi-streak" viewBox="0 0 100 100" width="33.333" height="33.333" aria-hidden="true">
      <circle cx="50" cy="50" r="50" fill="currentColor" />
      <path d="M31 31h38v15.500c0 9.500-8 16.500-19 16.500s-19-7-19-16.500z" fill="#faf9fe" />
      <path d="M31.500 34.500h-6v6.500c0 5.500 3.500 9.500 8.500 10.800M68.500 34.500h6v6.500c0 5.500-3.500 9.500-8.500 10.800" fill="none" stroke="#faf9fe" strokeWidth="3" />
      <path d="M47 61.500h6l1.500 5.500 6.500 1.800V71H39v-2.200l6.500-1.800z" fill="#faf9fe" />
    </svg>
  );
}

/** 채움 끝의 작은 공룡(17.33 × 24): 왼쪽을 보고 앉은 목 긴 공룡, 밝은 테두리 */
export function QHead() {
  return (
    <svg className="qi qi-head" viewBox="0 0 52 72" width="17.333" height="24" aria-hidden="true">
      <g stroke="#e9ebe6" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" fill="#e9ebe6">
        <path d="M17 6c7-3 15 1 16 9 1 6-2 10-4 15 8 3 14 11 15 21 5 2 6 8 3 11-3 4-9 4-14 4H17c-6 0-10-4-9-10 1-7 4-12 5-19 1-6-1-9-3-13C7 17 9 9 17 6z" />
      </g>
      <path d="M17 6c7-3 15 1 16 9 1 6-2 10-4 15 8 3 14 11 15 21 5 2 6 8 3 11-3 4-9 4-14 4H17c-6 0-10-4-9-10 1-7 4-12 5-19 1-6-1-9-3-13C7 17 9 9 17 6z" fill="#a9c591" />
      <path d="M10 24c4 1 8 0 11-3-1 6-4 10-8 12 0-3-1-6-3-9z" fill="#ecd9a8" />
      <path d="M20 66h13c5 0 11 0 14-4-4-1-9-1-13 0-5 1-10 2-14 4z" fill="#ecd9a8" />
      <ellipse cx="30" cy="42" rx="5" ry="4" fill="#7fa86c" />
      <ellipse cx="38" cy="52" rx="2.600" ry="2.200" fill="#7fa86c" />
      <circle cx="20" cy="13" r="1.700" fill="#3c4a36" />
    </svg>
  );
}

/** 힌트 보기: 지름 21.33 동그라미 안 '?' (글자는 도구줄 색으로 뚫린 것처럼) */
export function QHint() {
  return (
    <svg className="qi qi-hint" viewBox="0 0 21.333 21.333" width="21.333" height="21.333" aria-hidden="true">
      <circle cx="10.667" cy="10.667" r="10.667" fill="currentColor" />
      <path d="M7.6 8.300a3.070 3.070 0 1 1 5 2.380c-1.250.950-1.930 1.500-1.930 2.750" fill="none" stroke="var(--q-toolbar)" strokeWidth="2.300" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.667" cy="16.400" r="1.300" fill="var(--q-toolbar)" />
    </svg>
  );
}

/** 정답 보기: 속이 찬 굵은 체크 (25.8 × 20.2) */
export function QReveal() {
  return (
    <svg className="qi qi-reveal" viewBox="0 0 25.800 20.200" width="25.800" height="20.200" aria-hidden="true">
      <polygon points="0,9.700 7.700,4.850 12.300,12.300 19.900,0 25.800,4.400 12.500,20.200" fill="currentColor" />
    </svg>
  );
}

/** 보너스 힌트: 상자 */
export function QBonus() {
  return (
    <svg className="qi qi-bonus" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 2.200 21.200 6.800v10.400L12 21.800 2.800 17.200V6.800z" fill="currentColor" />
      <path d="M2.800 6.800 12 11.400l9.200-4.600M12 11.400v10.400" fill="none" stroke="var(--q-toolbar)" strokeWidth="1.500" strokeLinejoin="round" />
    </svg>
  );
}

/** 음성 모드 마이크: 16 × 21.33, 속이 찬 캡슐 + U 받침 + 기둥 */
export function QMic() {
  return (
    <svg className="qi qi-mic" viewBox="0 0 16 21.333" width="16" height="21.333" aria-hidden="true">
      <rect x="3.270" y="0" width="9.460" height="12.300" rx="4.730" fill="currentColor" />
      <path d="M1.150 10.900a6.850 5.800 0 0 0 13.700 0" fill="none" stroke="currentColor" strokeWidth="2.300" strokeLinecap="round" />
      <line x1="8" y1="17" x2="8" y2="20.180" stroke="currentColor" strokeWidth="2.300" strokeLinecap="round" />
    </svg>
  );
}

/** 자판 지우기 키: 21 × 16, 얇은 획(1.25)의 왼쪽이 뾰족한 상자 + × */
export function QBackspace() {
  return (
    <svg className="qi qi-bksp" viewBox="0 0 21 16" width="21" height="16" aria-hidden="true">
      <path
        d="M7.300 0.800H18a2.200 2.200 0 0 1 2.200 2.200v10a2.200 2.200 0 0 1-2.200 2.200H7.300a2.200 2.200 0 0 1-1.600-.700L1.200 9.300a1.900 1.900 0 0 1 0-2.600l4.500-5.200a2.200 2.200 0 0 1 1.600-.700z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.250"
        strokeLinejoin="round"
      />
      <path d="M10.500 5.200l5.600 5.600M16.100 5.200l-5.600 5.600" fill="none" stroke="currentColor" strokeWidth="1.250" strokeLinecap="round" />
    </svg>
  );
}

/** 자판 확인 키의 체크: 11.7 × 8, 획 1.4 */
export function QOk() {
  return (
    <svg className="qi qi-ok" viewBox="0 0 11.700 8" width="11.700" height="8" aria-hidden="true">
      <polyline points="0.700,4.400 4.200,7.300 11,0.700" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** '다른 예문' 카드 머리의 펼친 책(외곽선): 14 × 11.33 */
export function QBookOutline() {
  return (
    <svg className="qi qi-bookline" viewBox="0 0 14 11.333" width="14" height="11.333" aria-hidden="true">
      <path
        d="M7 2.200C5.600 1.200 3.500.900 1.600 1.300a.900.900 0 0 0-.700.900v6.700c0 .500.500.900 1 .800 1.800-.300 3.700 0 5.100.900 1.400-.900 3.300-1.200 5.100-.900.500.100 1-.300 1-.800V2.200a.900.900 0 0 0-.700-.900C10.500.900 8.400 1.200 7 2.200zM7 2.200v8.400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.200"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 음성 바꾸기 화살표 두 줄: 11.33 × 10.33 */
export function QSwap() {
  return (
    <svg className="qi qi-swap" viewBox="0 0 11.333 10.333" width="11.333" height="10.333" aria-hidden="true">
      <path d="M.700 3.400h9.900L7.900.800M10.600 6.900H.700l2.700 2.600" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** 예문 듣기 스피커: 20.33 × 15.67 */
export function QSpeak() {
  return (
    <svg className="qi qi-speak" viewBox="0 0 20.333 15.667" width="20.333" height="15.667" aria-hidden="true">
      <path d="M1.300 5h2.800l4.300-3.600c.600-.500 1.500-.100 1.500.700v11.500c0 .800-.900 1.200-1.500.700L4.100 10.700H1.300a.900.900 0 0 1-.900-.900V5.900c0-.500.400-.900.900-.900z" fill="currentColor" />
      <path d="M12.700 4.900a4.100 4.100 0 0 1 0 5.900M15.300 2.400a7.700 7.700 0 0 1 0 10.900" fill="none" stroke="currentColor" strokeWidth="1.400" strokeLinecap="round" />
    </svg>
  );
}
