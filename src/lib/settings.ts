import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  level: null,
  dailyGoal: 20,
  inputMode: 'keyboard',
  blankMatchesLength: true,
  autoCheck: true,
  autoSpeak: true,
  speechRate: 'real',
  newWordDifficulty: 'normal',
  speechLevel: 'loose',
  reviewRatio: 'normal',
  ttsVolume: 1,
  sfxVolume: 1,
  keySoundVolume: 1,
  keyVibrate: true,
  streakVibrate: true,
  muteStart: false,
  theme: 'system',
  nickname: '준영',
  grammarGoal: 10,
  grammarLevel: null,
  listeningGoal: 10,
  listeningLevel: null,
  listeningMode: 'mc',
  listeningInput: 'voice',
  listeningSpeed: 'real',
  studyTheme: 'dino',
  voiceAccent: 'us',
  voiceGender: 'random',
  notifyStudy: false,
  notifyTime: '20:00',
  dndOn: false,
  dndFrom: '23:00',
  dndTo: '07:00',
  homeMode: 'vocab',
  exprGoal: 15,
  exprCourse: null,
  talkGoal: 10,
  talkLevel: 'B1',
  talkInput: 'keyboard',
};

async function read(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings> | undefined) ?? {}) };
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(read, []);
}

export const getSettings = read;

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const cur = await read();
  await db.kv.put({ key: 'settings', value: { ...cur, ...patch } });
}
