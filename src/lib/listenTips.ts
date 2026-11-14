import type { ListenWord } from './listening';

/**
 * 리스닝 정답 뒤의 'TIP': 글자와 다르게 들리는 곳을 짚어 준다.
 * 말해보카는 문장마다 사람이 쓴 발음 설명을 달아 두었다. 그 글은 가져오지 않고, 흔한 소리 변화 몇 가지를 규칙으로 찾아 직접 쓴 설명을 붙인다.
 * (한 문장에 많아야 둘 — 실제 앱도 '1 / 2' 정도였다)
 */
export interface ListenTip {
  /** 짚는 낱말의 범위 (문장 안의 낱말 번호, 둘 다 포함) */
  from: number;
  to: number;
  /** 제목: hl 이 붙은 조각은 보라색 */
  title: { t: string; hl?: boolean }[];
  /** 본문 ('[이유] ' 뒤에 이어진다) */
  body: string;
}

const bare = (w: ListenWord) => w.key;

/** 모음 사이(또는 모음과 l·r 사이)의 t → 약한 ㄹ 소리. 흔한 낱말만 골라 둔다(규칙만으로는 hotel · return 같은 예외가 많다) */
const FLAP = new Set([
  'water', 'better', 'butter', 'letter', 'letters', 'later', 'matter', 'matters', 'bottle', 'bottles', 'little', 'city', 'cities', 'party', 'parties',
  'pretty', 'getting', 'sitting', 'putting', 'cutting', 'hitting', 'writing', 'waiting', 'meeting', 'meetings', 'eating', 'beautiful', 'computer', 'computers',
  'daughter', 'daughters', 'photo', 'photos', 'data', 'total', 'metal', 'battle', 'cattle', 'settle', 'settled', 'title', 'titles', 'subtitle', 'subtitles',
  'visitor', 'visitors', 'writer', 'writers', 'theater', 'forty', 'thirty', 'dirty', 'duty', 'beauty', 'quality', 'ability', 'reality', 'community', 'university',
  'security', 'activity', 'opportunity', 'responsibility', 'notice', 'noticed', 'native', 'hospital', 'capital', 'digital', 'critical', 'political', 'automatic',
  'item', 'items', 'atom', 'bitter', 'butterfly', 'battery', 'lottery', 'pattern', 'patterns', 'attitude', 'committee', 'excited', 'exciting', 'invited', 'united',
  'started', 'waited', 'wanted', 'needed', 'matter', 'whatever', 'water', 'greater', 'heater', 'sweater', 'meter', 'meters', 'liter', 'liters', 'editor',
]);

/** n 뒤의 t 가 묻히는 낱말 */
const NT = new Set(['twenty', 'plenty', 'center', 'winter', 'internet', 'interview', 'international', 'counter', 'dentist', 'printer', 'painter', 'wanted', 'advantage', 'percentage', 'identity', 'quantity', 'county', 'seventy', 'ninety', 'santa']);

