/** 말해보카 홈의 계기판 모양 진행률 (아래가 트인 270도 원호) */
export default function GaugeRing({ value, size = 76, stroke = 8, label }: { value: number; size?: number; stroke?: number; label: string }) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const sweep = 270;
  const arcLen = (2 * Math.PI * r * sweep) / 360;
  const p = Math.min(1, Math.max(0, value));
  // 135도(왼쪽 아래)에서 시작해 시계 방향으로 270도
  const start = polar(c, c, r, 135);
  const end = polar(c, c, r, 135 + sweep);
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <path d={d} className="gauge-track" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        <path d={d} className="gauge-fill" strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={arcLen} strokeDashoffset={arcLen * (1 - p)} />
      </svg>
      <div className="gauge-label">
        <b>{label}</b>
        <small>%</small>
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
