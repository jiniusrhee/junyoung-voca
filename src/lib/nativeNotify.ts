import { Capacitor } from '@capacitor/core';

/** 안드로이드 앱: 학습 알림을 OS 예약 알림으로 (앱이 꺼져 있어도 정한 시각에 울린다) */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

type LN = typeof import('@capacitor/local-notifications').LocalNotifications;
let ln: LN | null = null;
// 플러그인 프록시는 then 도 메서드로 취급하므로 객체로 감싸 돌려준다
async function load(): Promise<{ p: LN }> {
  if (!ln) ln = (await import('@capacitor/local-notifications')).LocalNotifications;
  return { p: ln };
}

const STUDY_ID = 1;

export type NativePerm = 'granted' | 'denied' | 'prompt';

export async function nativeNotifyPermission(): Promise<NativePerm> {
  const { p } = await load();
  const r = await p.checkPermissions();
  return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'prompt';
}

export async function nativeNotifyRequest(): Promise<NativePerm> {
  const { p } = await load();
  const r = await p.requestPermissions();
  return r.display === 'granted' ? 'granted' : 'denied';
}

/** 매일 hh:mm 에 학습 알림 예약. dnd 구간에 들면 예약하지 않는다. on=false 면 취소 */
export async function scheduleStudyReminder(on: boolean, hhmm: string, dnd: { from: string; to: string } | null): Promise<'scheduled' | 'cancelled' | 'skipped-dnd' | 'no-permission'> {
  const { p } = await load();
  await p.cancel({ notifications: [{ id: STUDY_ID }] }).catch(() => undefined);
  if (!on) return 'cancelled';
  if (dnd) {
    const inDnd = dnd.from <= dnd.to ? hhmm >= dnd.from && hhmm < dnd.to : hhmm >= dnd.from || hhmm < dnd.to;
    if (inDnd) return 'skipped-dnd';
  }
  if ((await nativeNotifyPermission()) !== 'granted') return 'no-permission';
  const [hour, minute] = hhmm.split(':').map(Number);
  await p.schedule({
    notifications: [
      {
        id: STUDY_ID,
        title: '준영보카',
        body: '오늘의 학습을 시작해 볼까요? 연속 학습을 이어가요.',
        schedule: { on: { hour, minute }, allowWhileIdle: true },
        smallIcon: 'ic_launcher_foreground',
      },
    ],
  });
  return 'scheduled';
}
