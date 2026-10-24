import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useInbox } from '../lib/inbox';

/** 알림함 (말해보카: 날짜별 알림 카드, 오른쪽 위 ⚙ 는 알림 설정) */
export default function Inbox() {
  const nav = useNavigate();
  const items = useInbox();
  let last = '';
  return (
    <div className="vs-page inbox-page">
      <header className="vs-head">
        <button className="vs-back" onClick={() => nav(-1)}>
          <Icon name="back" size={22} /> 알림함
        </button>
        <button className="icon-btn" onClick={() => nav('/settings/mode/notice')} aria-label="알림 설정">
          <Icon name="gear" size={22} />
        </button>
      </header>
      <div className="inbox-list">
        {(items ?? []).map((it) => {
          const head = it.date !== last ? it.date.slice(2).replace(/-/g, '.') : null;
          last = it.date;
          return (
            <Fragment key={it.id}>
              {head && <p className="inbox-date">{head}</p>}
              <button className="inbox-card" onClick={() => it.to && nav(it.to)}>
                <span className="inbox-title">
                  <b>{it.title}</b>
                  <small>{it.time}</small>
                </span>
                <span className="inbox-body">
                  {it.body}
                  {it.to && <Icon name="chevron" size={16} className="muted-ic" />}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>
      <p className="inbox-note">최근 30일 동안의 알림이 표시돼요.</p>
    </div>
  );
}
