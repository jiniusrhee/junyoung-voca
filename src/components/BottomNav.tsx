import { NavLink } from 'react-router-dom';
import Icon, { type IconName } from './Icon';

const items: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '어휘', icon: 'book' },
  { to: '/stats', label: '기록', icon: 'chart' },
  { to: '/dict', label: '사전', icon: 'search' },
  { to: '/settings', label: '설정', icon: 'gear' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Icon name={it.icon} size={24} />
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
