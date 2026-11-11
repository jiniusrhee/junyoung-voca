import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncExternalStore } from 'react';

/**
 * 화면을 다시 열 때 한두 프레임 비어 보이지 않게 하는 조회 도우미.
 *
 * useLiveQuery 는 컴포넌트가 새로 뜰 때마다 첫 결과가 올 때까지 undefined 를 돌려준다. 그래서 하단 탭으로 홈에 돌아오면
 * 빈 화면 → 진행률 0 인 화면 → 제대로 된 화면 순으로 서너 프레임 깜박였다 (2026-11-11 플립 60fps 녹화. 말해보카는 한 프레임에 다 뜬다).
 */

interface Entry {
  value: unknown;
  listeners: Set<() => void>;
}
const kept = new Map<string, Entry>();

/**
 * 한 번 구독하면 앱이 켜져 있는 동안 계속 최신 값을 들고 있는 조회. 값이 작고 자주 쓰이는 것(설정, 하루 기록)에만 쓴다.
 * 처음 한 번만 undefined 이고, 그 뒤로는 어느 화면에서 불러도 곧바로 값이 나온다.
 */
export function useKeptQuery<T>(key: string, fn: () => Promise<T> | T): T | undefined {
  let e = kept.get(key);
  if (!e) {
    const made: Entry = { value: undefined, listeners: new Set() };
    kept.set(key, made);
    liveQuery(fn).subscribe({
      next: (v) => {
        made.value = v;
        made.listeners.forEach((l) => l());
      },
      error: () => undefined,
    });
    e = made;
  }
  const ent = e;
  return useSyncExternalStore(
    (cb) => {
      ent.listeners.add(cb);
      return () => ent.listeners.delete(cb);
    },
    () => ent.value as T | undefined,
  );
}

const last = new Map<string, unknown>();

/**
 * useLiveQuery 와 같지만 새 결과가 올 때까지 지난번 결과를 돌려준다. 계산이 무거워 계속 구독해 두기 아까운 조회에 쓴다.
 * key 에는 결과를 가르는 값(예: 모드)을 넣는다.
 */
export function useCachedQuery<T>(key: string, fn: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  return useLiveQuery(
    async () => {
      const r = await fn();
      last.set(key, r);
      return r;
    },
    deps,
    last.get(key) as T | undefined,
  );
}
