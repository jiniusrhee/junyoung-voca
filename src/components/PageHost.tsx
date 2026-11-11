import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { POP_MS, PUSH_MS, SETTLE_MAX_MS, SHEET_CLOSE_MS, SHEET_OPEN_MS, isStudy, transitionFor, type Transition } from '../lib/pageTransition';

interface Pending {
  kind: Transition;
  /** 바뀌기 직전 화면의 복사본 (화면 크기 상자 안에 스크롤 위치 그대로) */
  snap: HTMLElement;
  /** 바뀌기 직전 화면의 머리줄만 따로 (맨 위에 붙어 있었을 때) */
  head: HTMLElement | null;
}

// 들어올 때: 끝이 느려짐(2차). 나갈 때: 거의 일정하게, 처음만 조금 느리게 (녹화에서 읽은 위치: 진행률^1.3)
const EASE_OUT = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
const EASE_IN = 'cubic-bezier(0.3, 0.1, 0.8, 0.8)';

/** 화면 뿌리와 같은 클래스의 빈 껍데기 안에 머리줄만 복사해 맨 위에 고정한다 (머리줄 스타일이 화면 클래스에 걸려 있어도 그대로 보이게) */
function headShell(root: Element): HTMLElement | null {
  const header = root.querySelector(':scope > header');
  if (!header) return null;
  const r = header.getBoundingClientRect();
  if (r.top < -1 || r.top > 6 || r.height < 8) return null;
  const shell = root.cloneNode(false) as HTMLElement;
  shell.removeAttribute('id');
  shell.classList.add('pt-head');
  shell.style.height = `${r.bottom}px`;
  shell.appendChild(header.cloneNode(true));
  return shell;
}

function snapshot(host: HTMLElement): { snap: HTMLElement; head: HTMLElement | null } {
  const snap = document.createElement('div');
  snap.className = 'pt-snap';
  const inner = document.createElement('div');
  inner.className = 'pt-snap-inner';
  inner.style.marginTop = `${-window.scrollY}px`;
  let head: HTMLElement | null = null;
  for (const ch of Array.from(host.children)) {
    if (!head) head = headShell(ch);
    inner.appendChild(ch.cloneNode(true));
  }
  snap.appendChild(inner);
  return { snap, head };
}

/**
 * 새 화면이 다 그려질 때까지 기다린다: DOM 이 두 프레임 동안 바뀌지 않으면 됐다고 보고, 길어도 SETTLE_MAX_MS.
 * (실제 앱도 하위 화면을 누르면 머리줄만 먼저 바뀌고 0.1초쯤 이전 내용이 그대로 있다가 새 내용이 밀려 들어온다.
 *  덜 그려진 화면을 움직이면 중간에 내용이 튀어나오거나 움직임이 끊긴다.)
 */
function whenSettled(host: HTMLElement, cb: () => void): () => void {
  let quiet = 0;
  let raf = 0;
  let done = false;
  const mo = new MutationObserver(() => {
    quiet = 0;
  });
  mo.observe(host, { childList: true, subtree: true, characterData: true });
  const finish = () => {
    if (done) return;
    done = true;
    mo.disconnect();
    cancelAnimationFrame(raf);
    window.clearTimeout(cap);
    cb();
  };
  const cap = window.setTimeout(finish, SETTLE_MAX_MS);
  const tick = () => {
    if (host.firstElementChild) quiet += 1;
    if (quiet >= 2) finish();
    else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    done = true;
    mo.disconnect();
    cancelAnimationFrame(raf);
    window.clearTimeout(cap);
  };
}

/**
 * 화면(Routes)을 감싸 전환을 입힌다. 자세한 설명은 lib/pageTransition.ts.
 * 스크롤 위치도 여기서 다룬다: 새 화면은 맨 위에서 시작하고, 뒤로 돌아오면 떠나기 전 위치로.
 */
