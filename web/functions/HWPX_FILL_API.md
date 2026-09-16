# 한글 양식 채우기 API (HWPX)

양식 한글 파일(.hwpx)의 **서식을 그대로 둔 채** 내용만 채워 넣는다.

경로는 셋이고, 호출하는 쪽이 이미 LLM(Claude 등)이면 **inspect → apply** 를 쓴다.
안에서 Gemini 를 한 번 더 부를 이유가 없고, 무엇을 어디에 넣을지 직접 정할 수 있다.

| 메서드 | 경로 | 용도 |
|--------|------|------|
| `POST` | `/api/hwpx/inspect` | 양식 구조(단락·표·안내문)를 JSON 으로 본다 |
| `POST` | `/api/hwpx/expand-rows` | 표 행이 모자랄 때 복제해 늘린다 |
| `POST` | `/api/hwpx/apply` | 내가 만든 단락 배열을 그대로 적용해 HWPX 를 받는다 |
| `POST` | `/api/hwpx/fill` | 양식 + 마크다운만 주면 Gemini 가 알아서 채운다 |

기본 주소는 `https://docs.prototypebench.org` 이고 인증은 게시 API 와 같은 키를 쓴다
(`x-api-key` 또는 `Authorization: Bearer`).

---

## 왜 두 단계인가

HWPX 채우기는 **양식의 단락을 그대로 두고 텍스트만 제자리에서 바꾸는** 방식이다.
서식·표 구조·페이지 설정은 양식 것이 100% 유지되고, 정하는 것은 각 단락의 문자열뿐이다.

그래서 지켜야 할 계약이 셋 있다. `inspect` 응답의 `contract` 에도 같은 내용이 실려 온다.

1. **단락 개수가 정확히 같아야 한다.** 많아도 적어도 `apply` 가 거부한다.
2. **빈 단락은 빈 채로 둔다.** 표를 감싸는 컨테이너와 빈 줄이 여기 해당하고, 글자를 넣으면 레이아웃이 깨진다.
3. **평문만 넣는다.** `**굵게**`, `##`, `|표|` 같은 표기는 글자 그대로 보인다. 굵기·크기는 양식의 서식이 결정한다.

## 1단계 — 양식 뜯어보기

```bash
curl -X POST "https://docs.prototypebench.org/api/hwpx/inspect" \
  -H "x-api-key: $BLOG_API_KEY" \
  -F "template=@사업계획서_양식.hwpx" | jq
```

```json
{
  "ok": true,
  "paragraphCount": 6,
  "contract": {
    "exactCount": "apply 의 paragraphs 배열은 정확히 6개여야 합니다. 많아도 적어도 거부됩니다.",
    "keepEmpty": "인덱스 [3] 는 구조용 빈 단락입니다. 빈 문자열로 두세요.",
    "plainText": "HWP 단락은 평문입니다. 마크다운(**, ##, -, |)이나 HTML 태그를 넣으면 글자 그대로 보입니다.",
    "noNewParagraphs": "단락을 늘리거나 줄일 수 없습니다. 표 행 추가도 불가능합니다."
  },
  "paragraphs": [
    { "index": 0, "text": "제목을 여기에", "kind": "text", "guide": false, "width": 48000 },
    { "index": 1, "text": "※ 이 칸에 사업 개요를 3줄로 작성하세요", "kind": "text", "guide": true,
      "width": 48000, "note": "양식 작성자가 쓴 안내문입니다. 안내가 요구하는 내용으로 바꾸세요." },
    { "index": 3, "text": "", "kind": "empty", "guide": false, "width": 48000,
      "note": "구조용 단락입니다. apply 할 때 반드시 빈 문자열(\"\")로 두세요." },
    { "index": 4, "text": "항목", "kind": "cell", "guide": false, "width": 12000,
      "table": 0, "row": 0, "col": 0 }
  ],
  "tables": [{ "index": 0, "rows": 1, "cols": 2, "paragraphs": [4, 5] }],
  "pageWidth": 48000
}
```

읽는 법:

- `kind` — `text`(일반) / `cell`(표 안) / `empty`(구조용, 반드시 빈 문자열)
- `guide` — 양식 작성자가 italic + 색으로 써 둔 안내문. 그 자리에 무엇을 써야 하는지 알려준다
- `width` — `pageWidth`(48000)면 표 밖 단락, 그보다 작으면 표 셀. 좁은 셀은 항목명, 넓은 셀은 값인 경우가 많다
- `table` / `row` / `col` — 몇 번째 표의 몇 행 몇 열인지. 표를 채울 때 이걸 보고 행 단위로 맞춘다

`text` 가 `제목을 여기에`, `본문 자리`, `○○○` 처럼 **채워 넣으라는 빈칸**인지,
`항목`, `작성일자:`, `1. 사업 개요` 처럼 **유지해야 할 항목명**인지는 호출자가 판단한다.

## 중간 단계 — 표 행이 모자랄 때

양식의 데이터 행은 보통 2~3개로 고정인데 채울 항목은 그보다 많다. 행을 먼저 늘린 뒤 채운다.

```bash
curl -X POST "https://docs.prototypebench.org/api/hwpx/expand-rows" \
  -H "x-api-key: $BLOG_API_KEY" \
  -F "template=@양식.hwpx" \
  -F 'expansions=[{"table":0,"row":2,"count":5}]' \
  -o 확장된_양식.hwpx
```

