import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: '홈', icon: '🏠' },
  { to: '/words', label: '어휘', icon: '📚' },
  { to: '/stats', label: '통계', icon: '📈' },
  { to: '/settings', label: '설정', icon: '⚙️' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">{it.icon}</span>
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
