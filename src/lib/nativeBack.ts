import { Capacitor } from '@capacitor/core';

/**
 * 안드로이드 앱: 폰의 뒤로 가기 버튼.
 * Capacitor 는 App 플러그인이 없으면 뒤로 가기를 그대로 액티비티 종료로 넘겨 앱이 바로 꺼진다.
 * 팝업(.modal-dim)이 떠 있으면 팝업을 닫고, 화면이 쌓여 있으면 한 화면 뒤로,
 * 홈(첫 화면)에서는 앱을 뒤로 보낸다(종료하지 않음).
 */
export function isRootRoute(hash = location.hash): boolean {
  return hash === '' || hash === '#' || hash === '#/';
}

/** 뒤로 가기 한 번의 처리. 테스트를 위해 순수하게 분리 */
export function handleBack(doc: Document = document, nav = { back: () => history.back(), minimize: () => undefined as void }): 'modal' | 'back' | 'minimize' {
  const dim = doc.querySelector<HTMLElement>('.modal-dim');
  if (dim) {
    dim.click(); // 대부분의 팝업은 바깥을 누르면 닫힌다
    return 'modal';
  }
  if (isRootRoute()) {
    nav.minimize();
    return 'minimize';
  }
  nav.back();
  return 'back';
}

export async function installNativeBack(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  // 플러그인 프록시를 then 체인으로 돌려주지 않는다 (then 도 네이티브 메서드로 취급됨)
  await App.addListener('backButton', () => {
    handleBack(document, { back: () => history.back(), minimize: () => void App.minimizeApp() });
  });
}
