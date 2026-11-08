import { useEffect, useRef, useState } from 'react';

/**
 * 정답마다 진행 막대 아래 하늘로 익룡 1~2마리가 오른쪽에서 왼쪽으로 날아간다 (말해보카, 정답 0.6초 뒤 시작, 둘째는 0.4초 뒤).
 * flights 값이 바뀔 때마다 한 번 날린다. 그림은 직접 그린 실루엣.
 */
export default function Pterodactyls({ flights }: { flights: number }) {
  const [birds, setBirds] = useState<{ id: number; delay: number; top: number; scale: number }[]>([]);
  const seq = useRef(0);
  useEffect(() => {
    if (!flights) return;
    const n = Math.random() < 0.45 ? 1 : 2;
    const add = Array.from({ length: n }, (_, k) => ({ id: ++seq.current, delay: 0.6 + k * 0.4, top: 12 + Math.random() * 40, scale: k === 0 ? 1 : 0.8 }));
    setBirds((b) => [...b, ...add]);
    const t = window.setTimeout(() => setBirds((b) => b.filter((x) => !add.some((a) => a.id === x.id))), 8500);
    return () => window.clearTimeout(t);
  }, [flights]);
  return (
    <div className="ptero-layer" aria-hidden="true">
      {birds.map((b) => (
        <svg key={b.id} className="ptero" style={{ top: `${b.top}%`, animationDelay: `${b.delay}s`, width: 30 * b.scale, height: 16 * b.scale }} viewBox="0 0 30 16">
          <g fill="#9a8bb0">
            <path className="wing" d="M15 9 Q9 1 1 2 Q6 5 10 9 Z" />
            <path className="wing" d="M15 9 Q21 1 29 3 Q24 5 20 9 Z" />
            <path d="M2 9.5 q4 -1.5 9 -1 l5 .5 q5 .5 9 2 q-5 1 -9 .5 l-5 -.5 q-5 -.5 -9 -1.5z" />
            <path d="M24 10.5 q3 -1 5 1 q-2 1 -5 0z" />
          </g>
        </svg>
      ))}
    </div>
  );
}
