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
  haptic(o: { type?: number }): Promise<{ performed: boolean }>;
}
const SystemUi = registerPlugin<SystemUiPlugin>('SystemUi');

/**
 * 자판 키를 누를 때의 시스템 햅틱 (android HapticFeedbackConstants.KEYBOARD_TAP = 3).
 * 말해보카가 키마다 내는 것과 같은 종류(플립에서 SemHaptic 50025)다. 임의 길이 진동(Haptics.impact)은 느낌이 다르다.
 * 네이티브가 아니면 false 를 돌려준다.
 */
export function keyHaptic(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  void SystemUi.haptic({ type: 3 }).catch(() => undefined);
  return true;
}

const isDark = () => document.documentElement.dataset.theme === 'dark';

/** 마지막으로 칠한 상태바 (색, 밝은 글자 여부). 스플래시가 걷힐 때·앱으로 돌아올 때 다시 칠하려고 기억한다 */
let lastStatus: { color: string; lightText: boolean } | null = null;

/** 상태바를 칠한다. lightText: 막대 위 시계·아이콘을 밝게(어두운 배경용) */
export function setStatusBar(color: string, lightText: boolean): void {
  lastStatus = { color, lightText };
  if (!Capacitor.isNativePlatform()) return;
  void import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    void StatusBar.setBackgroundColor({ color }).catch(() => undefined);
    void StatusBar.setStyle({ style: lightText ? Style.Dark : Style.Light }).catch(() => undefined);
  });
}

const defaultStatus = () => setStatusBar(isDark() ? '#121212' : '#f4f5f9', isDark());

export function useStatusBarColor(color: string | null, lightIcons = false): void {
  useEffect(() => {
    if (color) setStatusBar(color, lightIcons);
    else defaultStatus();
    return defaultStatus;
  }, [color, lightIcons]);
}

/** 내비게이션 바 색을 한 번 바꾼다 (같은 색이면 건너뜀) */
let lastNav = '';
function sendNav(color: string): void {
  const c = color.replace('#', '');
  const lum = (parseInt(c.slice(0, 2), 16) * 299 + parseInt(c.slice(2, 4), 16) * 587 + parseInt(c.slice(4, 6), 16) * 114) / 1000;
  void SystemUi.setNavigationBarColor({ color, lightBackground: lum > 150 }).catch(() => undefined);
}
export function setNavBarColor(color: string): void {
  if (!Capacitor.isNativePlatform() || color === lastNav) return;
  lastNav = color;
  sendNav(color);
}

/**
 * 기억해 둔 막대 색을 다시 칠한다.
 * 안드로이드는 스플래시가 걷히는 순간 테마의 막대 색을 창에 다시 입혀서, 앱을 켠 직후 웹에서 칠한 색이 지워진다
 * (2026-11-11 플립: 켠 직후 상태바·내비게이션 바가 검정). 켠 뒤 몇 번, 그리고 앱으로 돌아올 때마다 부른다.
 */
export function reassertBars(): void {
  if (!Capacitor.isNativePlatform()) return;
  if (lastStatus) setStatusBar(lastStatus.color, lastStatus.lightText);
  if (lastNav) sendNav(lastNav);
}

/** 이 화면이 떠 있는 동안 내비게이션 바를 이 색으로 (null 이면 건드리지 않음) */
export function useNavBarColor(color: string | null): void {
  useEffect(() => {
    if (color) setNavBarColor(color);
  }, [color]);
}
