import Icon from './Icon';

/**
 * 카드 레벨 탭의 '?' 를 누르면 뜨는 "단어 레벨이란?" 설명 팝업 (말해보카의 팝업 구성을 따름: 제목 + × / 글머리 4개 / 레벨-이해도 곡선 차트).
 * 글은 우리 말로 쓴 것이고, 곡선은 "레벨 N 이하를 다 알 때 영어 문장 단어의 몇 %를 아는가"를 단순 모형(1 - e^(-0.13·N))으로 그린다.
 */
export default function LevelHelp({ level, onClose }: { level: number; onClose: () => void }) {
  const pct = (n: number) => 100 * (1 - Math.exp(-0.13 * n));
  const W = 300;
  const H = 150;
  const x0 = 46;
  const y0 = 14;
  const plotW = W - x0 - 20;
  const plotH = H - y0 - 28;
  const px = (n: number) => x0 + (n / 30) * plotW;
  const py = (p: number) => y0 + plotH - (p / 100) * plotH;
  const pts = Array.from({ length: 61 }, (_, i) => `${px(i / 2).toFixed(1)},${py(pct(i / 2)).toFixed(1)}`).join(' ');
  const cur = Math.max(1, Math.min(30, level));
  const curPct = pct(cur);
  return (
    <div className="modal-dim level-help-dim" onClick={onClose}>
      <div className="level-help-card" onClick={(e) => e.stopPropagation()}>
        <div className="level-help-head">
          <span>&quot;단어 레벨&quot;이란?</span>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" size={22} />
          </button>
        </div>
        <ul className="level-help-list">
          <li>
            준영보카는 영어 자료를 바탕으로 <b>모든 단어에 1부터 30까지 레벨을 매겨요</b>.
          </li>
          <li>
            <b>자주 쓰이는 단어일수록 낮은 레벨</b>, <b>드물게 쓰이는 단어일수록 높은 레벨</b>이에요.
          </li>
          <li>
            뜻이 여러 개인 단어는 <b>뜻마다 따로 레벨</b>을 매겨요.
          </li>
          <li>
            레벨 {cur} 이하의 단어를 모두 안다면, 영어 문장에 나오는 단어의 약 {curPct.toFixed(1)}%를 바로 이해할 수 있어요.
          </li>
        </ul>
        <div className="level-help-chart">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
            <text x={x0} y={8} className="lh-axis-title">
              영어 이해도
            </text>
            <line x1={x0} y1={y0} x2={x0} y2={y0 + plotH} className="lh-axis" />
            <line x1={x0} y1={y0 + plotH} x2={x0 + plotW} y2={y0 + plotH} className="lh-axis" />
            {[20, 40, 60, 80].map((p) => (
              <text key={p} x={x0 - 6} y={py(p) + 4} textAnchor="end" className="lh-tick">
                {p}%
              </text>
            ))}
            {[0, 5, 10, 15, 20, 25].map((n) => (
              <text key={n} x={px(n)} y={y0 + plotH + 16} textAnchor="middle" className="lh-tick">
                {n}
              </text>
            ))}
            <text x={x0 + plotW + 2} y={y0 + plotH + 16} textAnchor="end" className="lh-tick">
              레벨
            </text>
            <polygon points={`${px(0)},${py(0)} ${pts} ${px(30)},${py(0)}`} className="lh-area" />
            <polyline points={pts} className="lh-line" />
            <line x1={px(cur)} y1={py(curPct)} x2={px(cur)} y2={y0 + plotH} className="lh-guide" />
            <line x1={x0} y1={py(curPct)} x2={px(cur)} y2={py(curPct)} className="lh-guide" />
            <circle cx={px(cur)} cy={py(curPct)} r={5} className="lh-dot" />
            <rect x={x0 - 44} y={py(curPct) - 10} width={40} height={20} rx={10} className="lh-badge" />
            <text x={x0 - 24} y={py(curPct) + 4} textAnchor="middle" className="lh-badge-text">
              {curPct.toFixed(1)}%
            </text>
            <rect x={px(cur) - 14} y={y0 + plotH + 4} width={28} height={18} rx={9} className="lh-badge" />
            <text x={px(cur)} y={y0 + plotH + 17} textAnchor="middle" className="lh-badge-text">
              {cur}
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
