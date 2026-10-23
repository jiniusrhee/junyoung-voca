interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sub?: string;
}

export default function ProgressRing({ value, size = 120, stroke = 12, label, sub }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fg"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">
        <span className="ring-value">{label}</span>
        {sub && <span className="ring-sub">{sub}</span>}
      </div>
    </div>
  );
}
