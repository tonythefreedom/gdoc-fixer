/**
 * AI 에이전트용 진입점 — 인증 없이 읽을 수 있다.
 *
 *   GET /api/guide   사람이든 AI 든 한 번 읽으면 전체 사용법을 아는 마크다운
 *   GET /api/tools   OpenAI / Anthropic 도구 스키마 (그대로 등록해 쓰면 됨)
 *
 * 문서를 사람이 복사해 붙여넣는 대신, 에이전트가 URL 하나를 읽고 스스로 쓰게 하는 것이
 * 목적이다. 그래서 규칙(단락 개수 일치, 빈 단락 유지 등)을 응답 안에 같이 싣는다.
 */
const { onRequest } = require('firebase-functions/v2/https');

const BASE = 'https://docs.prototypebench.org';

// ─────────────────────────── 도구 스키마 ───────────────────────────

const TOOLS = [
  {
    name: 'hwpx_inspect',
    description:
      '한글 양식 파일(.hwpx)의 구조를 읽는다. 단락 목록(인덱스·현재 텍스트·안내문 여부)과 표 구조(행/열)를 돌려준다. 양식을 채우기 전에 반드시 먼저 호출해 단락 개수와 각 자리의 성격을 확인해야 한다.',
    input_schema: {
      type: 'object',
      properties: {
        template_url: {
          type: 'string',
          description: '양식 .hwpx 파일의 URL. 파일을 직접 올릴 때는 multipart 로 template 필드를 쓴다.',
        },
      },
      required: [],
    },
    endpoint: { method: 'POST', path: '/api/hwpx/inspect', content_type: 'multipart/form-data' },
  },
  {
    name: 'hwpx_expand_rows',
    description:
      '양식 표의 행이 모자랄 때 지정한 행을 복제해 늘린다. 복제본은 원본 행의 서식·셀 폭·테두리를 물려받는다. 행이 늘면 단락 인덱스가 전부 바뀌므로 이 호출 뒤에는 hwpx_inspect 를 다시 해야 한다.',
    input_schema: {
      type: 'object',
      properties: {
        expansions: {
          type: 'array',
          description: '늘릴 대상. table/row 는 inspect 가 준 인덱스, count 는 추가할 행 수.',
          items: {
            type: 'object',
            properties: {
              table: { type: 'integer', description: '표 인덱스 (0부터)' },
              row: { type: 'integer', description: '복제할 행 인덱스. 생략하면 마지막 행. 머리글이 아니라 데이터 행을 지정한다.' },
              count: { type: 'integer', description: '추가할 행 수' },
            },
            required: ['table', 'count'],
          },
        },
      },
      required: ['expansions'],
    },
    endpoint: { method: 'POST', path: '/api/hwpx/expand-rows', content_type: 'multipart/form-data' },
  },
  {
    name: 'hwpx_apply',
    description:
      '단락 배열을 양식에 그대로 적용해 채워진 .hwpx 를 받는다. 배열 길이는 inspect 의 paragraphCount 와 정확히 같아야 하며, 표 밖의 빈 단락은 빈 문자열로 둬야 한다. 평문만 넣는다 — 마크다운이나 HTML 은 글자 그대로 보인다.',
    input_schema: {
      type: 'object',
      properties: {
        paragraphs: {
          type: 'array',
          items: { type: 'string' },
          description: 'inspect 가 준 순서대로, 각 단락에 넣을 텍스트. 길이가 다르면 400 으로 거부된다.',
        },
      },
      required: ['paragraphs'],
    },
    endpoint: { method: 'POST', path: '/api/hwpx/apply', content_type: 'multipart/form-data' },
  },
  {
    name: 'hwpx_fill',
    description:
      '양식과 마크다운 원고만 주면 어디에 무엇을 넣을지 알아서 판단해 채운다. 호출하는 쪽이 이미 LLM 이라면 inspect + apply 로 직접 제어하는 편이 정확하고 빠르다.',
    input_schema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: '채워 넣을 내용 (마크다운)' },
        filename: { type: 'string', description: '받을 파일 이름 (선택)' },
      },
      required: ['markdown'],
    },
    endpoint: { method: 'POST', path: '/api/hwpx/fill', content_type: 'multipart/form-data' },
  },
];

// ─────────────────────────── 가이드 본문 ───────────────────────────

