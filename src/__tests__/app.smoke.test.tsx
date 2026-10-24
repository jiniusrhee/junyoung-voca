// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { db } from '../db';
import type { WordEntry, WordSentence } from '../types';

// 배포되는 단어 팩을 그대로 읽어 가짜 fetch로 서빙한다
const packModules = import.meta.glob<{ default: { words: WordEntry[] } }>('../../public/data/words/*.json', { eager: true });
const packs = Object.entries(packModules).map(([path, mod]) => ({
  file: path.split('/').pop() ?? path,
  words: mod.default.words,
}));

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('data/manifest.json')) {
        const manifest = { totalWords: 0, packs: packs.map((p) => ({ file: p.file, hash: 'h', count: p.words.length, levels: [] })) };
        return new Response(JSON.stringify(manifest));
      }
      const m = url.match(/data\/words\/([^/]+)$/);
      const pack = m && packs.find((p) => p.file === m[1]);
      if (pack) return new Response(JSON.stringify({ words: pack.words }));
      return new Response('not found', { status: 404 });
    }),
  );
  window.location.hash = '#/';
});

afterEach(() => cleanup());

/** 화면에 표시된 한국어 문장으로 현재 출제 문장을 찾는다 */
async function current(): Promise<{ word: WordEntry; sentence: WordSentence }> {
  const ko = document.querySelector('.qcard .ko')?.textContent ?? '';
  for (const word of await db.words.toArray()) {
    for (const sentence of word.sentences) if (sentence.ko.replace(/\*\*/g, '') === ko) return { word, sentence };
  }
  throw new Error(`현재 문제를 찾을 수 없음: ${ko}`);
}

/** 앱 자체 자판 대신 실제 키보드 이벤트로 입력 */
async function type(text: string) {
  for (const ch of text) {
    await act(async () => {
      fireEvent.keyDown(window, { key: ch === ' ' ? ' ' : ch });
    });
  }
}
/** 입력 말풍선에 원하는 글자가 들어갈 때까지 (첫 키 입력이 렌더 전에 들어가는 경우 대비) */
async function typeExactly(text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await type(text);
    const shown = document.querySelector('.toolbar .bubble')?.textContent ?? '';
    if (shown === text) return;
    await press('Backspace', shown.length + 2);
  }
  throw new Error(`입력 실패: ${text}`);
}

async function press(key: string, times = 1) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      fireEvent.keyDown(window, { key });
    });
  }
}

describe('app smoke', () => {
  it('runs welcome → level test → auto-checked answer → after panel → next card', async () => {
    expect(packs.length).toBe(30);
    render(<App />);

    const start = await screen.findByRole('button', { name: '레벨 테스트 시작' }, { timeout: 10_000 });
    await waitFor(async () => expect(await db.words.count()).toBe(300), { timeout: 10_000 });
    await act(async () => {
      fireEvent.click(start);
    });

    await screen.findByText('0/20', {}, { timeout: 5_000 });
    expect(screen.getByText('레벨 10')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('button', { name: /힌트 보기/ })).toBeTruthy();

    const { word, sentence } = await current();
    await type(sentence.answer);

    // 정답을 다 입력하면 확인 없이 채점되고 정답 후 패널이 나온다
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 5_000 });
    expect(screen.getByText(/뒤 복습$/)).toBeTruthy();
    const card = await db.cards.get(word.id);
    expect(card?.known).toBe(true);
    expect(await db.reviews.count()).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /다음 문제/ }));
    });
    await screen.findByText('1/20', {}, { timeout: 5_000 });
    expect(screen.getByText('레벨 13')).toBeTruthy();
  });

  it('shows the answer on the second hint and records it as a miss', async () => {
    window.location.hash = '#/test';
    render(<App />);
    await screen.findByRole('button', { name: /힌트 보기/ }, { timeout: 10_000 });
    const { word, sentence } = await current();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /힌트 보기/ }));
    });
    expect(document.querySelector('.bubble')?.textContent?.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /정답 보기/ }));
    });
    // 말해보카처럼 정답이 칸에 비친다 (말풍선 없음)
    expect(document.querySelector('.ghost')?.textContent).toBe(sentence.answer);

    await type(sentence.answer);
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 5_000 });
    const card = await db.cards.get(word.id);
    expect(card?.known).toBeFalsy();
    expect(card!.due.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 60_000);
  });

  it('explains a wrong answer, then accepts the retry and keeps it in the wrong note', async () => {
    window.location.hash = '#/test';
    render(<App />);
    await screen.findByRole('button', { name: /힌트 보기/ }, { timeout: 10_000 });
    const { word, sentence } = await current();
    // 정답으로 시작하는 오답(예: see → seen)은 입력 도중 자동 채점되므로 제외
    const wrong =
      sentence.alts?.find((a) => a.t !== 'ok' && !a.w.toLowerCase().startsWith(sentence.answer.toLowerCase()))?.w ?? 'zzzz';

    await typeExactly(wrong);
    await press('Enter');
    if (wrong === 'zzzz') {
      // 등록되지 않은 오답: 말풍선 없이 카드만 붉게
      expect(document.querySelector('.qcard.is-wrong')).toBeTruthy();
      expect(document.querySelector('.qcard .pill')).toBeNull();
    } else {
      expect(document.querySelector('.qcard .pill')).toBeTruthy();
      expect(document.querySelector('.mark-bang')).toBeTruthy();
    }

    await press('Backspace', wrong.length);
    await type(sentence.answer);
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 5_000 });

    const card = await db.cards.get(word.id);
    expect(card?.known).toBeFalsy();
    const review = (await db.reviews.where('wordId').equals(word.id).toArray()).pop();
    expect(review?.wrongs?.[0]?.w).toBe(wrong);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /오답 노트/ }));
    });
    expect(document.querySelector('.card-overlay .wrong-w')?.textContent).toBe(wrong);
  });
});
