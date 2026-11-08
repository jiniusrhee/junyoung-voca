import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

/**
 * 정답 후 '다른 예문'·'오답 노트'를 누르면 퀴즈 카드 자리에 대신 나오는 카드 (말해보카 '빅데이터 예문' 카드).
 * 머리줄: 아이콘 + 제목, 오른쪽 보조 컨트롤. ※ 임시 스텁 — 모양은 panel 작업에서 맞춘다.
 */
export default function InfoCard({ icon, title, right, children }: { icon: IconName; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="info-card">
      <div className="info-card-head">
        <span className="info-card-title">
          <Icon name={icon} size={18} /> {title}
        </span>
        {right && <span className="info-card-right">{right}</span>}
      </div>
      <div className="info-card-body">{children}</div>
    </div>
  );
}