/** 두 낱말이 한 덩어리로 줄어드는 말 */
const PAIRS: Record<string, { like: string; body: string }> = {
  'used to': { like: 'yoos-tuh', body: 'used 의 d 와 to 의 t 가 만나면 d 는 소리 나지 않고, to 는 힘을 빼고 짧게 말해서 한 낱말처럼 붙어요.' },
  'want to': { like: 'wanna', body: '빠르게 말할 때는 want 의 t 가 n 에 묻히고 to 가 약해져서, 두 낱말이 하나로 줄어든 것처럼 들릴 때가 많아요.' },
  'going to': { like: 'gonna', body: '앞으로 할 일을 말하는 going to 는 일상 대화에서 아주 짧게 줄여 말하는 일이 많아요. 글로 쓸 때는 줄이지 않아요.' },
  'have to': { like: 'haf-tuh', body: 'have 의 v 가 뒤의 t 를 만나 f 처럼 바뀌고, to 는 힘을 빼고 짧게 말해요.' },
  'has to': { like: 'has-tuh', body: 'has 의 s 가 z 가 아니라 s 로 소리 나고, to 는 힘을 빼고 짧게 붙여 말해요.' },
  'got to': { like: 'gotta', body: 'got 의 t 와 to 의 t 가 하나로 합쳐지고 뒤의 모음이 약해져서 짧게 줄어들어요.' },
  'kind of': { like: 'kinda', body: 'of 는 힘을 빼고 말하는 낱말이라 v 소리가 거의 사라지고 앞 낱말에 붙어요.' },
  'sort of': { like: 'sorta', body: 'of 는 힘을 빼고 말하는 낱말이라 v 소리가 거의 사라지고 앞 낱말에 붙어요.' },
  'out of': { like: 'outta', body: 'out 의 t 가 약한 ㄹ 소리로 바뀌고 of 의 v 가 거의 사라져서 한 낱말처럼 들려요.' },
  'lot of': { like: 'lotta', body: 'lot 의 t 가 약한 ㄹ 소리로 바뀌고 of 의 v 가 거의 사라져서 한 낱말처럼 들려요.' },
  'should have': { like: 'should-uv', body: '조동사 뒤의 have 는 h 가 빠지고 힘없이 짧게 줄어들어 앞 낱말에 붙어요.' },
  'could have': { like: 'could-uv', body: '조동사 뒤의 have 는 h 가 빠지고 힘없이 짧게 줄어들어 앞 낱말에 붙어요.' },
  'would have': { like: 'would-uv', body: '조동사 뒤의 have 는 h 가 빠지고 힘없이 짧게 줄어들어 앞 낱말에 붙어요.' },
  'must have': { like: 'must-uv', body: '조동사 뒤의 have 는 h 가 빠지고 힘없이 짧게 줄어들어 앞 낱말에 붙어요.' },
  'might have': { like: 'might-uv', body: '조동사 뒤의 have 는 h 가 빠지고 힘없이 짧게 줄어들어 앞 낱말에 붙어요.' },
  'give me': { like: 'gimme', body: '빠르게 말할 때 give 의 v 가 뒤의 m 에 묻혀서 두 낱말이 하나처럼 붙어요.' },
  'let me': { like: 'lemme', body: '빠르게 말할 때 let 의 t 가 뒤의 m 에 묻혀서 두 낱말이 하나처럼 붙어요.' },
  'tell him': { like: 'tell-im', body: 'him · her 처럼 힘없이 말하는 낱말은 h 가 빠지고 앞 낱말의 끝소리에 이어져요.' },
  'tell her': { like: 'tell-er', body: 'him · her 처럼 힘없이 말하는 낱말은 h 가 빠지고 앞 낱말의 끝소리에 이어져요.' },
};

/** 뒤에 모음으로 시작하는 짧은 말이 오면 끝 자음이 넘어가 붙는다 */
const LINK_NEXT = new Set(['it', 'up', 'out', 'off', 'on', 'in', 'a', 'an', 'of', 'at', 'us', 'all', 'about', 'away', 'over', 'apart', 'around', 'ahead']);
const endsWithConsonantSound = (w: string) => /[bcdfgklmnprstvxz]e?$/.test(w) && !/(le|re|ue|ee|ie|oe|ye)$/.test(w) && !/[aiou]$/.test(w);

