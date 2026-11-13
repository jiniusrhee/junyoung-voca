import type { ReactNode } from 'react';
import Icon from './Icon';

/** 목록 화면 헤더 오른쪽: 가방 아이콘 + N / 500 (말해보카) */
export function BagCount({ n, max = 500 }: { n: number; max?: number }) {
  return (
    <span className="bag-count">
      <svg width="18" height="18.333" viewBox="0 0 18 18.333" aria-hidden="true">
        <path d="M5.300 0.800h7.400c0.500 0 0.800 0.500 0.600 0.950L12.300 4.300H5.700L4.700 1.750C4.500 1.300 4.800 0.800 5.300 0.800z" fill="currentColor" />
        <path d="M5.600 5.300h6.800c3.000 2.300 5.100 5.300 5.100 8.300 0 2.900-2.100 4.400-5.000 4.400H5.500c-2.900 0-5.000-1.500-5.000-4.400 0-3.000 2.100-6.000 5.100-8.300z" fill="currentColor" />
      </svg>
      <span lang="en">
        {n} / {max}
      </span>
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
