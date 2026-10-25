import { Capacitor } from '@capacitor/core';

/** 안드로이드 앱(WebView)에는 Web Speech 인식이 없어서, 네이티브 음성 인식 플러그인을 쓴다 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

let plugin: typeof import('@capacitor-community/speech-recognition').SpeechRecognition | null = null;
async function load() {
  if (!plugin) plugin = (await import('@capacitor-community/speech-recognition')).SpeechRecognition;
  return plugin;
}

export async function nativeCanRecognize(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const p = await load();
    return (await p.available()).available;
  } catch {
    return false;
  }
}

/** 한 번 듣고 후보 문장들을 돌려준다. 권한이 없으면 'not-allowed', 못 들으면 'no-speech' 오류 */
export async function nativeRecognizeOnce(lang = 'en-US', timeoutMs = 7000): Promise<string[]> {
  const p = await load();
  const perm = await p.checkPermissions();
  if (perm.speechRecognition !== 'granted') {
    const r = await p.requestPermissions();
    if (r.speechRecognition !== 'granted') throw new Error('not-allowed');
  }
  const timer = new Promise<string[]>((_, reject) =>
    window.setTimeout(() => {
      void p.stop().catch(() => undefined);
      reject(new Error('no-speech'));
    }, timeoutMs),
  );
  const run = p.start({ language: lang, maxResults: 5, partialResults: false, popup: false }).then((r) => {
    const m = r.matches ?? [];
    if (!m.length) throw new Error('no-speech');
    return m;
  });
  return Promise.race([run, timer]);
}
