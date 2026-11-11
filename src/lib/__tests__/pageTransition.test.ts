import { describe, expect, it } from 'vitest';
import { transitionFor } from '../pageTransition';

describe('transitionFor (화면 전환 종류)', () => {
  it('하단 탭과 설정 메뉴 사이는 전환이 없다', () => {
    expect(transitionFor('/', '/stats', 'PUSH')).toBe('none');
    expect(transitionFor('/all', '/', 'PUSH')).toBe('none');
    expect(transitionFor('/', '/settings', 'PUSH')).toBe('none');
    expect(transitionFor('/settings', '/', 'POP')).toBe('none');
  });
  it('하위 화면은 밀려 들어오고, 돌아올 때는 빠져나간다', () => {
    expect(transitionFor('/all', '/favorites', 'PUSH')).toBe('push');
    expect(transitionFor('/favorites', '/all', 'POP')).toBe('pop');
    expect(transitionFor('/', '/inbox', 'PUSH')).toBe('push');
    // 머리줄의 뒤로 버튼이 주소를 직접 바꾸더라도 뿌리 화면으로 가면 빠져나가는 전환
    expect(transitionFor('/inbox', '/', 'PUSH')).toBe('pop');
    expect(transitionFor('/words', '/words/abc', 'PUSH')).toBe('push');
    expect(transitionFor('/words/abc', '/words', 'POP')).toBe('pop');
    expect(transitionFor('/settings', '/settings/vocab', 'PUSH')).toBe('push');
  });
  it('연속 학습 화면은 아래에서 올라오고 아래로 닫힌다', () => {
    expect(transitionFor('/', '/streak', 'PUSH')).toBe('sheet-open');
    expect(transitionFor('/streak', '/', 'POP')).toBe('sheet-close');
  });
  it('학습 화면을 드나들 때와 주소 바꿔치기는 전환이 없다', () => {
    expect(transitionFor('/', '/quiz', 'PUSH')).toBe('none');
    expect(transitionFor('/quiz', '/', 'POP')).toBe('none');
    expect(transitionFor('/talk', '/talk/cafe/1', 'PUSH')).toBe('none');
    expect(transitionFor('/a', '/b', 'REPLACE')).toBe('none');
    expect(transitionFor('/dict', '/dict', 'PUSH')).toBe('none');
  });
});