`table`/`row` 는 inspect 가 준 인덱스이고 `count` 는 **추가할** 행 수다. 지정한 행을 그 수만큼
복제해 바로 뒤에 넣는다. 복제본은 원본 행의 서식·셀 폭·테두리를 그대로 물려받는다.
`row` 를 생략하면 마지막 행을 복제한다. 머리글이 아니라 **데이터 행**을 지정해야 한다.

```
X-Hwpx-Paragraphs-Before: 12   ← 늘리기 전 단락 수
X-Hwpx-Paragraphs: 21          ← 늘린 뒤 단락 수
X-Hwpx-Table-Rows: 6           ← 표별 행 수
```

**행이 늘면 단락 인덱스가 전부 바뀐다.** 확장된 파일로 `inspect` 를 다시 호출해 새 구조를 받고,
그 개수에 맞춰 `apply` 한다. 즉 순서는 inspect → expand-rows → inspect → apply 가 된다.

복제 후 표 전체의 `cellAddr`/`rowAddr` 을 0부터 다시 매기고 `rowCnt` 를 갱신한다.
이 값이 어긋나면 한컴이 표를 깨진 것으로 보기 때문이다.

## 2단계 — 채워서 되돌려받기

`paragraphs` 는 JSON 문자열 배열이고, 길이는 `paragraphCount` 와 정확히 같아야 한다.

```bash
curl -X POST "https://docs.prototypebench.org/api/hwpx/apply" \
  -H "x-api-key: $BLOG_API_KEY" \
  -F "template=@사업계획서_양식.hwpx" \
  -F 'paragraphs=["2026년 사업계획","AI 문서 자동화를 3개년에 걸쳐 확대한다.","","","항목","12억 원"]' \
  -o 결과.hwpx
```

배열이 길면 파일로 보내도 된다: `-F "paragraphs=@paragraphs.json"`.

응답은 HWPX 바이너리이고, 헤더에 결과가 함께 실린다.

```
Content-Type: application/haansofthwpx
Content-Disposition: attachment; filename*=UTF-8''...
X-Hwpx-Paragraphs: 6          ← 양식의 단락 수
X-Hwpx-Changed: 3             ← 실제로 바뀐 단락 수
X-Hwpx-Protected-Empty: 3     ← 빈 단락에 글자를 넣어 되돌린 인덱스 (있을 때만)
```

개수가 어긋나면 고쳐서 다시 보낼 수 있게 기대값을 알려준다.

```json
{ "ok": false, "error": "단락 개수가 맞지 않습니다. 양식은 6개인데 5개를 보냈습니다.",
  "expected": 6, "received": 5 }
```

구조용 빈 단락에 글자가 들어오면 기본적으로 되돌린다. 의도한 것이라면
`-F "allowFillEmpty=true"` 로 끌 수 있다.

## 한 번에 맡기기 (선택)

호출자가 LLM 이 아니거나 그냥 맡기고 싶을 때 쓴다. 안에서 Gemini 가 양식을 읽고 채운다.

```bash
curl -X POST "https://docs.prototypebench.org/api/hwpx/fill" \
  -H "x-api-key: $BLOG_API_KEY" \
  -F "template=@양식.hwpx" \
  -F "markdown=@내용.md" \
  -o 결과.hwpx
```

`markdown` 은 텍스트 필드로도 되고, `filename` 으로 받을 이름을 지정할 수 있다.
판단 기준이 기대와 다르면 `shared/hwpxFill.mjs` 의 `FILL_SYSTEM_PROMPT` 를 양식에 맞게 조정한다.

## 제약

- **단락이 저절로 늘거나 줄지 않는다.** 양식에 단락이 10개면 `apply` 결과도 10개다. 본문 문단은
  늘릴 수 없으므로 항목이 많으면 한 단락 안에 이어 써야 한다.
  **표 행만은 `expand-rows` 로 늘릴 수 있다.**
- **이미지는 양식의 것이 그대로 남는다.** 새 이미지를 넣으려면 HWPX 의 BinData 항목과 참조 XML 을
  다뤄야 해서 별도 작업이다.
- 양식 파일 8MB, 마크다운 400KB, 단락 배열은 본문 크기 제한 안에서.

## 시간

`inspect` 와 `apply` 는 LLM 을 쓰지 않아 1초 안에 끝난다. `fill` 은 Gemini 호출이 한 번 있어
보통 3~10초다. Hosting 을 경유하는 위 주소는 60초에서 끊기므로, 단락이 아주 많은 양식이라면
함수 직접 URL(`https://us-central1-gdoc-fixer.cloudfunctions.net/hwpxFill`)을 쓴다.

## 배포

```bash
cd gdoc-fixer/web
npx firebase deploy --only functions:hwpxFill,functions:hwpxInspect,functions:hwpxApply,functions:hwpxExpandRows
npx firebase deploy --only hosting     # /api/hwpx/* rewrite
```

시크릿은 게시 API 와 같다 (`BLOG_AGENT_API_KEY`, `GEMINI_API_KEY`).
`inspect`/`apply` 는 Gemini 를 쓰지 않으므로 `BLOG_AGENT_API_KEY` 만 필요하다.
