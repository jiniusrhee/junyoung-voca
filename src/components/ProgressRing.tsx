interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  unit?: string;
}

/** 말해보카 홈의 퍼센트 링 */
export default function ProgressRing({ value, size = 84, stroke = 5, label, unit = '%' }: Props) {
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
        <span className="ring-unit">{unit}</span>
      </div>
    </div>
  );
}
