import { useEffect } from 'react';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { studyDateOf } from '../lib/time';

/** 설정 > 알림 > 학습 알림: 앱이 켜져 있을 때 정한 시각에 오늘 학습이 없으면 알림을 띄운다 (말해보카의 학습 시간 알림) */
export default function StudyReminder() {
  const s = useSettings();
  const on = !!s?.notifyStudy;
  const at = s?.notifyTime ?? '20:00';
  const dnd = s?.dndOn ? `${s.dndFrom}-${s.dndTo}` : '';
  useEffect(() => {
    if (!on || typeof Notification === 'undefined') return;
    const tick = async () => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hm !== at || Notification.permission !== 'granted') return;
      if (dnd) {
        const [from, to] = dnd.split('-');
        const inRange = from <= to ? hm >= from && hm < to : hm >= from || hm < to;
        if (inRange) return;
      }
      const key = `reminded:${studyDateOf()}`;
      if (localStorage.getItem(key)) return;
      const today = await db.daily.get(studyDateOf());
      if ((today?.total ?? 0) > 0) return;
      localStorage.setItem(key, '1');
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        const opts = { body: '오늘의 학습을 시작해 볼까요? 연속 학습을 이어가요.', icon: `${import.meta.env.BASE_URL}icons/icon-192.png` };
        if (reg) await reg.showNotification('준영보카', opts);
        else new Notification('준영보카', opts);
      } catch {
        /* 알림 실패는 무시 */
      }
    };
    const id = window.setInterval(() => void tick(), 30_000);
    void tick();
    return () => window.clearInterval(id);
  }, [on, at, dnd]);
  return null;
}
