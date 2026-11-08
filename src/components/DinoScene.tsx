/**
 * 어휘 퀴즈 아래쪽 풍경 — 말해보카 '다이노를 찾아서' 테마의 느낌(민트 하늘, 눈 덮인 산, 풀밭, 물가, 공룡 두 마리)을
 * 직접 그린 SVG. 컨테이너를 꽉 채우고 가로 기준으로 잘라 보여 준다(xMidYMax slice). viewBox 세로 167 = 카드 아래 130 + 자판 뒤 37.
 * variant: 0 기본, 1 화산, 2 저녁 노을빛 산.
 */
export default function DinoScene({ className = '', variant = 0 }: { className?: string; variant?: number }) {
  const v = ((variant % 3) + 3) % 3;
  const snow = v === 2 ? '#f6f1ea' : '#effbef';
  const far = v === 2 ? '#a9d4bd' : '#9cd2b5';
  const mid = v === 2 ? '#8fc4a6' : '#86c39f';
  const near = '#6fae86';
  return (
    <svg className={`dino-scene ${className}`} viewBox="0 0 360 167" preserveAspectRatio="xMidYMax meet" overflow="visible" aria-hidden="true">
      <rect x="-800" width="1960" height="167" fill="#bbe4df" />
      <g transform="translate(0 -34)">
      {/* 먼 산 (눈) */}
      <path d="M-800 96 L-440 70 L-300 94 L-180 60 L-60 90 L-10 92 L28 46 L52 66 L78 30 L110 70 L128 54 L150 78 L190 22 L228 72 L252 50 L276 70 L312 28 L340 66 L372 44 L430 84 L540 56 L660 92 L780 62 L900 90 L1160 80 V110 H-800 Z" fill={far} />
      <path d="M78 30 L92 48 L84 46 L78 52 L70 44 L64 46 Z M190 22 L206 44 L196 40 L190 48 L182 40 L174 44 Z M312 28 L326 46 L318 42 L312 50 L304 42 L298 46 Z" fill={snow} />
      {v === 1 && (
        <g>
          <path d="M228 72 L244 40 L262 40 L286 72 Z" fill="#7fa98f" />
          <path d="M244 40 L249 36 L253 42 L257 36 L262 40 L256 46 L250 46 Z" fill="#f4b183" />
          <ellipse cx="253" cy="33" rx="10" ry="4" fill="#f7c9a8" opacity="0.8" />
        </g>
      )}
      {/* 가까운 산 */}
      <path d="M-800 112 L-500 96 L-380 110 L-240 90 L-120 108 L-10 108 L22 80 L48 96 L84 72 L124 102 L152 88 L186 104 L214 86 L246 104 L280 82 L318 106 L346 92 L372 104 L460 90 L580 108 L700 92 L820 110 L1160 100 V124 H-800 Z" fill={mid} />
      <path d="M84 72 L92 84 L84 82 L78 88 L72 82 L66 84 Z M280 82 L288 92 L280 90 L274 96 L268 90 L262 92 Z" fill={snow} opacity="0.9" />
      {/* 풀밭 */}
      <path d="M-800 118 Q-500 110 -200 118 T240 116 T700 118 T1160 118 V140 H-800 Z" fill={near} />
      <path d="M-800 128 Q-500 122 -200 130 T250 128 T700 130 T1160 130 V146 H-800 Z" fill="#63815a" />
      {/* 풀잎 */}
      <g stroke="#4f6e4a" strokeWidth="1.4" strokeLinecap="round" fill="none">
        <path d="M30 128 l-2 -6 M34 129 l1 -7 M120 126 l-2 -6 M124 127 l2 -6 M200 129 l-1 -7 M296 127 l-2 -6 M300 128 l2 -6" />
      </g>
      {/* 스테고사우루스 (왼쪽) */}
      <g transform="translate(40 94)">
        <path d="M6 20 q-8 -3 -14 4 q7 -1 13 1z" fill="#3f6f80" />
        <path d="M4 14 l5 -9 l4 8 l4 -10 l4 9 l5 -10 l4 9 l4 -8 l3 8 l3 -5 l2 6z" fill="#3a6a7b" />
        <ellipse cx="24" cy="24" rx="22" ry="11" fill="#43788a" />
        <path d="M44 20 q8 -3 12 2 q-2 4 -10 4z" fill="#43788a" />
        <circle cx="50" cy="22.5" r="1.2" fill="#1f3a43" />
        <rect x="10" y="30" width="5" height="9" rx="2.2" fill="#3a6a7b" />
        <rect x="20" y="31" width="5" height="9" rx="2.2" fill="#3a6a7b" />
        <rect x="30" y="31" width="5" height="9" rx="2.2" fill="#3a6a7b" />
        <path d="M0 24 q-10 2 -16 10 q10 -3 18 -6z" fill="#43788a" />
        <path d="M-12 31 l-3 -4 M-9 33 l-4 -3" stroke="#43788a" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* 아기 공룡 (왼쪽 끝) */}
      <g transform="translate(-4 106)">
        <ellipse cx="10" cy="22" rx="12" ry="7" fill="#3f6f80" />
        <path d="M2 16 l3 -5 l3 4 l3 -5 l3 4 l3 -4 l2 4z" fill="#365f6e" />
        <path d="M20 20 q5 -2 8 1 q-1 3 -6 3z" fill="#3f6f80" />
      </g>
      {/* 브라키오사우루스 (오른쪽) */}
      <g transform="translate(262 40)">
        <path d="M28 86 Q22 50 20 30 Q19 14 26 8 q6 -4 12 2 q2 4 -2 6 q-5 1 -6 8 q1 24 10 50z" fill="#4d8a62" />
        <ellipse cx="48" cy="90" rx="34" ry="16" fill="#4d8a62" />
        <path d="M80 86 q22 2 32 14 q-16 0 -34 -6z" fill="#4d8a62" />
        <rect x="26" y="100" width="9" height="20" rx="4" fill="#447c57" />
        <rect x="44" y="102" width="9" height="20" rx="4" fill="#447c57" />
        <rect x="60" y="100" width="9" height="20" rx="4" fill="#447c57" />
        <circle cx="34" cy="13" r="1.4" fill="#1f3d2a" />
        <circle cx="52" cy="84" r="4" fill="#5f9c72" opacity="0.7" />
        <circle cx="66" cy="92" r="3" fill="#5f9c72" opacity="0.7" />
      </g>
      </g>
      {/* 물가 */}
      <path d="M-800 106 Q-500 102 -200 106 T270 104 T700 106 T1160 106 V167 H-800 Z" fill="#9ccfe0" />
      <path d="M-800 112 Q-500 108 -200 112 T280 110 T700 112 T1160 112" fill="none" stroke="#b6dfeb" strokeWidth="1.6" />
      <g fill="none" stroke="#d7eef5" strokeWidth="1.4" strokeLinecap="round">
        <path d="M120 122 q4 -3 8 0 q4 3 8 0" />
        <path d="M214 128 q4 -3 8 0 q4 3 8 0" />
        <path d="M300 120 q4 -3 8 0 q4 3 8 0" />
        <path d="M60 150 q4 -3 8 0 q4 3 8 0" />
        <path d="M250 156 q4 -3 8 0 q4 3 8 0" />
      </g>
      <path d="M248 118 q6 -6 12 0 q-6 2 -12 0z" fill="#6aa9bd" />
    </svg>
  );
}
