/**
 * 화면이 바뀔 때의 전환 (말해보카 60fps 녹화 실측 2026-11-11).
 *
 * - 하단 탭 세 화면과 ☰ 설정 메뉴 사이: 전환 없이 한 프레임에 바뀐다.
 * - '<' 가 달린 하위 화면(알림함, 즐겨찾기 설정, 좋아하는 문장, 오답노트, 학습한 어휘, 단어장 …):
 *     들어갈 때 머리줄은 바로 바뀌고, 내용이 오른쪽에서 밀려 들어온다(화면 폭의 절반쯤에서 시작해 약 0.2초, 끝이 느려짐).
 *     나올 때는 머리줄이 그대로 있는 채 내용이 오른쪽으로 0.12초 만에 빠져나가고(점점 빨라짐), 그 뒤에 머리줄과 하단 탭이 바뀐다.
 * - 연속 학습 화면: 뒤가 어두워지며 화면 절반 높이에서 위로 올라온다(0.2초, 3px 넘쳤다 돌아옴). 닫을 때는 0.12초 만에 아래로.
 *
 * React 는 화면을 곧바로 바꾸고, 바뀌기 직전 화면은 DOM 을 복사해 둔 '그림'으로 잠깐 깔아(또는 덮어) 움직인다.
 * 그래서 화면 컴포넌트는 전환을 몰라도 되고, 나가는 화면의 상태를 붙잡아 둘 필요도 없다.
 */
export type Transition = 'none' | 'push' | 'pop' | 'sheet-open' | 'sheet-close';
export type NavKind = 'PUSH' | 'POP' | 'REPLACE';

/** 전환 없이 바뀌는 뿌리 화면들 (하단 탭 + ☰ 설정 메뉴) */
const ROOTS = new Set(['/', '/stats', '/all', '/settings', '/welcome']);
/** 학습 화면: 들어가고 나올 때 전환을 따로 다룬다(지금은 바로 바뀜) */
const STUDY = [/^\/quiz$/, /^\/test$/, /^\/measure$/, /^\/grammar$/, /^\/listening$/, /^\/expr\/quiz$/, /^\/talk\/[^/]+\/[^/]+$/, /^\/pairs\/[^/]+\/[^/]+$/];
/** 아래에서 올라오는 화면 */
const SHEETS = new Set(['/streak']);

export const isStudy = (p: string) => STUDY.some((r) => r.test(p));

export function transitionFor(from: string, to: string, nav: NavKind): Transition {
  if (from === to || nav === 'REPLACE') return 'none';
  if (isStudy(from) || isStudy(to)) return 'none';
  if (SHEETS.has(to)) return 'sheet-open';
  if (SHEETS.has(from)) return 'sheet-close';
  const fromRoot = ROOTS.has(from);
  const toRoot = ROOTS.has(to);
  if (fromRoot && toRoot) return 'none';
  if (toRoot) return 'pop';
  if (fromRoot) return 'push';
  return nav === 'POP' ? 'pop' : 'push';
}

/** 전환 길이(ms) */
export const PUSH_MS = 200;
export const POP_MS = 120;
export const SHEET_OPEN_MS = 200;
export const SHEET_CLOSE_MS = 120;
/** 새 화면이 다 그려지기를 기다리는 가장 긴 시간(ms). 그동안은 이전 화면이 그대로 보인다 */
export const SETTLE_MAX_MS = 200;
