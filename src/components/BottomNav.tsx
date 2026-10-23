import { NavLink } from 'react-router-dom';
import Icon, { type IconName } from './Icon';

/** 말해보카 하단 탭 (리그·프리미엄 제외) */
const items: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '홈', icon: 'house' },
  { to: '/stats', label: '학습 통계', icon: 'pie' },
  { to: '/all', label: '전체 학습', icon: 'grid' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name={it.icon} size={28} />
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
