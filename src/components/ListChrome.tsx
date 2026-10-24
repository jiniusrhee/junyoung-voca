import type { ReactNode } from 'react';
import Icon from './Icon';

/** 목록 화면 헤더 오른쪽: 가방 아이콘 + N / 500 (말해보카) */
export function BagCount({ n, max = 500 }: { n: number; max?: number }) {
  return (
    <span className="bag-count">
      <Icon name="bag" size={18} /> {n} / {max}
    </span>
  );
}

/** 칩 줄 + 오른쪽 편집 버튼 */
export function ListFilters({ children, editing, onEdit }: { children: ReactNode; editing?: boolean; onEdit?: () => void }) {
  return (
    <div className="list-filters">
      {children}
      {onEdit && (
        <button className={`edit-btn ${editing ? 'on' : ''}`} onClick={onEdit}>
          <Icon name="gear" size={16} /> {editing ? '완료' : '편집'}
        </button>
      )}
    </div>
  );
}

export function EmptyBox({ text = '표시할 항목이 없어요.' }: { text?: string }) {
  return (
    <div className="lw-empty">
      <Icon name="info" size={26} />
      <p>{text}</p>
    </div>
  );
}
