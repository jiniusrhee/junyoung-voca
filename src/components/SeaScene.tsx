/**
 * 어휘 퀴즈 풍경의 물속 부분 — 자판·패널 뒤에 깔려 있다가 음성 모드(자판이 없는 화면)와 자판이 올라오는 순간에 보인다.
 * 직접 그린 SVG. 구성과 색 띠만 말해보카 '다이노를 찾아서' 테마의 플립 실측(2026-11-13)을 따른다:
 *   y 0 = 물가(땅 풍경 viewBox 의 134) · 밝은 물 #6cb6b2 · 완만한 물속 언덕 #5caaa5(꼭대기 x 173, y 59) · 먼 능선 #3fa0a0(y 149~163)
 *   바닥 #328593(y 163~) · 어두운 바위 #266778 · 왼쪽·오른쪽 끝의 바위 턱과 물풀 · 물 위쪽의 잔물결 · 암모나이트(x 105~148, y 34~69)
 *   긴 목의 바다 파충류(x 185~360, y 23~106) · 물고기 떼(x 75~132, y 106~134)
 * 좌표는 폭 360 기준 CSS px, 높이 243 (= 자판 블록 249 − 6). 가로로 넓은 화면에서는 색 띠만 옆으로 이어진다.
 */
export default function SeaScene() {
  const fish = (x: number, y: number, s: number, fill: string) => (
    <path
      key={`${x}-${y}`}
      d={`M${x} ${y}q${3.2 * s}-${2.6 * s} ${7 * s}-${0.6 * s}l${2.2 * s}-${1.6 * s}v${4.4 * s}l-${2.2 * s}-${1.6 * s}q-${3.8 * s} ${2} -${7 * s}-${0.6 * s}z`}
      fill={fill}
    />
  );
  // 잎이 달린 물풀: 줄기를 따라 좌우로 작은 잎
  const leafy = (x: number, y0: number, y1: number, lean: number) => {
    const n = Math.max(4, Math.round((y1 - y0) / 6));
    const leaves = Array.from({ length: n }, (_, i) => {
      const t = (i + 0.5) / n;
      const cx = x + lean * Math.sin(t * Math.PI * 1.5);
      const cy = y1 - (y1 - y0) * t;
      const side = i % 2 ? 1 : -1;
      return <ellipse key={i} cx={cx + side * 2.2} cy={cy} rx="1.9" ry="0.9" transform={`rotate(${side * -35} ${cx + side * 2.2} ${cy})`} />;
    });
    const stem = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      return `${i ? 'L' : 'M'}${(x + lean * Math.sin(t * Math.PI * 1.5)).toFixed(2)} ${(y1 - (y1 - y0) * t).toFixed(2)}`;
    }).join('');
    return (
      <g key={`${x}-${y0}`}>
        <path d={stem} fill="none" stroke="#2a7183" strokeWidth="0.9" strokeLinecap="round" />
        <g fill="#2a7183">{leaves}</g>
      </g>
    );
  };
  const blade = (x: number, y0: number, y1: number, bend: number) => (
    <path key={`${x}-${y0}`} d={`M${x - 1.6} ${y1}Q${x + bend} ${(y0 + y1) / 2} ${x - bend * 0.4} ${y0}Q${x + bend * 1.6} ${(y0 + y1) / 2} ${x + 1.8} ${y1}z`} fill="#2a7183" />
  );
  return (
    <svg className="sea-scene" viewBox="0 0 360 243" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      {/* 밝은 물 */}
      <rect x="-800" y="-10" width="1960" height="263" fill="#6cb6b2" />
      {/* 완만한 물속 언덕과 그 아래 */}
      <path d="M-800 100Q-200 104 0 96q70-6 120-28 28-10 53-9 28 0 60 20 36 12 127 7 400-14 800-2V253H-800z" fill="#5caaa5" />
      {/* 먼 능선 */}
      <path d="M96 163q10-6 22-7 9-3 18-2 12-4 22 0 14-8 26-2 12-2 22 3 14-4 26 0 12-1 22 6l14 2z" fill="#3fa0a0" />
      {/* 바닥 */}
      <path d="M-800 163H1160V253H-800z" fill="#328593" />
      {/* 양 끝의 바위 턱 (바닥과 같은 색) */}
      <path d="M-800 118H30q10 0 15 9l8 14q4 4 12 4h20q8 0 13 7l10 11H-800z" fill="#328593" />
      <path d="M1160 137H334q-9 0-17 6l-26 20H1160z" fill="#328593" />
      {/* 바닥의 잔무늬 */}
      <g fill="#2c7c8b">
        <ellipse cx="150" cy="176" rx="20" ry="1.4" />
        <ellipse cx="250" cy="181" rx="16" ry="1.2" />
        <ellipse cx="112" cy="198" rx="42" ry="1.8" />
        <ellipse cx="270" cy="186" rx="30" ry="1.6" />
        <ellipse cx="160" cy="210" rx="36" ry="1.6" />
        <path d="M170 198q8-7 16 0zM196 202q9-6 18 0zM160 187q6-5 12 0z" />
      </g>
      {/* 어두운 바위 */}
      <path d="M0 189q4-10 22-12 8-11 28-11t30 12q22 2 30 11z" fill="#266778" />
      <path d="M275 201q12-10 40-12 12-7 30-6h15v18z" fill="#266778" />
      {/* 물풀 */}
      {leafy(18, 112, 176, 3)}
      {leafy(72, 132, 172, -2.5)}
      {blade(38, 148, 166, -3)}
      {blade(50, 122, 166, 5)}
      {blade(60, 142, 166, -4)}
      {leafy(346, 134, 186, -3)}
      {blade(325, 158, 186, 4)}
      {blade(334, 166, 186, -3)}
      {/* 잔물결 */}
      <g fill="#d5efec">
        <path d="M42 30q7 4 14 0zM58 30q7 4 14 0zM74 30q6 4 12 0zM50 36q6 4 12 0zM66 36q6 4 12 0z" />
        <path d="M246 19q5 3.400 10 0zM257 19q5 3.400 10 0zM251 23.500q4.500 3 9 0z" />
      </g>
      <path d="M277 10.500q5 3.400 10 0zM288 10.500q5 3.400 10 0zM283 14.500q4.500 3 9 0z" fill="#4e9d9c" />
      {/* 암모나이트: 돌돌 말린 껍데기와 짧은 다리 */}
      <g>
        <circle cx="134" cy="48" r="14" fill="#5aa9a4" />
        <path d="M134 48m-8.500 0a8.500 8.500 0 1 1 8.500 8.500 5.400 5.400 0 1 1-5.400-5.400 3 3 0 1 1 3 3" fill="none" stroke="#4a9793" strokeWidth="1.700" strokeLinecap="round" />
        <path d="M122 55q-5 1-7 5l8 2z" fill="#4a9793" />
        <path d="M116 60q-6 0-10 3M117 62q-5 2-8 6M119 63q-3 3-4 8M121 63q-1 4 0 7" fill="none" stroke="#4a9793" strokeWidth="1.500" strokeLinecap="round" />
      </g>
      {/* 긴 목의 바다 파충류: 오른쪽 위로 뻗은 목, 통통한 몸, 지느러미 둘, 왼쪽으로 늘어진 꼬리 */}
      <g fill="#3b7f88">
        <path d="M188 91q-3 1-3 4t4 3q34 3 62-1 14-2 26-9 12-7 26-22l40-38q10-9 22-12v-5q-16 3-30 14l-42 36q-12 10-24 14-10 4-22 6-28 6-59 10z" />
        <path d="M288 92q10 2 18 12 6 8 2 11-5 3-12-3-10-9-18-16z" />
        <path d="M322 62q12-4 28-3 6 1 6 4t-6 5q-14 4-28 2z" />
        <path d="M326 52q4-5 9-4l-2 6z" />
      </g>
      {/* 물고기 떼 */}
      {fish(101, 108, 1, '#3f8f95')}
      {fish(120, 114, 1, '#3f8f95')}
      {fish(80, 117, 1, '#3f8f95')}
      {fish(103, 131, 1, '#3f8f95')}
      {fish(108, 111, 1, '#8fd0c8')}
      {fish(93, 121, 1, '#8fd0c8')}
      {fish(112, 121, 1, '#8fd0c8')}
      {fish(76, 126, 1, '#8fd0c8')}
    </svg>
  );
}
