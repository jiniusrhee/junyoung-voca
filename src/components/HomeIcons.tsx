/**
 * 홈 아래쪽 카드 전용 그림 (말해보카 플립 캡처에서 잰 크기 그대로의 SVG, 2026-11-11).
 * 모양은 직접 그렸고, 크기·색만 실측에 맞췄다. 어두운 부분은 카드 바탕색(#242629)으로 파낸다.
 */
const CUT = '#242629';

/** 카드 오른쪽 '>' : 6.67 x 11.33, 선 1.67 */
export function HChevron() {
  return (
    <svg className="h-chev" width="6.667" height="11.333" viewBox="0 0 6.667 11.333" aria-hidden="true">
      <polyline points="0.900,0.900 5.767,5.667 0.900,10.433" fill="none" stroke="currentColor" strokeWidth="1.667" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 어휘력 카드의 트로피: 19.3 x 16, 금색 + 연노랑 별 */
export function HTrophy() {
  return (
    <svg width="19.333" height="16" viewBox="0 0 19.333 16" aria-hidden="true">
      <path d="M3.300 0.200h12.733c0.300 0 0.500 0.230 0.480 0.530-0.300 4.900-2.300 8.300-5.250 9.330v1.800c0 1.000 0.900 1.740 2.200 2.500 0.500 0.300 0.330 1.440-0.300 1.440H6.170c-0.630 0-0.800-1.140-0.300-1.440 1.300-0.760 2.200-1.500 2.200-2.500v-1.800C5.120 9.030 3.120 5.630 2.820 0.730 2.800 0.430 3.000 0.200 3.300 0.200z" fill="#d8b12e" />
      <path d="M3.400 1.650H1.900c-0.700 0-1.100 0.500-1.050 1.200 0.250 2.900 1.950 4.850 4.550 5.650M15.933 1.650h1.500c0.700 0 1.100 0.500 1.050 1.200-0.250 2.900-1.950 4.850-4.550 5.650" fill="none" stroke="#d8b12e" strokeWidth="1.300" strokeLinecap="round" />
      <path d="M9.667 2.550l0.930 1.880 2.070 0.300-1.500 1.460 0.360 2.060-1.860-0.980-1.860 0.980 0.360-2.060-1.500-1.460 2.070-0.300z" fill="#eeed91" stroke="#eeed91" strokeWidth="0.500" strokeLinejoin="round" />
    </svg>
  );
}

/** 사전: 26.67 x 24.67, 파란 책 + 돋보기 */
export function HDict() {
  return (
    <svg className="h-dict" width="26.667" height="24.667" viewBox="0 0 26.667 24.667" aria-hidden="true">
      <path d="M5.500 0h15.400c0.550 0 1.000 0.450 1.000 1.000v22.500c0 0.550-0.450 1.000-1.000 1.000H5.000a5 5 0 0 1-5-5V5.500A5.500 5.500 0 0 1 5.500 0z" fill="#769dcf" />
      <path d="M5.300 20.900h8.500" fill="none" stroke={CUT} strokeWidth="2.100" strokeLinecap="round" />
      <circle cx="18.250" cy="15.750" r="7.900" fill={CUT} />
      <path d="M22.300 19.800l3.250 3.250" fill="none" stroke={CUT} strokeWidth="4.300" strokeLinecap="round" />
      <circle cx="18.250" cy="15.750" r="5.480" fill="none" stroke="#769dcf" strokeWidth="1.600" />
      <path d="M22.300 19.800l3.300 3.300" fill="none" stroke="#769dcf" strokeWidth="1.700" strokeLinecap="round" />
    </svg>
  );
}

/** 내 단어장: 25.33 x 21.33 분홍 하트 */
export function HHeart() {
  return (
    <svg className="h-heart" width="25.333" height="21.333" viewBox="0 0 25.333 21.333" aria-hidden="true">
      <path
        d="M12.667 3.400C11.300 1.200 9.300 0 7.000 0 3.100 0 0 3.200 0 7.300c0 5.600 6.100 10.300 12.000 13.850a1.300 1.300 0 0 0 1.333 0C19.233 17.600 25.333 12.900 25.333 7.300 25.333 3.200 22.233 0 18.333 0c-2.300 0-4.300 1.200-5.666 3.400z"
        fill="#d987a7"
      />
    </svg>
  );
}

/** 오답노트: 21 x 25 주황 공책에 'W' (우리 앱에만 있는 바로가기 — 실제 앱의 같은 자리 그림과 크기·색 무게를 맞춤) */
export function HNote() {
  return (
    <svg width="21" height="25" viewBox="0 0 21 25" aria-hidden="true">
      <path d="M2.500 0h16A2.500 2.500 0 0 1 21 2.500v20a2.500 2.500 0 0 1-2.500 2.500h-16A2.500 2.500 0 0 1 0 22.500v-20A2.500 2.500 0 0 1 2.500 0z" fill="#e6b05f" />
      <path d="M4.900 8.300l2.300 8.400 3.300-6.900 3.300 6.900 2.300-8.400" fill="none" stroke={CUT} strokeWidth="2.100" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 학습한 어휘: 22 x 25 보라 모래시계 */
export function HLearned() {
  return (
    <svg width="22" height="25" viewBox="0 0 22 25" aria-hidden="true">
      <rect x="0" y="0" width="22" height="3.600" rx="1.800" fill="#867de0" />
      <rect x="0" y="21.400" width="22" height="3.600" rx="1.800" fill="#867de0" />
      <path d="M3.200 2.800h15.600c0 5.000-5.000 7.200-5.000 9.700s5.000 4.700 5.000 9.700H3.200c0-5.000 5.000-7.200 5.000-9.700S3.200 7.800 3.200 2.800z" fill="#867de0" />
      <path d="M7.600 6.700h6.800c-0.900 1.500-2.300 2.500-3.400 3.800-1.100-1.300-2.500-2.300-3.400-3.800z" fill={CUT} />
    </svg>
  );
}

/** 학습 알림 알약의 기울어진 종: 10.7 x 12.7 */
export function HBell() {
  return (
    <svg width="10.667" height="12.667" viewBox="0 0 10.667 12.667" aria-hidden="true">
      <g transform="rotate(-22 5.333 6.333)">
        <circle cx="5.333" cy="1.250" r="1.050" fill="currentColor" />
        <path d="M5.333 1.600c2.300 0 3.700 1.700 3.700 3.900v2.300l1.000 1.500H0.633l1.000-1.500V5.500c0-2.200 1.400-3.900 3.700-3.900z" fill="currentColor" />
        <ellipse cx="5.333" cy="9.950" rx="4.700" ry="1.650" fill="currentColor" opacity="0.72" />
        <ellipse cx="5.333" cy="10.050" rx="1.450" ry="1.000" fill="currentColor" opacity="0.55" />
      </g>
    </svg>
  );
}

/* ===== 홈 위쪽 (연속 학습 카드·큰 카드) — 플립 실측 2026-11-11 =====
   파낸 부분은 그림이 놓인 자리의 바탕색을 따라가도록 CSS 변수 --cut 으로 칠한다. */
const cut = { fill: 'var(--cut, #2c3033)' } as const;
const cutLine = { stroke: 'var(--cut, #2c3033)' } as const;

/** 연속 학습 불꽃: 40.67 x 48.67. off 면 한 가지 회색 */
export function HFlame({ off = false }: { off?: boolean }) {
  return (
    <svg width="40.667" height="48.667" viewBox="0 0 40.667 48.667" aria-hidden="true">
      <path
        d="M17.500 0.300c3.800 2.600 7.400 7.500 8.800 11.900 1.200-1.300 2.900-2.600 4.500-2.600 2.200 0 9.867 8.900 9.867 18.700 0 11.200-9.100 20.367-20.333 20.367S0 39.500 0 28.300C0 16.000 10.500 5.500 15.500 1.000c0.700-0.600 1.400-0.900 2.000-0.700z"
        fill={off ? '#4a4d55' : '#e8914a'}
      />
      {!off && <path d="M20.600 20.100c1.400 0 7.800 6.400 7.800 11.500a8 8 0 0 1-16 0c0-5.100 6.800-11.500 8.200-11.500z" fill="#fcc57c" />}
    </svg>
  );
}

/** '내 목표' 앞의 기울어진 깃발: 12 x 11.33 */
export function HFlag() {
  return (
    <svg width="12" height="11.333" viewBox="0 0 12 11.333" aria-hidden="true">
      <path d="M0.900 4.900l4.900 5.500" fill="none" stroke="#bebebe" strokeWidth="1.500" strokeLinecap="round" />
      <path d="M2.300 3.600l4.300-3.200c0.500-0.400 1.200-0.300 1.600 0.100l3.200 3.300c0.500 0.500 0.400 1.300-0.100 1.700L7.000 8.800z" fill="#e0646f" />
      <path d="M5.400 1.300l3.500 3.900-2.700 2.200" fill="none" stroke="#c9505c" strokeWidth="0.900" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

/** 요일 칸의 금화: 지름 24.33, 테두리가 조금 밝고 흰 트로피 */
export function HCoin() {
  return (
    <svg width="24.333" height="24.333" viewBox="0 0 24.333 24.333" aria-hidden="true">
      <circle cx="12.167" cy="12.167" r="12.167" fill="#ffdd1c" />
      <circle cx="12.167" cy="12.167" r="10.100" fill="#ffd000" />
      <path d="M7.900 7.000h8.533c0.250 0 0.430 0.200 0.410 0.450-0.250 3.300-1.650 5.400-3.650 6.050v1.250c0 0.650 0.600 1.150 1.450 1.650 0.350 0.200 0.230 0.950-0.200 0.950H9.890c-0.430 0-0.550-0.750-0.200-0.950 0.850-0.500 1.450-1.000 1.450-1.650v-1.250c-2.000-0.650-3.400-2.750-3.650-6.050-0.020-0.250 0.160-0.450 0.410-0.450z" fill="#fff" />
      <path d="M8.000 8.050H6.900c-0.450 0-0.700 0.350-0.660 0.800 0.200 1.900 1.300 3.150 2.950 3.650M16.333 8.050h1.100c0.450 0 0.700 0.350 0.660 0.800-0.200 1.900-1.300 3.150-2.950 3.650" fill="none" stroke="#fff" strokeWidth="0.900" strokeLinecap="round" />
    </svg>
  );
}

/** 오늘 칸 아래의 작은 세모: 4.67 x 4.67 */
export function HTodayMark() {
  return (
    <svg className="today-mark" width="4.667" height="4.667" viewBox="0 0 4.667 4.667" aria-hidden="true">
      <path d="M2.333 0.500L4.300 4.200H0.367z" fill="#7f83d5" stroke="#7f83d5" strokeWidth="0.800" strokeLinejoin="round" />
    </svg>
  );
}

/** 복습 정답률 앞의 물결 테두리 배지: 8.67 */
export function HBadge() {
  const bumps = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return <circle key={i} cx={4.333 + 3.050 * Math.cos(a)} cy={4.333 + 3.050 * Math.sin(a)} r="1.330" fill="currentColor" />;
  });
  return (
    <svg className="h-badge" width="8.667" height="8.667" viewBox="0 0 8.667 8.667" aria-hidden="true">
      <circle cx="4.333" cy="4.333" r="3.300" fill="currentColor" />
      {bumps}
      <path d="M2.700 4.400l1.200 1.150 2.100-2.250" fill="none" style={cutLine} strokeWidth="1.050" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 하루 목표 옆 연필: 12.67 x 12 (채워진 연필 + 밑줄) */
export function HPencil() {
  return (
    <svg className="h-pencil" width="12.667" height="12" viewBox="0 0 12.667 12" aria-hidden="true">
      <path d="M7.300 0.700c0.600-0.600 1.500-0.600 2.100 0l1.500 1.500c0.600 0.600 0.600 1.500 0 2.100L6.000 9.200H2.600c-0.500 0-0.900-0.400-0.900-0.900V6.300z" fill="currentColor" />
      <path d="M0.700 11.200h11.267" fill="none" stroke="currentColor" strokeWidth="1.300" strokeLinecap="round" />
    </svg>
  );
}

/** 시작 버튼의 둥근 별: 17 x 16.33 */
export function HStar() {
  return (
    <svg width="17" height="16.333" viewBox="0 0 17 16.333" aria-hidden="true">
      <g transform="translate(8.500 8.550) scale(1.135) translate(-8.500 -8.550)">
        <path d="M8.500 1.600l1.950 4.100 4.450 0.600-3.250 3.100 0.800 4.450-3.950-2.150-3.950 2.150 0.800-4.450-3.250-3.100 4.450-0.600z" fill="currentColor" stroke="currentColor" strokeWidth="2.300" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** 시작 버튼의 펼친 책(목표를 채우기 전): 21 x 16.33 */
export function HBookOpen() {
  return (
    <svg width="21" height="16.333" viewBox="0 0 21 16.333" aria-hidden="true">
      <path d="M0.900 1.000c3.300-0.800 6.300-0.300 8.700 1.300v13.500c-2.500-1.500-5.400-1.900-8.500-1.300-0.600 0.100-1.100-0.300-1.100-0.900V2.100c0-0.500 0.400-1.000 0.900-1.100zM20.100 1.000c-3.300-0.800-6.300-0.300-8.700 1.300v13.500c2.500-1.500 5.400-1.900 8.500-1.300 0.600 0.100 1.100-0.300 1.100-0.900V2.100c0-0.500-0.400-1.000-0.900-1.100z" fill="currentColor" />
    </svg>
  );
}

/** 모드 탭: 어휘 (25 x 26) — 책 읽는 사람 + 확인 배지 */
export function HTabVocab() {
  const bumps = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    return <circle key={i} cx={18.700 + 4.500 * Math.cos(a)} cy={19.700 + 4.500 * Math.sin(a)} r="1.850" fill="currentColor" />;
  });
  return (
    <svg width="25" height="26" viewBox="0 0 25 26" aria-hidden="true">
      <circle cx="11" cy="3.300" r="3.300" fill="currentColor" />
      <path d="M0.900 8.100c3.300-0.700 7.000 0.300 10.100 2.400 3.100-2.100 6.800-3.100 10.100-2.400 0.500 0.100 0.900 0.600 0.900 1.200v11.200c0 0.600-0.400 1.100-1.000 1.100-3.500 0.200-7.000 1.100-10.000 2.900-3.000-1.800-6.500-2.700-10.000-2.900-0.600 0-1.000-0.500-1.000-1.100V9.300c0-0.600 0.400-1.100 0.900-1.200z" fill="currentColor" />
      <circle cx="18.700" cy="19.700" r="7.500" style={cut} />
      <circle cx="18.700" cy="19.700" r="4.900" fill="currentColor" />
      {bumps}
      <path d="M16.200 19.800l1.850 1.800 3.250-3.500" fill="none" style={cutLine} strokeWidth="1.500" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 모드 탭: 문법 (22 x 22.67) — G 가 파인 책 */
export function HTabGrammar() {
  return (
    <svg width="22" height="22.667" viewBox="0 0 22 22.667" aria-hidden="true">
      <path d="M4.300 0H21a1 1 0 0 1 1 1v20.667a1 1 0 0 1-1 1H4.300A4.300 4.300 0 0 1 0 18.367V4.300A4.300 4.300 0 0 1 4.300 0z" fill="currentColor" />
      <path d="M4.600 19.600H22" fill="none" style={cutLine} strokeWidth="1.500" strokeLinecap="round" />
      <path d="M14.900 6.900a3.900 3.900 0 1 0 1.200 3.500h-3.500" fill="none" style={cutLine} strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 모드 탭: 표현 (23.67 x 21.33) — 점 세 개가 파인 말풍선 */
export function HTabExpr() {
  return (
    <svg width="23.667" height="21.333" viewBox="0 0 23.667 21.333" aria-hidden="true">
      <path d="M3.300 0h17.067a3.300 3.300 0 0 1 3.300 3.300v11.500a3.300 3.300 0 0 1-3.300 3.300h-1.200l-0.500 2.500c-0.150 0.700-0.900 0.900-1.400 0.400l-3.100-2.900H3.300A3.300 3.300 0 0 1 0 14.800V3.300A3.300 3.300 0 0 1 3.300 0z" fill="currentColor" />
      <circle cx="5.800" cy="9.000" r="1.550" style={cut} />
      <circle cx="11.900" cy="9.000" r="1.550" style={cut} />
      <circle cx="18.000" cy="9.000" r="1.550" style={cut} />
    </svg>
  );
}

/** 모드 탭: 실전 회화 (24.33 x 22) — 겹친 말풍선 둘 */
export function HTabTalk() {
  return (
    <svg width="24.333" height="22" viewBox="0 0 24.333 22" aria-hidden="true">
      <path d="M2.500 6.600h11.600a2.500 2.500 0 0 1 2.500 2.500v8.000a2.500 2.500 0 0 1-2.500 2.500H4.400l-2.900 2.100c-0.600 0.450-1.300 0.050-1.300-0.700V9.100a2.500 2.500 0 0 1 2.300-2.500z" fill="currentColor" />
      <path d="M7.900-1.300h14.000a3.800 3.800 0 0 1 3.800 3.800v15.500l-5.000-2.300H7.900a3.800 3.800 0 0 1-3.800-3.800V2.500a3.800 3.800 0 0 1 3.800-3.800z" style={cut} />
      <path d="M7.900 0h13.933a2.500 2.500 0 0 1 2.500 2.500v13.800c0 0.800-0.800 1.200-1.400 0.700l-3.300-2.500H7.900a2.500 2.500 0 0 1-2.500-2.500V2.500A2.500 2.500 0 0 1 7.900 0z" fill="currentColor" />
      <path d="M10.500 5.800h9.300M10.500 9.800h4.800" fill="none" style={cutLine} strokeWidth="1.700" strokeLinecap="round" />
    </svg>
  );
}

/** 모드 탭: 리스닝 (25.33 x 21.33) — 채워진 헤드폰 */
export function HTabListen() {
  return (
    <svg width="25.333" height="21.333" viewBox="0 0 25.333 21.333" aria-hidden="true">
      <path d="M2.800 13.000v-2.700a9.867 9.867 0 0 1 19.733 0v2.700" fill="none" stroke="currentColor" strokeWidth="2.800" />
      <rect x="2.500" y="8.300" width="7.300" height="12.800" rx="3.650" fill="currentColor" />
      <rect x="15.533" y="8.300" width="7.300" height="12.800" rx="3.650" fill="currentColor" />
      <rect x="0" y="10.800" width="5" height="6.000" rx="2.500" fill="currentColor" />
      <rect x="20.333" y="10.800" width="5" height="6.000" rx="2.500" fill="currentColor" />
    </svg>
  );
}

/** 모드 탭 아래 톱니: 이 끝에서 끝까지 20.7, 이 여섯 개가 둥글다 */
export function HGear() {
  const teeth = Array.from({ length: 6 }, (_, i) => <rect key={i} x="7.067" y="0.600" width="5.200" height="6" rx="2.000" fill="currentColor" transform={`rotate(${i * 60} 9.667 10)`} />);
  return (
    <svg width="21.267" height="22" viewBox="0 0 19.333 20" aria-hidden="true">
      {teeth}
      <path fillRule="evenodd" d="M9.667 3.200a6.800 6.800 0 1 0 0 13.600 6.800 6.800 0 0 0 0-13.600zm0 3.500a3.300 3.300 0 1 1 0 6.600 3.300 3.300 0 0 1 0-6.600z" fill="currentColor" />
    </svg>
  );
}