export default function PageHost({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const navType = useNavigationType();
  const host = useRef<HTMLDivElement>(null);
  const last = useRef({ key: loc.key, path: loc.pathname });
  const pending = useRef<Pending | null>(null);
  const scrolls = useRef(new Map<string, number>());

  // 그리는 중에(DOM 이 아직 이전 화면일 때) 이전 화면을 떠 둔다
  // 주소창에서 해시만 바꾼 이동은 키가 모두 'default' 라서 경로도 함께 본다
  if (last.current.key !== loc.key || last.current.path !== loc.pathname) {
    const kind = transitionFor(last.current.path, loc.pathname, navType);
    scrolls.current.set(last.current.key, window.scrollY);
    // 학습을 하다가 홈으로 돌아오면 홈이 고리·리본·오늘 막대를 다시 채워 보인다 (pages/Home.tsx)
    if (isStudy(last.current.path) && loc.pathname === '/') sessionStorage.setItem('homeReplay', '1');
    last.current = { key: loc.key, path: loc.pathname };
    pending.current = kind !== 'none' && host.current && host.current.children.length ? { kind, ...snapshot(host.current) } : null;
  }

  useLayoutEffect(() => {
    window.scrollTo(0, navType === 'POP' ? (scrolls.current.get(loc.key) ?? 0) : 0);
    const p = pending.current;
    pending.current = null;
    const el = host.current;
    const app = el?.parentElement;
    if (!p || !el || !app) return;
    const added: HTMLElement[] = [];
    const anims: Animation[] = [];
    let timer = 0;
    const put = (node: HTMLElement, cls: string) => {
      node.classList.add(cls);
      app.appendChild(node);
      added.push(node);
      return node;
    };
    const entering = p.kind === 'push' || p.kind === 'sheet-open';
    app.dataset.pt = p.kind;
    // 1) 먼저 이전 화면(복사본)을 그대로 덮어 둔다. 들어가는 전환이면 새 머리줄은 바로 보인다
    put(p.snap, 'pt-over');
    const first = el.firstElementChild;
    if (p.kind === 'push' && first) {
      const head = headShell(first);
      if (head) put(head, 'pt-top');
    } else if (p.kind === 'pop' && p.head) {
      put(p.head, 'pt-top');
    }
    const finish = () => {
      added.forEach((n) => n.remove());
      anims.forEach((a) => a.cancel());
      if (app.dataset.pt === p.kind) delete app.dataset.pt;
    };
    // 2) 새 화면이 다 그려지면 움직인다
    const stopWait = whenSettled(el, () => {
      const page = el.firstElementChild as HTMLElement | null;
      let ms = 0;
      if (entering) {
        // 이전 화면은 뒤로 깔고, 새 화면이 그 위로 들어온다
        p.snap.classList.remove('pt-over');
        p.snap.classList.add('pt-under');
        if (p.kind === 'push') {
          ms = PUSH_MS;
          if (page) anims.push(page.animate([{ transform: 'translateX(54%)' }, { transform: 'translateX(0)' }], { duration: ms, easing: EASE_OUT }));
        } else {
          ms = SHEET_OPEN_MS;
          p.snap.classList.add('pt-dim');
          if (page) anims.push(page.animate([{ transform: 'translateY(50vh)' }, { transform: 'translateY(-3px)', offset: 0.85 }, { transform: 'translateY(0)' }], { duration: ms, easing: 'linear' }));
        }
      } else if (p.kind === 'pop') {
        ms = POP_MS;
        anims.push(p.snap.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: ms, easing: EASE_IN, fill: 'forwards' }));
      } else {
        ms = SHEET_CLOSE_MS;
        anims.push(p.snap.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: ms, easing: EASE_IN, fill: 'forwards' }));
      }
      timer = window.setTimeout(finish, ms + 10);
    });
    return () => {
      stopWait();
      window.clearTimeout(timer);
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.key, loc.pathname]);

  return (
    <div className="page-host" ref={host}>
      {children}
    </div>
  );
}
