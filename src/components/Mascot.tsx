/** 준영보카 마스코트 (직접 그린 단순 일러스트) */
export default function Mascot({ size = 120, mood = 'happy' }: { size?: number; mood?: 'happy' | 'cheer' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <ellipse cx="60" cy="110" rx="34" ry="6" fill="#000" opacity="0.08" />
      {/* 귀 */}
      <path d="M30 34 L26 10 L48 26 Z" fill="#7c63f2" />
      <path d="M90 34 L94 10 L72 26 Z" fill="#7c63f2" />
      <path d="M32 30 L30 16 L43 26 Z" fill="#ffb3cf" />
      <path d="M88 30 L90 16 L77 26 Z" fill="#ffb3cf" />
      {/* 몸 */}
      <rect x="18" y="20" width="84" height="86" rx="40" fill="#8f78f6" />
      <ellipse cx="60" cy="80" rx="26" ry="20" fill="#b3a5fa" />
      {/* 눈 */}
      <circle cx="44" cy="54" r="13" fill="#fff" />
      <circle cx="76" cy="54" r="13" fill="#fff" />
      <circle cx="46" cy="56" r="7.5" fill="#26215c" />
      <circle cx="74" cy="56" r="7.5" fill="#26215c" />
      <circle cx="49" cy="52.5" r="2.6" fill="#fff" />
      <circle cx="77" cy="52.5" r="2.6" fill="#fff" />
      {/* 볼 */}
      <ellipse cx="33" cy="70" rx="5.5" ry="3.5" fill="#ff9cc2" opacity="0.8" />
      <ellipse cx="87" cy="70" rx="5.5" ry="3.5" fill="#ff9cc2" opacity="0.8" />
      {/* 입 */}
      {mood === 'cheer' ? (
        <path d="M51 68 Q60 80 69 68 Z" fill="#26215c" />
      ) : (
        <path d="M53 69 Q60 75 67 69" stroke="#26215c" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {/* 책 */}
      <g transform="translate(60 96)">
        <path d="M-22 -8 Q-11 -13 0 -8 L0 8 Q-11 3 -22 8 Z" fill="#ffd45c" />
        <path d="M22 -8 Q11 -13 0 -8 L0 8 Q11 3 22 8 Z" fill="#ffe28f" />
      </g>
    </svg>
  );
}
