import { Fragment } from 'react';

/**
 * 한글 문장 속 영어·숫자 구간을 `<span lang="en">` 으로 감싼다.
 * 말해보카(네이티브 글자 배치)는 한글 글자만 폭이 좁고 영어·숫자는 그대로라서, 전역 자간(styles.css 의 `*` 규칙)을
 * 영어·숫자에는 걸지 않아야 줄 길이와 줄바꿈 위치가 맞는다 (플립 실측 2026-11-11).
 */
const LATIN = /[A-Za-z0-9][A-Za-z0-9'’.,:;!?%&/+\-() ]*[A-Za-z0-9%)]|[A-Za-z0-9]/g;

export function koRuns(text: string): { text: string; en: boolean }[] {
  const out: { text: string; en: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(LATIN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), en: false });
    out.push({ text: m[0], en: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), en: false });
  return out;
}

export default function KoText({ text }: { text: string }) {
  const runs = koRuns(text);
  if (runs.length === 1 && !runs[0].en) return <>{text}</>;
  return (
    <>
      {runs.map((r, i) =>
        r.en ? (
          <span key={i} lang="en">
            {r.text}
          </span>
        ) : (
          <Fragment key={i}>{r.text}</Fragment>
        ),
      )}
    </>
  );
}
