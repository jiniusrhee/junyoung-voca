// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { db } from '../db';
import { DEFAULT_SETTINGS } from '../lib/settings';

/**
 * 모든 주요 화면을 한 번씩 렌더해 본다.
 * 조기 return 뒤에 훅을 두는 식의 실수(React 가 "Rendered more hooks" 로 죽어 빈 화면)를 배포 전에 잡기 위한 테스트.
 * 배포되는 public/data 의 JSON 을 그대로 가짜 fetch 로 서빙한다.
 */
const dataModules = import.meta.glob<{ default: unknown }>('../../public/data/**/*.json', { eager: true });
const byPath = new Map<string, unknown>();
for (const [path, mod] of Object.entries(dataModules)) byPath.set(path.replace(/^.*\/public\/data\//, ''), mod.default);

const ROUTES = [
  '#/',
  '#/all',
  '#/all?mode=grammar',
  '#/stats',
  '#/streak',
  '#/measure',
  '#/quiz',
  '#/grammar',
  '#/listening',
  '#/expr',
  '#/expr/quiz',
  '#/expr/courses',
  '#/talk',
  '#/pairs',
  '#/pairs/b1/easy',
  '#/pairs/b1/hard',
  '#/learned/grammar',
  '#/learned/grammar/tdaily',
  '#/learned/grammar/daily',
  '#/learned/grammar/most',
  '#/words',
  '#/learned-words/daily',
  '#/favorites',
  '#/wrongs',
  '#/wordbook',
  '#/dict',
  '#/grammar-dict',
  '#/settings',
  '#/settings/vocab',
  '#/settings/mode/screen',
  '#/settings/mode/theme',
  '#/settings/mode/notice',
  '#/settings/mode/voice',
  '#/settings/mode/grammar',
  '#/settings/mode/listening',
  '#/settings/data',
];

const errors: string[] = [];
const origError = console.error;

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      const m = url.match(/data\/(.+?)(\?.*)?$/);
      const body = m && byPath.get(m[1]);
      if (body !== undefined && body !== null) return new Response(JSON.stringify(body));
      return new Response('not found', { status: 404 });
    }),
  );
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };
  // 레벨 테스트를 마친 상태로 시작 (온보딩으로 튕기지 않게)
  await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, level: 10 } });
  window.location.hash = '#/';
});

afterAll(() => {
  console.error = origError;
});
afterEach(() => cleanup());

describe('routes smoke', () => {
  it('renders every main screen without a React error', async () => {
    // 먼저 한 번 띄워 콘텐츠 동기화를 끝낸다 (단어 300 + 문법·발음 데이터)
    const first = render(<App />);
    await waitFor(async () => expect(await db.words.count()).toBe(300), { timeout: 15_000 });
    await waitFor(async () => expect(await db.gsentences.count()).toBeGreaterThan(0), { timeout: 15_000 });
    first.unmount();

    const failed: string[] = [];
    for (const route of ROUTES) {
      errors.length = 0;
      window.location.hash = route;
      // 라우트마다 새로 마운트: 한 화면이 죽어도 다음 화면 검사가 이어지게
      const view = render(<App />);
      try {
        await waitFor(() => expect(view.container.innerHTML.length).toBeGreaterThan(200), { timeout: 6_000 });
      } catch {
        failed.push(`${route}: 빈 화면`);
      }
      const bad = errors.filter((e) => /Rendered more hooks|Rendered fewer hooks|Minified React error|The above error occurred|Objects are not valid as a React child|Cannot read properties/.test(e));
      if (bad.length) failed.push(`${route}: ${bad[0].slice(0, 160)}`);
      await act(async () => {
        view.unmount();
      });
    }
    expect(failed).toEqual([]);
  }, 300_000);
});
