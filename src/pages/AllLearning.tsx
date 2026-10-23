import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../components/Icon';
import { db } from '../db';
import { useSettings } from '../lib/settings';

/** 말해보카 '전체 학습' 탭: 학습 모드, 내 목록, 사전 */
export default function AllLearning() {
  const nav = useNavigate();
  const settings = useSettings();
  const counts = useLiveQuery(
    async () => ({
      fav: await db.favorites.count(),
      wrongs: await db.reviews.filter((r) => (r.wrongs?.length ?? 0) > 0).count(),
      learned: await db.cards.count(),
    }),
    [],
  );
  if (!settings) return null;

  return (
    <div className="screen all-learning">
      <header className="home-head">
        <button className="head-menu" onClick={() => nav('/settings')} aria-label="설정 메뉴">
          <Icon name="list" size={26} />
          <span>{settings.nickname}</span>
        </button>
        <span className="head-bell">
          <Icon name="bell" size={26} />
        </span>
      </header>

      <h2 className="al-title">학습 모드</h2>
      <div className="al-chips">
        <span className="al-chip active">어휘</span>
      </div>
      <button className="mode-card" onClick={() => nav('/quiz')}>
        <span className="mode-card-ribbon">
          <Icon name="trophy" size={20} />
        </span>
        <span className="mode-card-text">
          <b>어휘 학습</b>
          <span>
            하루 목표 {settings.dailyGoal} 개 <Icon name="pencil" size={13} />
          </span>
        </span>
        <span className="mode-card-play">
          <Icon name="play" size={34} />
        </span>
      </button>

      <ul className="al-list">
        <Row to="/favorites" icon="heartFill" tint="pink" label="내가 좋아하는 문장" count={counts?.fav} />
        <Row to="/wrongs" icon="xcircle" tint="plain" label="내 오답노트" count={counts?.wrongs} />
        <Row to="/words" icon="hourglass" tint="teal" label="내가 학습한 어휘" count={counts?.learned} />
      </ul>

      <div className="al-sep" />
      <h2 className="al-title">사전</h2>
      <ul className="al-list">
        <Row to="/dict" icon="search" tint="blue" label="단어 사전" />
      </ul>

      <div className="al-sep" />
      <h2 className="al-title">기타</h2>
      <ul className="al-list">
        <Row to="/test" icon="chart" tint="purple" label="어휘력 측정 (레벨 테스트)" />
        <Row to="/settings" icon="gear" tint="plain" label="설정" />
      </ul>
    </div>
  );
}

function Row({ to, icon, label, tint, count }: { to: string; icon: IconName; label: string; tint: string; count?: number }) {
  return (
    <li>
      <Link to={to} className="al-row">
        <span className={`al-icon ${tint}`}>
          <Icon name={icon} size={20} />
        </span>
        <span className="al-label">{label}</span>
        {count != null && count > 0 && <span className="al-count">{count}</span>}
        <Icon name="chevron" size={18} className="muted-ic" />
      </Link>
    </li>
  );
}
