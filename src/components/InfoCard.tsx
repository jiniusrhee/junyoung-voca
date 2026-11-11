import type { ReactNode } from 'react';

/**
 * 정답 후 '다른 예문'을 누르면 퀴즈 카드 자리에 대신 나오는 카드 (말해보카 '빅데이터 예문' 카드 실측 2026-11-11):
 * 높이 335.67 (보통 카드보다 위로 8.3, 아래로 36.7 더 큼), 반지름 12, 머리줄 46.67 + 어두운 띠 4.33,
 * 예문마다 영어 문장(17.33px) · 오른쪽 작은 회색 줄 · 가운데 스피커, 예문 사이 어두운 띠 8.
 */
export default function InfoCard({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="info-card">
      <div className="info-card-head">
        <span className="info-card-title">
          {icon}
          <span>{title}</span>
        </span>
        {right && <span className="info-card-right">{right}</span>}
      </div>
      <div className="info-card-body">{children}</div>
    </div>
  );
}
