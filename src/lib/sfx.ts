import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';
import type { Settings } from '../types';

let haptics: typeof import('@capacitor/haptics').Haptics | null = null;
if (Capacitor.isNativePlatform()) void import('@capacitor/haptics').then((m) => (haptics = m.Haptics));

let ctx: AudioContext | null = null;
let cur: Pick<Settings, 'ttsVolume' | 'sfxVolume' | 'keySoundVolume' | 'keyVibrate' | 'streakVibrate' | 'muteStart' | 'voiceAccent' | 'voiceGender'> = {
  voiceAccent: 'us',
  voiceGender: 'random',
  ttsVolume: 1,
  sfxVolume: 1,
  keySoundVolume: 1,
  keyVibrate: true,
  streakVibrate: true,
  muteStart: false,
};
let muted = false;

/** 설정이 바뀔 때마다 App에서 호출 */
export function applySoundSettings(s: Settings): void {
  cur = s;
  if (s.muteStart && !sessionStorage.getItem('muteApplied')) {
    muted = true;
    sessionStorage.setItem('muteApplied', '1');
  }
}
export function isMuted(): boolean {
  return muted;
}
export function setMuted(v: boolean): void {
  muted = v;
}
/** 원어민 발음·성별 설정 (speech.ts 가 음성을 고를 때 씀) */
export function voicePref(): { accent: 'us' | 'uk'; gender: 'random' | 'male' | 'female' } {
  return { accent: cur.voiceAccent ?? 'us', gender: cur.voiceGender ?? 'random' };
}
export function ttsVolume(): number {
  return muted ? 0 : cur.ttsVolume;
}

function beep(freq: number, ms: number, gain: number): void {
  if (gain <= 0 || muted) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain * 0.15;
    o.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain * 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.start(t);
    o.stop(t + ms / 1000);
  } catch {
    /* 오디오 없음 */
  }
}

/** 자판 키를 누를 때: 짧은 딸깍 소리 + 진동 (말해보카 '키 입력 시 소리/진동') */
export function keyFeedback(): void {
  beep(1800, 35, cur.keySoundVolume);
  if (cur.keyVibrate) {
    if (haptics) void haptics.impact({ style: ImpactStyle.Light });
    else navigator.vibrate?.(8);
  }
}

/** 정답/오답 효과음 */
export function sfx(kind: 'correct' | 'wrong' | 'goal'): void {
  if (kind === 'correct') {
    beep(880, 90, cur.sfxVolume);
    window.setTimeout(() => beep(1320, 140, cur.sfxVolume), 90);
  } else if (kind === 'wrong') beep(220, 160, cur.sfxVolume);
  else {
    [660, 880, 1100, 1320].forEach((f, i) => window.setTimeout(() => beep(f, 120, cur.sfxVolume), i * 110));
    if (cur.streakVibrate) {
      if (haptics) void haptics.vibrate({ duration: 160 });
      else navigator.vibrate?.([60, 40, 60]);
    }
  }
}
