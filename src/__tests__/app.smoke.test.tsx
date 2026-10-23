// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { db } from '../db';
import type { WordEntry } from '../types';

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

/** 화면에 표시된 한국어 문장으로 현재 출제 단어를 찾는다 */
async function findCurrentWord(): Promise<WordEntry> {
  const ko = document.querySelector('.sentence-ko')?.textContent ?? '';
  const words = await db.words.toArray();
  const found = words.find((w) => w.sentences.some((s) => s.ko.replace(/\*\*/g, '') === ko));
  if (!found) throw new Error(`현재 문제를 찾을 수 없음: ${ko}`);
  return found;
}

async function typeAndSubmit(input: HTMLInputElement, value: string) {
  await act(async () => {
    fireEvent.change(input, { target: { value } });
  });
  await act(async () => {
    fireEvent.keyDown(input, { key: 'Enter' });
  });
}

describe('app smoke', () => {
  it('runs welcome → level test → answer → feedback → next question', async () => {
    expect(packs.length).toBe(30);
    render(<App />);

    const start = await screen.findByRole('button', { name: '레벨 테스트 시작' }, { timeout: 10_000 });
    await waitFor(async () => expect(await db.words.count()).toBe(300), { timeout: 10_000 });
    await act(async () => {
      fireEvent.click(start);
    });

    const input = (await screen.findByPlaceholderText('영어로 입력', {}, { timeout: 5_000 })) as HTMLInputElement;
    expect(screen.getByText(/레벨 테스트 1 \/ 20/)).toBeTruthy();
    expect(screen.getByText(/^Lv\.\d+$/).textContent).toBe('Lv.10');

    const questionWord = await findCurrentWord();
    await typeAndSubmit(input, questionWord.sentences[0].answer);

    await screen.findByText(/정답!/, {}, { timeout: 5_000 });
    expect(screen.getByText('뉘앙스')).toBeTruthy();
    const card = await db.cards.get(questionWord.id);
    expect(card?.known).toBe(true);
    expect(await db.reviews.count()).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다음' }));
    });

    await screen.findByText(/레벨 테스트 2 \/ 20/, {}, { timeout: 5_000 });
    expect(screen.getByText(/^Lv\.\d+$/).textContent).toBe('Lv.13');
  });

  it('records a review after 정답 보기 and re-asks the word within the session', async () => {
    window.location.hash = '#/test';
    render(<App />);
    const input = (await screen.findByPlaceholderText('영어로 입력', {}, { timeout: 10_000 })) as HTMLInputElement;
    const questionWord = await findCurrentWord();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '정답 보기' }));
    });
    expect(screen.getByText(new RegExp(`정답은 '${questionWord.sentences[0].answer}'`))).toBeTruthy();

    await typeAndSubmit(input, questionWord.sentences[0].answer);
    await screen.findByText('정답을 확인했어요', {}, { timeout: 5_000 });

    const card = await db.cards.get(questionWord.id);
    expect(card?.known).toBeFalsy();
    expect(card?.due.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 60_000);
  });

  it('treats the base form as close and lets the user retry', async () => {
    window.location.hash = '#/test';
    render(<App />);
    const input = (await screen.findByPlaceholderText('영어로 입력', {}, { timeout: 10_000 })) as HTMLInputElement;
    const questionWord = await findCurrentWord();
    const answer = questionWord.sentences[0].answer;

    await typeAndSubmit(input, 'zzzz');
    expect(screen.getByText(/틀렸어요/)).toBeTruthy();
    expect(screen.queryByText(/정답!/)).toBeNull();

    await typeAndSubmit(input, answer);
    // 한 번 틀린 뒤 맞힘 → '맞혔지만 조금 헷갈렸어요'
    await screen.findByText('맞혔지만 조금 헷갈렸어요', {}, { timeout: 5_000 });
    const card = await db.cards.get(questionWord.id);
    expect(card?.known).toBeFalsy();
  });
});
