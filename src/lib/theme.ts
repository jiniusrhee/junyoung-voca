import { useEffect } from 'react';
import type { Settings } from '../types';

/** 다크 모드 적용: <html data-theme="dark|light"> 와 상태 표시줄 색 */
export function useApplyTheme(theme: Settings['theme'] | undefined): void {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme !== 'light' && !!mq?.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101010' : '#f4f5f9');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [theme]);
}
