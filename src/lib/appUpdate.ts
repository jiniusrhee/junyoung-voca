import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/**
 * 앱 자동 업데이트 (안드로이드 APK, 스토어 없이):
 * GitHub 릴리스 "latest" 의 설명에 적힌 versionCode 가 설치된 앱보다 크면 새 버전으로 보고,
 * 네이티브 플러그인(AppUpdaterPlugin.java)으로 APK 를 내려받아 설치 화면을 연다.
 * 릴리스는 `npm run release:apk` 가 올리며 설명을 "version=…\nversionCode=…" 로 쓴다.
 */
export const REPO = 'jiniusrhee/junyoung-voca';
export const APK_NAME = 'junyoung-voca.apk';
export const APP_VERSION_CODE: number = __APP_VERSION_CODE__;

interface AppUpdaterPlugin {
  canInstall(): Promise<{ ok: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(o: { url: string }): Promise<void>;
  addListener(event: 'progress', fn: (e: { percent: number; bytes: number }) => void): Promise<PluginListenerHandle>;
}
const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export interface UpdateInfo {
  version: string;
  versionCode: number;
  url: string;
  notes: string;
  publishedAt: string;
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** 버전 문자열 "0.3.1" → 코드 301 (android/app/build.gradle 과 같은 공식) */
export function versionCodeOf(version: string): number {
  const [a = 0, b = 0, c = 0] = version.split('.').map((x) => Number(x) || 0);
  return a * 10000 + b * 100 + c;
}

/** 릴리스 설명을 읽어 새 버전 정보를 돌려준다. 새 버전이 없으면 null */
export async function fetchLatest(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`릴리스 정보를 못 읽었어요 (HTTP ${res.status})`);
  const rel = (await res.json()) as { body?: string; published_at?: string; assets?: { name: string; browser_download_url: string; updated_at: string }[] };
  const body = rel.body ?? '';
  const code = Number(/versionCode\s*=\s*(\d+)/.exec(body)?.[1] ?? 0);
  const version = /version\s*=\s*([0-9.]+)/.exec(body)?.[1] ?? '';
  const asset = rel.assets?.find((a) => a.name === APK_NAME);
  if (!code || !asset) return null;
  const notes = body
    .split('\n')
    .filter((l) => !/^(version|versionCode)\s*=/.test(l.trim()))
    .join('\n')
    .trim();
  return { version, versionCode: code, url: asset.browser_download_url, notes, publishedAt: asset.updated_at ?? rel.published_at ?? '' };
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const info = await fetchLatest();
  return info && info.versionCode > APP_VERSION_CODE ? info : null;
}

export async function canInstall(): Promise<boolean> {
  if (!isNativeApp()) return false;
  return (await AppUpdater.canInstall()).ok;
}

export async function openInstallSettings(): Promise<void> {
  if (isNativeApp()) await AppUpdater.openInstallSettings();
}

/** APK 를 내려받고 설치 화면을 연다. onProgress 는 0~100 */
export async function downloadAndInstall(url: string, onProgress?: (percent: number) => void): Promise<void> {
  if (!isNativeApp()) {
    window.open(url, '_blank');
    return;
  }
  const h = await AppUpdater.addListener('progress', (e) => onProgress?.(e.percent));
  try {
    await AppUpdater.downloadAndInstall({ url });
  } finally {
    await h.remove();
  }
}
