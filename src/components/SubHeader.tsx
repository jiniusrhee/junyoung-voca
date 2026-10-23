import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

export default function SubHeader({ title, right }: { title: string; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sub-head">
      <button className="icon-btn" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))} aria-label="뒤로">
        <Icon name="back" size={22} />
      </button>
      <h1>{title}</h1>
      <div className="sub-head-right">{right}</div>
    </header>
  );
}
