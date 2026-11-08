import { useEffect } from 'react';

/**
 * 안드로이드 앱 상태바 색. 학습 화면(어휘 퀴즈)은 말해보카처럼 하늘색 상태바 + 어두운 아이콘, 그 밖에는 앱 배경색.
 * 웹(PWA)에서는 아무것도 하지 않는다.
 */
export function useStatusBarColor(color: string | null, lightIcons = false): void {
  useEffect(() => {
    let cancelled = false;
    void import('@capacitor/core').then(async ({ Capacitor }) => {
      if (!Capacitor.isNativePlatform() || cancelled) return;
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      if (cancelled) return;
      const dark = document.documentElement.dataset.theme === 'dark';
      void StatusBar.setBackgroundColor({ color: color ?? (dark ? '#17181c' : '#f4f5f9') });
      void StatusBar.setStyle({ style: color ? (lightIcons ? Style.Dark : Style.Light) : dark ? Style.Dark : Style.Light });
    });
    return () => {
      cancelled = true;
      void import('@capacitor/core').then(async ({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) return;
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const dark = document.documentElement.dataset.theme === 'dark';
        void StatusBar.setBackgroundColor({ color: dark ? '#17181c' : '#f4f5f9' });
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      });
    };
  }, [color, lightIcons]);
}