const GUIDE = `# 한글 양식 채우기 API

양식 한글 파일(.hwpx)의 **서식을 그대로 둔 채** 내용만 채운다.
양식의 단락을 건드리지 않고 텍스트만 제자리에서 바꾸므로, 표·글꼴·페이지 설정이 원본 그대로 유지된다.

기본 주소: \`${BASE}\`

## 인증

모든 요청에 API 키를 싣는다. 사용자는 ${BASE} 에 로그인해 프로필 페이지에서 발급한다.

\`\`\`
x-api-key: gdk_...
\`\`\`

\`Authorization: Bearer gdk_...\` 도 된다.

## 반드시 지켜야 하는 계약 3가지

1. **단락 개수가 정확히 같아야 한다.** apply 에 보내는 배열 길이는 inspect 의 \`paragraphCount\` 와 일치해야 하고, 다르면 400 으로 거부된다.
2. **표 밖의 빈 단락은 빈 문자열로 둔다.** 표를 감싸는 컨테이너와 빈 줄이며, 글자를 넣으면 레이아웃이 깨진다. 반대로 **표 안의 빈 칸은 채우라고 비워둔 자리**다. inspect 응답이 둘을 구분해 알려준다.
3. **평문만 넣는다.** \`**굵게**\`, \`##\`, \`|표|\` 같은 표기는 글자 그대로 보인다. 굵기·크기는 양식의 서식이 결정한다.

## 순서

\`\`\`
inspect  →  (행이 모자라면 expand-rows → inspect 다시)  →  apply
\`\`\`

### 1. 양식 뜯어보기

\`\`\`bash
curl -X POST "${BASE}/api/hwpx/inspect" \\
  -H "x-api-key: $KEY" \\
  -F "template=@양식.hwpx"
\`\`\`

응답에서 볼 것:

- \`paragraphCount\` — apply 에 보낼 배열 길이
- \`contract\` — 위 3가지 규칙이 이 양식에 맞춰 구체적인 인덱스와 함께 들어 있다
- \`paragraphs[].kind\` — \`text\`(일반) / \`cell\`(표 안) / \`empty\`(표 밖 빈 단락, 건드리지 말 것)
- \`paragraphs[].guide\` — true 면 양식 작성자가 쓴 안내문이다. 그 자리에 무엇을 써야 하는지 알려주므로 안내가 요구하는 내용으로 바꾼다
- \`paragraphs[].table/row/col\` — 표 안일 때 위치. 행 단위로 값을 맞출 때 쓴다
- \`tables[]\` — 표별 행·열 수

\`text\` 가 \`제목을 여기에\`, \`본문 자리\`, \`○○○\` 처럼 **채워 넣으라는 빈칸**인지, \`항목\`, \`작성일자:\`, \`1. 사업 개요\` 처럼 **유지해야 할 항목명**인지는 호출자가 판단한다.

### 2. 표 행이 모자랄 때

양식의 데이터 행은 보통 2~3개로 고정인데 채울 항목은 그보다 많다.

\`\`\`bash
curl -X POST "${BASE}/api/hwpx/expand-rows" \\
  -H "x-api-key: $KEY" \\
  -F "template=@양식.hwpx" \\
  -F 'expansions=[{"table":0,"row":2,"count":5}]' \\
  -o 확장된_양식.hwpx
\`\`\`

행이 늘면 **단락 인덱스가 전부 바뀐다.** 확장된 파일로 inspect 를 다시 호출해 새 구조를 받는다.

### 3. 채우기

\`\`\`bash
curl -X POST "${BASE}/api/hwpx/apply" \\
  -H "x-api-key: $KEY" \\
  -F "template=@양식.hwpx" \\
  -F "paragraphs=@paragraphs.json" \\
  -o 결과.hwpx
\`\`\`

\`paragraphs.json\` 은 문자열 배열이다. 짧으면 \`-F 'paragraphs=["...","..."]'\` 로 직접 써도 된다.

응답은 HWPX 바이너리이고 헤더에 결과가 실린다: \`X-Hwpx-Paragraphs\`(양식 단락 수), \`X-Hwpx-Changed\`(바뀐 수), \`X-Hwpx-Protected-Empty\`(빈 단락에 글자를 넣어 되돌린 인덱스).

개수가 어긋나면 이렇게 답한다. 고쳐서 다시 보내면 된다.

\`\`\`json
{ "ok": false, "error": "단락 개수가 맞지 않습니다. 양식은 42개인데 40개를 보냈습니다.",
  "expected": 42, "received": 40 }
\`\`\`

### 한 번에 맡기기

직접 판단하지 않고 맡기려면:

\`\`\`bash
curl -X POST "${BASE}/api/hwpx/fill" \\
  -H "x-api-key: $KEY" \\
  -F "template=@양식.hwpx" -F "markdown=@내용.md" \\
  -o 결과.hwpx
\`\`\`

호출하는 쪽이 이미 LLM 이라면 inspect + apply 가 더 정확하고 빠르다(안에서 LLM 을 한 번 더 부르지 않는다).

## 할 수 없는 것

- **본문 단락을 늘리거나 줄일 수 없다.** 양식에 단락이 10개면 결과도 10개다. 항목이 많으면 한 단락 안에 이어 쓴다. 표 행만 expand-rows 로 늘릴 수 있다.
- **이미지를 새로 넣을 수 없다.** 양식에 있던 이미지는 그대로 남는다.
- **서식을 바꿀 수 없다.** 굵기·글꼴·색은 양식이 정한 그대로다.

## 한도

| 항목 | 값 |
|------|-----|
| 양식 파일 | 8MB |
| 마크다운 | 400KB |
| inspect / expand-rows / apply | 1초 내 (LLM 미사용) |
| fill | 3~10초 (LLM 1회) |

## 도구 정의

\`GET ${BASE}/api/tools\` 를 부르면 OpenAI / Anthropic 형식의 도구 스키마를 그대로 받을 수 있다.
`;

// ─────────────────────────── 엔드포인트 ───────────────────────────

exports.agentGuide = onRequest(
  { timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (req, res) => {
    const wantsJson = /json/i.test(req.get('accept') || '') || req.query.format === 'json';
    res.set('Cache-Control', 'public, max-age=300');
    if (wantsJson) {
      res.status(200).json({ ok: true, base_url: BASE, guide: GUIDE, tools_url: `${BASE}/api/tools` });
      return;
    }
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.status(200).send(GUIDE);
  }
);

exports.agentTools = onRequest(
  { timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    const style = String(req.query.format || 'anthropic').toLowerCase();

    if (style === 'openai') {
      // OpenAI function calling 형식
      res.status(200).json({
        base_url: BASE,
        tools: TOOLS.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: `${t.description} [${t.endpoint.method} ${BASE}${t.endpoint.path}]`,
            parameters: t.input_schema,
          },
        })),
      });
      return;
    }

    // Anthropic tool use 형식 (기본)
    res.status(200).json({
      base_url: BASE,
      guide_url: `${BASE}/api/guide`,
      auth: { header: 'x-api-key', format: 'gdk_...' },
      tools: TOOLS,
    });
  }
);
