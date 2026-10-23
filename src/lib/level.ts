import { db } from '../db';
import { suggestLevelChange } from './levelLogic';
import { getSettings, saveSettings } from './settings';

const WINDOW = 20;

/** 새 단어 20개마다, 그중 '이미 알던' 비율을 보고 레벨을 한 칸 조정 */
export async function maybeAdjustLevel(): Promise<{ message: string | null; level: number }> {
  const s = await getSettings();
  const level = s.level ?? 10;
  const kv = await db.kv.get('levelAdjust');
  const last = (kv?.value as { count?: number } | undefined)?.count ?? 0;
  const total = await db.reviews.filter((r) => r.isNew && !r.isTest).count();
  if (total - last < WINDOW) return { message: null, level };

  const recent = await db.reviews
    .orderBy('ts')
    .reverse()
    .filter((r) => r.isNew && !r.isTest)
    .limit(WINDOW)
    .toArray();
  const rate = recent.filter((r) => r.firstTry && r.hints === 0).length / recent.length;
  const next = suggestLevelChange(level, rate);
  await db.kv.put({ key: 'levelAdjust', value: { count: total } });
  if (next === level) return { message: null, level };
  await saveSettings({ level: next });
  return {
    message:
      next > level
        ? `새 단어를 대부분 알고 있어 레벨을 ${next}로 올렸어요`
        : `새 단어가 어려워 레벨을 ${next}로 낮췄어요`,
    level: next,
  };
}
