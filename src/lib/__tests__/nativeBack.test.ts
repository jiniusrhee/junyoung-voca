// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { handleBack, isRootRoute } from '../nativeBack';

describe('안드로이드 뒤로 가기', () => {
  it('홈 해시를 첫 화면으로 본다', () => {
    expect(isRootRoute('')).toBe(true);
    expect(isRootRoute('#/')).toBe(true);
    expect(isRootRoute('#/quiz')).toBe(false);
  });
  it('팝업이 떠 있으면 팝업을 닫고 화면은 옮기지 않는다', () => {
    const dim = document.createElement('div');
    dim.className = 'modal-dim';
    let closed = false;
    dim.addEventListener('click', () => { closed = true; });
    document.body.appendChild(dim);
    let moved = false;
    expect(handleBack(document, { back: () => { moved = true; }, minimize: () => { moved = true; } })).toBe('modal');
    expect(closed).toBe(true);
    expect(moved).toBe(false);
    dim.remove();
  });
  it('학습 화면을 덮은 설정은 왼쪽 위 뒤로 버튼으로 닫고, 그 위에 선택 시트가 있으면 시트부터 닫는다', () => {
    location.hash = '#/quiz';
    const overlay = document.createElement('div');
    overlay.className = 'vs-overlay';
    const backBtn = document.createElement('button');
    backBtn.className = 'vs-back';
    overlay.appendChild(backBtn);
    const sheet = document.createElement('div');
    sheet.className = 'sheet-dim';
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    const log: string[] = [];
    backBtn.addEventListener('click', () => { log.push('overlay'); });
    sheet.addEventListener('click', () => { log.push('sheet'); });
    const nav = { back: () => { log.push('back'); }, minimize: () => { log.push('min'); } };
    expect(handleBack(document, nav)).toBe('modal');
    sheet.remove();
    expect(handleBack(document, nav)).toBe('modal');
    overlay.remove();
    expect(log).toEqual(['sheet', 'overlay']);
  });
  it('첫 화면이 아니면 한 화면 뒤로, 첫 화면이면 앱을 뒤로 보낸다', () => {
    location.hash = '#/settings';
    const calls: string[] = [];
    const nav = { back: () => { calls.push('back'); }, minimize: () => { calls.push('min'); } };
    expect(handleBack(document, nav)).toBe('back');
    location.hash = '#/';
    expect(handleBack(document, nav)).toBe('minimize');
    expect(calls).toEqual(['back', 'min']);
  });
});
