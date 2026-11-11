import { Capacitor } from '@capacitor/core';

/**
 * 안드로이드 앱: 폰의 뒤로 가기 버튼.
 * Capacitor 는 App 플러그인이 없으면 뒤로 가기를 그대로 액티비티 종료로 넘겨 앱이 바로 꺼진다.
 * 팝업(.modal-dim)·선택 시트(.sheet-dim)가 떠 있으면 그것을 닫고, 화면을 덮은 설정(.vs-overlay)이 있으면 그것을 닫고,
 * 화면이 쌓여 있으면 한 화면 뒤로,
 * 홈(첫 화면)에서는 앱을 뒤로 보낸다(종료하지 않음).
 */
export function isRootRoute(hash = location.hash): boolean {
  return hash === '' || hash === '#' || hash === '#/';
}

/** 뒤로 가기 한 번의 처리. 테스트를 위해 순수하게 분리 */
export function handleBack(doc: Document = document, nav = { back: () => history.back(), minimize: () => undefined as void }): 'modal' | 'back' | 'minimize' {
  // 가장 위에 떠 있는 것부터: 선택 시트·팝업(바깥을 누르면 닫힌다) → 화면을 덮은 설정(왼쪽 위 '<' 로 닫는다)
  const dims = doc.querySelectorAll<HTMLElement>('.sheet-dim, .modal-dim');
  const dim = dims[dims.length - 1]; // 문서에서 가장 뒤에 있는 것이 가장 위에 뜬 것
  if (dim) {
    dim.click();
    return 'modal';
  }
  const overlayBack = doc.querySelector<HTMLElement>('.vs-overlay .vs-back');
  if (overlayBack) {
    overlayBack.click();
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
