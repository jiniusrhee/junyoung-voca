// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { db } from '../db';
import { hintPrefix } from '../lib/text';
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

    await screen.findByText('0/20', {}, { timeout: 15_000 });
    expect(screen.getByText('레벨 10')).toBeTruthy();
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByRole('button', { name: /힌트 보기/ })).toBeTruthy();

    const { word, sentence } = await current();
    await type(sentence.answer);

    // 정답을 다 입력하면 확인 없이 채점되고 정답 후 패널이 나온다
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 15_000 });
    expect(screen.getByText(/뒤 복습$/)).toBeTruthy();
    const card = await db.cards.get(word.id);
    expect(card?.known).toBe(true);
    expect(await db.reviews.count()).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /다음 문제/ }));
    });
    await screen.findByText('1/20', {}, { timeout: 15_000 });
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
    // 말해보카 실측: 입력이 비워지고 정답 전체가 칸에 비친다 (힌트 글자는 초록, 나머지는 주황). 처음부터 다시 쳐야 한다
    const pre = hintPrefix(sentence.answer);
    expect(document.querySelector('.ghost.pre')?.textContent).toBe(pre);
    expect(document.querySelector('.ghost:not(.pre)')?.textContent).toBe(sentence.answer.slice(pre.length));

    await type(sentence.answer);
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 15_000 });
    const card = await db.cards.get(word.id);
    expect(card?.known).toBeFalsy();
    expect(card!.due.getTime()).toBeLessThanOrEqual(Date.now() + 6 * 60_000);
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
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 15_000 });

    const card = await db.cards.get(word.id);
    expect(card?.known).toBeFalsy();
    const review = (await db.reviews.where('wordId').equals(word.id).toArray()).pop();
    expect(review?.wrongs?.[0]?.w).toBe(wrong);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /오답 노트/ }));
    });
    // 오답 노트는 카드 아래에 겹쳐 뜨는 패널이고, 그 문장에 등록된 답들을 보여 준다 (말해보카 실측 2026-11-10)
    const listed = [...document.querySelectorAll('.note-panel .note-item b')].map((b) => b.textContent);
    if (wrong === 'zzzz') expect(document.querySelector('.note-panel')).toBeTruthy();
    else expect(listed).toContain(wrong);
  });

  it('listening (keyboard): each finished word moves to the card, a wrong confirm flashes, the last word ends with Perfect', async () => {
    const { saveSettings } = await import('../lib/settings');
    await saveSettings({ listeningMode: 'subjective', listeningInput: 'keyboard' });
    window.location.hash = '#/listening';
    render(<App />);
    await waitFor(() => expect(document.querySelector('.listen-quiz .lq-en')).toBeTruthy(), { timeout: 15_000 });
    const words = [...document.querySelectorAll('.listen-quiz .lq-en .lq-w')].map((e) => (e.textContent ?? '').toLowerCase().replace(/[^a-z]/g, ''));
    expect(words.length).toBeGreaterThan(1);
    // 아직 아무것도 못 채웠다
    expect(document.querySelectorAll('.listen-quiz .lq-w.lq-b').length).toBe(words.length);

    // 틀린 글자를 치고 확인: 카드가 붉어지고 낱말은 채워지지 않는다
    await type('zq');
    await press('Enter');
    expect(document.querySelector('.listen-quiz .lq-card.is-wrong')).toBeTruthy();
    expect(document.querySelectorAll('.listen-quiz .lq-w.lq-b').length).toBe(words.length);
    await press('Backspace', 2);

    // 첫 낱말을 다 치는 순간 카드로 올라가고 입력 칸이 비워진다
    await type(words[0]);
    await waitFor(() => expect(document.querySelectorAll('.listen-quiz .lq-w.lq-g').length).toBe(1), { timeout: 5_000 });
    expect(document.querySelector('.listen-quiz .lq-box span')?.textContent).toBe('');

    for (const w of words.slice(1)) await type(w);
    await waitFor(() => expect(document.querySelector('.lq-banner.perfect')).toBeTruthy(), { timeout: 15_000 });
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 15_000 });
    // 정답 뒤에는 뜻이 보이고 진행 수가 오른다
    expect(document.querySelector('.listen-quiz .lq-ko')).toBeTruthy();
    await screen.findByText(/^1\/\d+$/, {}, { timeout: 15_000 });
    const day = await db.daily.toArray();
    expect(day.some((d) => (d.byMode?.listening?.total ?? 0) === 1)).toBe(true);
  });

  it('expression: length → typed words turn into boxes, an unregistered wrong answer does nothing, the answer without apostrophes is accepted', async () => {
    // 가짜 fetch 는 단어 팩만 내주므로 표현 문장은 직접 심는다 (아포스트로피가 든 정답)
    await db.ecourses.put({ id: 't-course', title: '테스트 코스', group: '테스트', stars: 1, order: 0, pack: 't' });
    await db.epatterns.put({ key: 't-course:thats', id: 'thats', course: 't-course', ko: '그거 ~네', en: "That's ~", meaning: '', note: '', order: 0 });
    await db.eitems.put({
      id: 't-course-thats-01',
      course: 't-course',
      pkey: 't-course:thats',
      partner: { en: 'I got into Yale!', ko: '나 예일대 붙었어!' },
      en: 'Wow, ___!',
      answer: "that's great news",
      ko: '와, **정말 좋은 소식이네**!',
      order: 0,
    });
    const { saveSettings } = await import('../lib/settings');
    await saveSettings({ exprCourse: 't-course' });
    window.location.hash = '#/expr/quiz';
    render(<App />);
    await waitFor(() => expect(document.querySelector('.expr-quiz .eq-bottom .blank-size')).toBeTruthy(), { timeout: 15_000 });
    // 길이 보기 전: 빈칸은 한 덩어리
    expect(document.querySelectorAll('.expr-quiz .eq-bottom .blank').length).toBe(1);
    const answer = document.querySelector('.expr-quiz .eq-bottom .blank-size')?.textContent ?? '';
    const words = answer.split(' ');
    expect(words.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /길이 보기/ }));
    });
    expect(document.querySelectorAll('.expr-quiz .eq-bottom .blank').length).toBe(words.length);
    expect(screen.getByRole('button', { name: /힌트 보기/ })).toBeTruthy();

    // 등록되지 않은 오답 + 확인: 눈에 보이는 반응이 없다
    await type('zq');
    await press('Enter');
    expect(document.querySelector('.expr-quiz .eq-card.is-wrong')).toBeNull();
    expect(document.querySelector('.expr-quiz .pill')).toBeNull();
    await press('Backspace', 2);

    // 아포스트로피 없이 소문자로 쳐도 맞는다
    await type(answer.toLowerCase().replace(/[^a-z ]/g, ''));
    await screen.findByRole('button', { name: /다음 문제/ }, { timeout: 15_000 });
    expect([...document.querySelectorAll('.expr-quiz .eq-bottom .blank.filled')].map((e) => e.textContent).join(' ')).toBe(answer);
    // 힌트를 쓰지 않았으므로 진행 수가 오른다
    await waitFor(async () => expect((await db.daily.toArray()).some((d) => d.byMode?.expr?.solved === 1)).toBe(true), { timeout: 15_000 });
  });
});
