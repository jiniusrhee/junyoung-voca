import { useEffect, useState } from 'react';

/**
 * 앱을 켠 직후 홈의 고리가 차오르는 곡선 (말해보카 60fps 녹화 실측 2026-11-11).
 * 홈이 보이고 0.28초 뒤부터 0.62초 동안: 처음엔 느리게, 30~40% 구간에서 빠르게, 끝은 느리게. [시간 비율, 값 비율]
 */
const INTRO_CURVE: [number, number][] = [
  [0, 0],
  [0.054, 0.019],
  [0.081, 0.029],
  [0.19, 0.067],
  [0.3, 0.19],
  [0.35, 0.39],
  [0.405, 0.5],
  [0.51, 0.66],
  [0.62, 0.85],
  [0.73, 0.94],
  [0.84, 0.99],
  [1, 1],
];
const INTRO_DELAY = 283;
const INTRO_MS = 617;

export function introAt(f: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  for (let i = 1; i < INTRO_CURVE.length; i++) {
    const [t1, v1] = INTRO_CURVE[i];
    if (f <= t1) {
      const [t0, v0] = INTRO_CURVE[i - 1];
      return v0 + ((v1 - v0) * (f - t0)) / (t1 - t0);
    }
  }
  return 1;
}

/**
 * 말해보카 홈의 계기판 모양 진행률 (아래가 트인 270도 원호).
 * percent: 가운데 숫자(100 을 넘을 수 있다). intro 면 0 에서 숫자와 고리가 함께 차오른다.
 */
export default function GaugeRing({ percent, size = 76, stroke = 8, intro = false, introLag = 0 }: { percent: number; size?: number; stroke?: number; intro?: boolean; introLag?: number }) {
  const [k, setK] = useState(intro ? 0 : 1);
  useEffect(() => {
    if (!intro) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = (now - t0 - INTRO_DELAY - introLag) / INTRO_MS;
      setK(introAt(f));
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [intro, introLag]);

  const r = (size - stroke) / 2;
  const c = size / 2;
  // 플립 실측: 아래쪽이 100도 트여 있다 (호 260도, 끝은 둥글다)
  const sweep = 260;
  const arcLen = (2 * Math.PI * r * sweep) / 360;
  const shown = Math.round(percent * k);
  const p = Math.min(1, Math.max(0, shown / 100));
  // 140도(왼쪽 아래)에서 시작해 시계 방향으로 260도
  const start = polar(c, c, r, 140);
  const end = polar(c, c, r, 140 + sweep);
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  // 숫자가 차오르는 동안(k < 1)에는 고리가 숫자를 그대로 따라가게 전환을 끈다
  return (
    <div className={`gauge ${k < 1 ? 'counting' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <path d={d} className="gauge-track" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {p > 0 && <path d={d} className="gauge-fill" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={arcLen} strokeDashoffset={arcLen * (1 - p)} />}
      </svg>
      <div className="gauge-label" lang="en">
        {(k > 0 || !intro) && <b>{shown}</b>}
        <small>%</small>
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