export function listenTips(words: ListenWord[]): ListenTip[] {
  const tips: ListenTip[] = [];
  const used = new Set<number>();
  const free = (a: number, b: number) => {
    for (let i = a; i <= b; i++) if (used.has(i)) return false;
    return true;
  };
  const add = (t: ListenTip) => {
    if (!free(t.from, t.to)) return;
    for (let i = t.from; i <= t.to; i++) used.add(i);
    tips.push(t);
  };
  const q = (s: string) => `'${s}'`;

  // 1. 한 덩어리로 줄어드는 두 낱말
  for (let i = 0; i + 1 < words.length; i++) {
    const pair = `${bare(words[i])} ${bare(words[i + 1])}`;
    const hit = PAIRS[pair];
    if (hit) add({ from: i, to: i + 1, title: [{ t: `${q(pair)} 는 ` }, { t: q(hit.like), hl: true }, { t: ' 처럼 들려요.' }], body: hit.body });
  }
  // 2. t·d + you → ㅊ·ㅈ
  for (let i = 0; i + 1 < words.length; i++) {
    const a = bare(words[i]);
    const b = bare(words[i + 1]);
    if (b !== 'you' && b !== 'your') continue;
    if (/d$/.test(a) && a.length > 1)
      add({ from: i, to: i + 1, title: [{ t: `${q(`${a} ${b}`)} 에서는 ` }, { t: "'ㅈ'", hl: true }, { t: ' 소리가 나요.' }], body: `d 로 끝나는 말 뒤에 y 소리가 오면 둘이 합쳐져서 우리말 'ㅈ' 에 가까운 소리로 바뀌어요.` });
    else if (/[^s]t$/.test(a) && a.length > 2 && !/n't$/.test(a))
      add({ from: i, to: i + 1, title: [{ t: `${q(`${a} ${b}`)} 에서는 ` }, { t: "'ㅊ'", hl: true }, { t: ' 소리가 나요.' }], body: `t 로 끝나는 말 뒤에 y 소리가 오면 둘이 합쳐져서 우리말 'ㅊ' 에 가까운 소리로 바뀌어요.` });
  }
  // 3. 낱말 안의 소리 변화
  words.forEach((w, i) => {
    const b = bare(w);
    if (FLAP.has(b)) add({ from: i, to: i, title: [{ t: `${q(b)} 의 t 는 ` }, { t: "'ㄹ'", hl: true }, { t: ' 에 가깝게 들려요.' }], body: '미국식 발음에서는 모음 사이(또는 모음과 l 사이)의 t 를 혀끝으로 가볍게 치고 지나가서, 우리말 ㄹ 과 비슷한 소리가 나요.' });
    else if (NT.has(b)) add({ from: i, to: i, title: [{ t: `${q(b)} 의 ` }, { t: 't', hl: true }, { t: ' 는 거의 들리지 않아요.' }], body: 'n 바로 뒤의 t 는 미국식 발음에서 자주 n 소리에 묻혀요. 그래서 t 가 빠진 것처럼 들릴 수 있어요.' });
    else if (b === "can't") add({ from: i, to: i, title: [{ t: `${q(b)} 의 ` }, { t: 't', hl: true }, { t: ' 는 잘 들리지 않아요.' }], body: "can 은 힘을 빼고 짧게, can't 는 모음을 또렷하고 길게 말한 뒤 끊어요. t 소리보다 모음의 길이와 세기로 구분해 보세요." });
    else if (/^(i|you|he|she|we|they|it|that|there|who)'ll$/.test(b)) add({ from: i, to: i, title: [{ t: `${q(w.show.replace(/[.,!?]+$/, ''))} 의 ` }, { t: "'ll", hl: true }, { t: ' 은 아주 짧게 지나가요.' }], body: "will 을 줄인 'll 은 힘없이 '을' 정도로만 소리 나서 놓치기 쉬워요. 앞 낱말 끝이 살짝 길어지는 느낌으로 들어 보세요." });
    else if (/^(i|you|he|she|we|they|it|that|there|who)'d$/.test(b)) add({ from: i, to: i, title: [{ t: `${q(w.show.replace(/[.,!?]+$/, ''))} 의 ` }, { t: "'d", hl: true }, { t: ' 는 아주 짧게 지나가요.' }], body: "would · had 를 줄인 'd 는 뒤 낱말 앞에서 잠깐 막히는 정도로만 소리 나요. 뒤에 오는 동사의 모양으로 알아차릴 수 있어요." });
  });
  // 4. and 가 줄어드는 곳
  for (let i = 1; i + 1 < words.length; i++) {
    if (bare(words[i]) !== 'and') continue;
    add({ from: i - 1, to: i, title: [{ t: `${q(`${bare(words[i - 1])} and`)} 의 and 는 ` }, { t: "'n'", hl: true }, { t: ' 처럼 들려요.' }], body: '빠르게 말할 때 and 의 d 는 거의 소리 나지 않고 a 도 약해져서, 앞 낱말에 n 만 붙은 것처럼 들릴 때가 많아요.' });
    break;
  }
  // 5. 이어 말하기 (하나만)
  for (let i = 0; i + 1 < words.length && tips.length < 2; i++) {
    const a = bare(words[i]);
    const b = bare(words[i + 1]);
    if (!LINK_NEXT.has(b) || a.length < 3 || !endsWithConsonantSound(a)) continue;
    if (/[.,!?;:]$/.test(words[i].show)) continue;
    if (!free(i, i + 1)) continue;
    add({ from: i, to: i + 1, title: [{ t: `${q(`${a} ${b}`)} 는 ` }, { t: '한 낱말처럼', hl: true }, { t: ' 이어서 들려요.' }], body: '자음으로 끝나는 말 뒤에 모음으로 시작하는 말이 오면, 끝 자음이 뒤의 모음으로 넘어가 붙어서 소리 나요.' });
    break;
  }
  return tips.sort((x, y) => x.from - y.from).slice(0, 2);
}
