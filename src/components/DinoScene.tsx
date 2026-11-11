/**
 * 어휘 퀴즈 아래쪽 풍경 — 말해보카 '다이노를 찾아서' 테마의 구성(민트 하늘, 옅은 안개, 크고 부드러운 산, 올리브·짙은 풀 띠, 물가, 공룡 두 마리)을
 * 참고해 직접 그린 SVG. 띠의 세로 위치와 색은 플립 실측(2026-11-11)에 맞췄다:
 *   레이어 높이 165 = 카드 아래 128(자판이 떠 있을 때 보이는 부분) + 37(정답 패널일 때 더 드러나는 물가)
 *   안개 5~25 · 산 25~107 · 올리브 띠 107~117 · 짙은 풀 117~141 · 물 141~165 (자판이 떠 있을 때는 풀까지만 보인다)
 * 컨테이너 아래에 붙고 가로 가운데 정렬(xMidYMax meet), 넓은 화면에서는 띠가 옆으로 이어진다.
 * variant: 0 기본, 1 화산, 2 저녁빛 산.
 */
export default function DinoScene({ className = '', variant = 0 }: { className?: string; variant?: number }) {
  const v = ((variant % 3) + 3) % 3;
  const far = v === 2 ? '#a3d2b9' : '#94cead';
  const main = '#9bd3b3';
  const face = v === 2 ? '#c4e6c6' : '#b7e4bf';
  const pale = '#def3dc';
  return (
    <svg className={`dino-scene ${className}`} viewBox="0 0 360 165" preserveAspectRatio="xMidYMax meet" overflow="visible" aria-hidden="true">
      <rect x="-800" y="-400" width="1960" height="565" fill="#bbe4df" />
      {/* 옅은 안개 */}
      <g fill="#e9f7e8">
        <ellipse cx="46" cy="24" rx="92" ry="26" />
        <ellipse cx="236" cy="30" rx="120" ry="24" />
        <ellipse cx="-260" cy="34" rx="220" ry="26" />
        <ellipse cx="620" cy="30" rx="240" ry="26" />
      </g>
      {/* 넓은 화면용 먼 능선 */}
      <path d="M-800 108 L-620 60 L-520 96 L-400 44 L-300 92 L-200 58 L-90 104 L0 108 Z M360 108 L450 70 L540 100 L640 48 L760 98 L880 62 L1000 104 L1160 108 Z" fill={far} />
      {/* 오른쪽 먼 산 */}
      <path d="M236 108 L322 -14 L420 108 Z" fill={far} />
      <path d="M322 -14 L296 36 L310 30 L302 62 L330 22 Z" fill={face} opacity="0.75" />
      {v === 1 && (
        <g>
          <path d="M306 8 L316 -8 L330 -8 L340 8 Z" fill="#f0a878" />
          <ellipse cx="323" cy="-12" rx="12" ry="5" fill="#f6cbb0" opacity="0.85" />
        </g>
      )}
      {/* 가운데 큰 산 */}
      <path d="M86 108 L170 -10 L272 108 Z" fill={main} />
      <path d="M170 -10 L118 62 L142 50 L134 84 L160 46 L152 78 L178 30 Z" fill={face} />
      <path d="M170 -10 L156 12 L166 8 L162 24 L176 4 Z" fill={pale} />
      {/* 왼쪽 둥근 산 */}
      <path d="M-6 108 Q26 56 52 40 Q70 30 88 42 Q112 62 136 108 Z" fill={face} />
      <path d="M52 40 Q70 30 88 42 Q80 52 70 48 Q62 58 52 50 Q46 46 52 40 Z" fill={pale} />
      {/* 올리브 띠 */}
      <path d="M-800 110 Q-300 100 60 108 T250 104 T470 108 T1160 106 V124 H-800 Z" fill="#8cb284" />
      {/* 스테고사우루스 (왼쪽) */}
      <g transform="translate(38 80)">
        <path d="M14 14 l3 -8 q2 -3 4 0 l3 8z M24 10 l4 -10 q2 -3 4 0 l4 10z M36 10 l4 -9 q2 -3 4 0 l3 9z M46 13 l3 -7 q2 -2 3 0 l3 7z" fill="#3a7173" />
        <path d="M2 26 q0 -9 10 -11 q10 -4 24 -4 q16 0 24 8 q5 4 8 4 q-4 5 -12 5 h-44 q-10 0 -10 -2z" fill="#3a7173" />
        <path d="M2 26 q-3 -1 -2 -5 q2 -4 8 -4 q4 0 6 3z" fill="#3a7173" />
        <rect x="14" y="27" width="6.5" height="10" rx="2.4" fill="#346568" />
        <rect x="24" y="28" width="6.5" height="9" rx="2.4" fill="#346568" />
        <rect x="42" y="28" width="6.5" height="9" rx="2.4" fill="#346568" />
        <circle cx="5" cy="22" r="1" fill="#1e3e40" />
      </g>
      {/* 아기 공룡 (왼쪽 끝) */}
      <g transform="translate(-6 92)" fill="#4a8083">
        <path d="M6 6 l2 -5 l3 5z M12 5 l2 -5 l3 5z" />
        <path d="M0 14 q0 -6 8 -7 h12 q8 1 12 6 q-3 3 -8 3 h-20 q-4 0 -4 -2z" />
        <rect x="6" y="14" width="4.5" height="7" rx="1.8" />
        <rect x="16" y="14" width="4.5" height="7" rx="1.8" />
      </g>
      {/* 브라키오사우루스 (오른쪽) */}
      <g transform="translate(280 16)">
        <path d="M8 86 Q6 50 6 22 Q6 8 14 6 q7 -1 9 5 q1 4 -4 5 q-3 1 -3 6 Q17 50 22 76z" fill="#427142" />
        <path d="M6 96 q-2 -18 16 -24 q20 -8 44 -2 q14 4 26 14 q10 8 26 8 v6 q-22 4 -40 -4 h-64 q-8 0 -8 -4z" fill="#427142" />
        <path d="M34 74 q18 -8 36 2 q10 6 16 14 q-22 6 -44 -2 q-8 -6 -8 -14z" fill="#5d8f5c" opacity="0.85" />
        <rect x="12" y="96" width="8" height="15" rx="3" fill="#3a6540" />
        <rect x="26" y="98" width="8" height="14" rx="3" fill="#3a6540" />
        <rect x="52" y="98" width="8" height="14" rx="3" fill="#3a6540" />
        <circle cx="17" cy="10.5" r="1.2" fill="#1f3d22" />
      </g>
      {/* 짙은 풀 띠 + 풀포기 */}
      <path d="M-800 120 Q-300 114 40 119 T230 117 T450 120 T1160 118 V150 H-800 Z" fill="#63865a" />
      <g fill="#587850">
        <path d="M30 119 l1 -6 l2 5 l2 -7 l2 7 l2 -5 l1 6z" />
        <path d="M58 119 l2 -5 l3 3 l3 -4 l2 6z" />
        <path d="M116 118 l1 -6 l2 5 l2 -7 l2 7 l2 -5 l1 6z" />
        <path d="M204 118 l2 -5 l3 3 l3 -4 l2 6z" />
        <path d="M262 118 l1 -6 l2 5 l2 -7 l2 7 l2 -5 l1 6z" />
        <path d="M316 119 l2 -5 l3 3 l3 -4 l2 6z" />
        <path d="M340 119 l1 -6 l2 5 l2 -7 l2 7 l2 -5 l1 6z" />
      </g>
      {/* 물가 */}
      <path d="M-800 143 Q-300 138 50 142 T240 140 T460 143 T1160 141 V200 H-800 Z" fill="#6bb6ad" />
      <path d="M-800 143 Q-300 138 50 142 T240 140 T460 143 T1160 141" fill="none" stroke="#8cc6c5" strokeWidth="2.2" />
      <g fill="#4e9d9c">
        <path d="M276 150 q6 4 12 0 q-6 1.6 -12 0z" />
        <path d="M290 150 q5 3.4 10 0 q-5 1.4 -10 0z" />
        <path d="M40 158 q6 4 12 0 q-6 1.6 -12 0z" />
      </g>
      <g fill="#d5efec">
        <path d="M250 160 q7 3 14 0 q-7 1.2 -14 0z" />
        <path d="M60 152 q6 3 12 0 q-6 1.2 -12 0z" />
        <path d="M150 159 q6 3 12 0 q-6 1.2 -12 0z" />
      </g>
    </svg>
  );
}
