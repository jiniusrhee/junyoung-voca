import type { CSSProperties } from 'react';
import Mascot from './Mascot';

/** 실전 회화 장면 배경 (직접 그린 단순 일러스트) */
const SCENES: Record<string, { sky: [string, string]; ground: string; accent: string; kind: string }> = {
  street: { sky: ['#f5c79a', '#89b7d9'], ground: '#b9a58f', accent: '#d9734e', kind: 'street' },
  campus: { sky: ['#bfe3ff', '#e8f6ff'], ground: '#7fbf6a', accent: '#b5523b', kind: 'campus' },
  office: { sky: ['#d8dde6', '#f3f5f8'], ground: '#9aa3b2', accent: '#3d6fb6', kind: 'office' },
  city: { sky: ['#1f2a4f', '#f0a36b'], ground: '#4b4f5c', accent: '#ffd25e', kind: 'city' },
  home: { sky: ['#f7e3c4', '#f9efe0'], ground: '#b98b5f', accent: '#7a9e7e', kind: 'home' },
  cafe: { sky: ['#6d5a4b', '#a28872'], ground: '#5b4636', accent: '#f0c27b', kind: 'cafe' },
};

export function sceneOf(scene: string) {
  return SCENES[scene] ?? SCENES.street;
}

export default function SceneArt({ scene, withCharacter = true, style, dim = false }: { scene: string; withCharacter?: boolean; style?: CSSProperties; dim?: boolean }) {
  const s = sceneOf(scene);
  return (
    <div className={`scene-art ${dim ? 'dim' : ''}`} style={style}>
      <svg viewBox="0 0 390 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`sky-${scene}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.sky[0]} />
            <stop offset="1" stopColor={s.sky[1]} />
          </linearGradient>
        </defs>
        <rect width="390" height="600" fill={`url(#sky-${scene})`} />
        {s.kind === 'street' && (
          <g>
            <rect x="0" y="120" width="120" height="380" fill="#a8553d" opacity="0.85" />
            <rect x="270" y="90" width="120" height="410" fill="#7c8a99" opacity="0.8" />
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="20" y={150 + i * 80} width="36" height="46" rx="4" fill="#f6dfb5" opacity="0.8" />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} x="300" y={120 + i * 85} width="50" height="50" rx="4" fill="#dfe8f2" opacity="0.7" />
            ))}
            <path d="M270 330 h120 v28 h-120z" fill={s.accent} opacity="0.9" />
          </g>
        )}
        {s.kind === 'campus' && (
          <g>
            <path d="M80 300 L195 210 L310 300 Z" fill="#c9b79a" />
            <rect x="95" y="300" width="200" height="140" fill="#e0d2b8" />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect key={i} x={110 + i * 38} y="320" width="14" height="110" fill="#bfae90" />
            ))}
            <circle cx="40" cy="380" r="46" fill="#5aa04f" />
            <circle cx="350" cy="370" r="52" fill="#4f9346" />
          </g>
        )}
        {s.kind === 'office' && (
          <g>
            <rect x="0" y="80" width="390" height="40" fill="#c4ccd8" />
            {[0, 1, 2].map((i) => (
              <rect key={i} x={30 + i * 120} y="150" width="90" height="150" rx="6" fill="#e9eef5" stroke="#c4ccd8" strokeWidth="4" />
            ))}
            <rect x="40" y="380" width="310" height="20" rx="6" fill="#8a6a4f" />
            <rect x="160" y="330" width="70" height="46" rx="4" fill="#2e3440" />
          </g>
        )}
        {s.kind === 'city' && (
          <g>
            {[30, 90, 150, 210, 270, 330].map((x, i) => (
              <rect key={x} x={x} y={180 + (i % 3) * 40} width="50" height="420" fill="#20253d" />
            ))}
            {Array.from({ length: 30 }, (_, i) => (
              <rect key={i} x={38 + (i % 6) * 60} y={200 + Math.floor(i / 6) * 50} width="10" height="14" fill={s.accent} opacity={0.5 + (i % 3) * 0.2} />
            ))}
          </g>
        )}
        {s.kind === 'home' && (
          <g>
            <rect x="40" y="140" width="130" height="150" rx="8" fill="#fffaf2" stroke="#c9a77d" strokeWidth="6" />
            <line x1="105" y1="140" x2="105" y2="290" stroke="#c9a77d" strokeWidth="5" />
            <rect x="230" y="300" width="140" height="100" rx="14" fill={s.accent} />
            <rect x="250" y="200" width="16" height="100" fill="#8a6a4f" />
            <circle cx="258" cy="190" r="34" fill="#f2d48a" opacity="0.9" />
          </g>
        )}
        {s.kind === 'cafe' && (
          <g>
            <circle cx="195" cy="60" r="18" fill="#fff3c4" opacity="0.9" />
            <path d="M160 60 L195 20 L230 60 Z" fill="#3b2f26" />
            <rect x="110" y="330" width="170" height="90" rx="10" fill="#efe5d8" />
            <rect x="40" y="200" width="70" height="200" rx="8" fill="#4a3a2d" opacity="0.7" />
            <rect x="280" y="200" width="70" height="200" rx="8" fill="#4a3a2d" opacity="0.7" />
          </g>
        )}
        <rect x="0" y="500" width="390" height="100" fill={s.ground} />
      </svg>
      {withCharacter && (
        <div className="scene-char">
          <Mascot size={210} />
        </div>
      )}
    </div>
  );
}
