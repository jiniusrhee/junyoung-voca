# 단어 데이터 작성 가이드

단어 팩은 `public/data/words/level-XX.json` (XX = 01~30). 한 파일에 그 레벨의 단어들을 담는다.

```json
{
  "words": [
    {
      "id": "achieve",
      "word": "achieve",
      "pos": "v",
      "level": 6,
      "meanings": ["(노력하여) 이루다, 달성하다"],
      "sentences": [
        { "en": "She worked hard to ___ her goal.", "ko": "그녀는 목표를 **이루기** 위해 열심히 노력했다.", "answer": "achieve" },
        { "en": "The team ___ a record profit last year.", "ko": "그 팀은 지난해 기록적인 이익을 **달성했다**.", "answer": "achieved" }
      ],
      "nuance": "accomplish와 비슷하지만 achieve는 노력 끝에 목표에 '도달'하는 느낌이 강하다.",
      "etymology": "고대 프랑스어 achever '끝까지 가다' ← a(~로) + chef(머리, 끝)"
    }
  ]
}
```

## 규칙

- `id`: 소문자 단어. 같은 단어가 다른 품사로 또 들어가면 `word_pos` (예: `increase_n`). 전체 팩에서 유일해야 한다.
- `pos`: n, v, adj, adv, prep, conj, pron, det, num, interj, phr 중 하나.
- `level`: 1(가장 일상적)~30(가장 격식·희귀). 파일 이름의 레벨과 같게.
- `meanings`: 한국어 뜻 1~3개. 핵심 뜻을 앞에.
- `sentences`: 2개 권장. `en`에는 빈칸 `___`(밑줄 3개) 정확히 1개. `answer`는 빈칸에 들어갈 **그 문장에서의 형태**(achieved, carries 등). 문장 첫 단어에 빈칸을 두지 않는다(대문자 문제).
- `ko`: 자연스러운 한국어 번역. 빈칸 단어에 해당하는 부분을 `**굵게**` 한 쌍으로 표시.
- 두 문장 중 하나는 기본형, 하나는 변화형을 쓰면 복습 때 다른 문장이 번갈아 나와 좋다. 불규칙 변화(went, bought 등)는 어간이 달라 경고가 나오므로 되도록 피한다.
- `nuance`: 비슷한 말과의 차이, 자주 쓰는 구조(전치사, to부정사/-ing), 흔한 실수를 1~2문장으로. 큰따옴표 대신 작은따옴표 사용.
- `etymology`: 선택. 짧게. 레벨 1~3처럼 의미가 없으면 생략.

## 작업 순서 (새 세션에서 단어 추가할 때)

1. `npm run content:coverage [레벨]`로 아직 없는 흔한 단어를 확인한다. 사용자의 현재 레벨 ±2 범위부터 채운다.
2. 해당 `level-XX.json`의 `words` 배열에 항목을 추가한다 (한 번에 50~100개 정도씩).
3. `npm run content:validate` → 오류 0개 확인.
4. `npm run build`로 매니페스트 재생성과 빌드가 되는지 확인한다.
5. 커밋 메시지에 추가한 레벨과 개수를 적고 push. 배포되면 폰에서 앱을 열 때 자동으로 새 팩을 받는다.
