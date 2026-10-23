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
