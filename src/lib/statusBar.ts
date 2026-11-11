import { Capacitor, registerPlugin } from '@capacitor/core';
import { useEffect } from 'react';

/**
 * 안드로이드 앱의 시스템 막대 색.
 * - 상태바: 학습 화면(어휘 퀴즈)은 말해보카처럼 하늘색 + 어두운 아이콘, 그 밖에는 앱 배경색.
 * - 내비게이션 바(화면 맨 아래 제스처 막대 자리): 말해보카는 자판·하단 탭 배경이 화면 끝까지 이어져 보이므로 화면 아래쪽 배경색과 같게 맞춘다.
 * 웹(PWA)에서는 아무것도 하지 않는다.
 */
interface SystemUiPlugin {
  setNavigationBarColor(o: { color: string; lightBackground?: boolean }): Promise<void>;
}
const SystemUi = registerPlugin<SystemUiPlugin>('SystemUi');

const isDark = () => document.documentElement.dataset.theme === 'dark';

export function useStatusBarColor(color: string | null, lightIcons = false): void {
  useEffect(() => {
    let cancelled = false;
    void import('@capacitor/core').then(async ({ Capacitor: C }) => {
      if (!C.isNativePlatform() || cancelled) return;
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      if (cancelled) return;
      void StatusBar.setBackgroundColor({ color: color ?? (isDark() ? '#101010' : '#f4f5f9') });
      void StatusBar.setStyle({ style: color ? (lightIcons ? Style.Dark : Style.Light) : isDark() ? Style.Dark : Style.Light });
    });
    return () => {
      cancelled = true;
      void import('@capacitor/core').then(async ({ Capacitor: C }) => {
        if (!C.isNativePlatform()) return;
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        void StatusBar.setBackgroundColor({ color: isDark() ? '#101010' : '#f4f5f9' });
        void StatusBar.setStyle({ style: isDark() ? Style.Dark : Style.Light });
      });
    };
  }, [color, lightIcons]);
}

/** 내비게이션 바 색을 한 번 바꾼다 (같은 색이면 건너뜀) */
let lastNav = '';
export function setNavBarColor(color: string): void {
  if (!Capacitor.isNativePlatform() || color === lastNav) return;
  lastNav = color;
  const c = color.replace('#', '');
  const lum = (parseInt(c.slice(0, 2), 16) * 299 + parseInt(c.slice(2, 4), 16) * 587 + parseInt(c.slice(4, 6), 16) * 114) / 1000;
  void SystemUi.setNavigationBarColor({ color, lightBackground: lum > 150 }).catch(() => undefined);
}

/** 이 화면이 떠 있는 동안 내비게이션 바를 이 색으로 (null 이면 건드리지 않음) */
export function useNavBarColor(color: string | null): void {
  useEffect(() => {
    if (color) setNavBarColor(color);
  }, [color]);
}
