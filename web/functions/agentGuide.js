/**
 * AI 에이전트용 진입점 — 인증 없이 읽을 수 있다.
 *
 *   GET /api/guide   사람이든 AI 든 한 번 읽으면 전체 사용법을 아는 마크다운
 *   GET /api/tools   OpenAI / Anthropic 도구 스키마 (그대로 등록해 쓰면 됨)
 *   GET /ai          같은 내용을 사람이 보기 좋게 렌더한 HTML
 *
 * /ai 를 서버에서 렌더하는 이유: SPA 는 JS 를 실행해야 내용이 생기므로, AI 가 그 주소를
 * 가져가면 빈 껍데기만 받는다. 서버가 완성된 HTML 을 주면 사람도 AI 도 같은 것을 읽는다.
 * 본문은 위 GUIDE 하나에서 나오므로 두 경로가 어긋날 일이 없다.
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

## AI 별 연동 방법

어느 쪽이든 이 문서 주소(\`${BASE}/api/guide\`)와 API 키만 있으면 된다.

### Claude · Claude Code

대화에 그대로 알려주면 된다. 파일을 다루므로 Claude Code 가 가장 잘 맞는다.

\`\`\`bash
export GDOC_KEY=gdk_...
curl -s ${BASE}/api/guide      # 이 문서
curl -X POST "${BASE}/api/hwpx/inspect" -H "x-api-key: $GDOC_KEY" -F "template=@양식.hwpx"
\`\`\`

### ChatGPT (GPTs Actions)

GPT 편집 화면의 Actions 에 스키마 주소를 넣고, 인증을 API Key / Custom header \`x-api-key\` 로 설정한다.

\`\`\`
${BASE}/api/tools?format=openai
\`\`\`

### Gemini

function calling 을 쓴다면 같은 스키마를 function declarations 로 등록한다.
대화에서는 이 문서 주소를 주는 편이 간단하다.

\`\`\`
${BASE}/api/tools?format=openai
\`\`\`

### Grok

tool use 형식을 지원한다. 아래 주소의 tools 배열을 그대로 넘긴다.

\`\`\`
${BASE}/api/tools
\`\`\`

## 문서·슬라이드를 웹에 게시

한글 양식 외에, AI 가 만든 HTML 을 URL 로 올릴 수도 있다. 링크를 아는 사람만 볼 수 있다.

\`\`\`bash
curl -X POST "${BASE}/api/pages" -H "x-api-key: $GDOC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"제목","html":"<!DOCTYPE html>..."}'
# → { "url": "${BASE}/share/AbC12xYz" }

curl -X POST "${BASE}/api/presentations" -H "x-api-key: $GDOC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"덱 제목","slides":["<div>...</div>","<div>...</div>"]}'
# → { "url": "${BASE}/p/KNr7u3xj" }
\`\`\`

내가 올린 것은 \`DELETE ${BASE}/api/pages/{id}\` 로 내린다.

## 디자인 시스템

슬라이드·문서를 만들 때 이 규칙을 프롬프트에 넣으면 서비스와 같은 디자인이 나온다.

\`\`\`bash
curl "${BASE}/api/design-systems"              # 내장 24종 목록
curl "${BASE}/api/design-systems?id=banya-ai"  # promptBlock 을 프롬프트에 넣는다
\`\`\`

내 브랜드 색으로 직접 만들 수도 있다. 팔레트 7색만 주면 타이포·레이아웃은 기본값으로 채워진다.

\`\`\`bash
curl -X POST "${BASE}/api/design-systems" -H "x-api-key: $GDOC_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"우리 브랜드","palette":{"background":"#0f1720","surface":"#16212b",
       "primary":"#3ddc97","accent":"#ffd166","text":"#e8f1f5","muted":"#8aa0ad","divider":"#24323d"}}'
\`\`\`

## 코인

API 호출은 웹에서 쓸 때와 같은 코인을 소모한다. 가입 시 무료 코인이 지급되고,
모자라면 ${BASE}/pricing 에서 충전한다.

| 호출 | 코인 |
|------|------|
| inspect | 0 (무료) |
| expand-rows | 1 |
| apply | 3 |
| fill | 80 (LLM 사용) |
| pages / presentations 게시 | 2 / 1 |

inspect 가 무료인 이유는 expand-rows 전후로 여러 번 부르는 것이 올바른 사용 흐름이기 때문이다.
잔액이 모자라면 \`402\` 와 함께 부족한 양을 알려준다. 작업이 실패하면 차감분은 자동으로 환원된다.

응답에서 잔액을 확인할 수 있다 — JSON 응답은 \`coinBalance\`, 파일 응답은 \`X-Coin-Balance\` 헤더.

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

// ─────────────────────────── 사람이 보는 페이지 ───────────────────────────

const PAGE_TITLE = 'AI 연동 — GDoc Fixer';
const PAGE_DESC =
  'Claude · ChatGPT · Gemini · Grok 이 한글 양식을 채우고 문서·슬라이드를 웹에 게시하게 하는 방법.';

/** 마크다운을 그대로 감쌀 최소한의 스타일. 외부 자원을 쓰지 않아 어디서든 같게 보인다. */
const PAGE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0b0f14; color:#d7e0e8;
         font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',Segoe UI,sans-serif;
         line-height:1.75; }
  .wrap { max-width: 860px; margin: 0 auto; padding: 48px 20px 96px; }
  .brand { display:flex; align-items:center; gap:10px; margin-bottom:8px;
           font-size:13px; color:#7c8b9a; letter-spacing:.02em; }
  .brand a { color:#7c8b9a; text-decoration:none; }
  .brand a:hover { color:#c7d3de; }
  h1 { font-size:30px; line-height:1.3; margin:.2em 0 .6em; color:#f0f5f9; letter-spacing:-.01em; }
  h2 { font-size:21px; margin:2.2em 0 .7em; padding-top:1.2em; color:#eaf1f7;
       border-top:1px solid #1b2530; }
  h3 { font-size:16px; margin:1.8em 0 .5em; color:#b9c8d6; }
  p, li { font-size:15px; color:#c4d0db; }
  a { color:#6ea8fe; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.88em;
         background:#151d26; color:#8ee7c0; padding:.15em .4em; border-radius:4px; }
  pre { background:#0f151c; border:1px solid #1b2530; border-radius:12px;
        padding:16px; overflow-x:auto; }
  pre code { background:none; color:#c8d6e5; padding:0; font-size:13px; line-height:1.65; }
  table { width:100%; border-collapse:collapse; margin:1.2em 0; font-size:14px; }
  th,td { border:1px solid #1b2530; padding:9px 12px; text-align:left; }
  th { background:#131b24; color:#e3ecf4; }
  blockquote { border-left:3px solid #2a3947; margin:1.2em 0; padding:.2em 1em; color:#9fb0c0; }
  hr { border:0; border-top:1px solid #1b2530; margin:2.4em 0; }
  .cta { display:inline-block; margin-top:8px; padding:10px 18px; border-radius:10px;
         background:#2f6fed; color:#fff; text-decoration:none; font-size:14px; font-weight:600; }
  .note { margin-top:40px; padding:16px 18px; border:1px solid #1b2530; border-radius:12px;
          background:#0f151c; font-size:14px; color:#9fb0c0; }
`;

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * GET /ai — 가이드를 사람이 읽는 HTML 로.
 * AI 가 가져가도 같은 내용을 그대로 받는다(서버에서 완성해 보내므로).
 */
exports.aiSetupPage = onRequest(
  { timeoutSeconds: 30, memory: '256MiB', cors: true },
  async (req, res) => {
    const { marked } = require('marked');
    const body = marked.parse(GUIDE, { mangle: false, headerIds: true });

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeAttr(PAGE_TITLE)}</title>
<meta name="description" content="${escapeAttr(PAGE_DESC)}">
<meta property="og:title" content="${escapeAttr(PAGE_TITLE)}">
<meta property="og:description" content="${escapeAttr(PAGE_DESC)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${BASE}/ai">
<link rel="canonical" href="${BASE}/ai">
<style>${PAGE_CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><a href="${BASE}">GDoc Fixer</a> · AI 연동</div>
  ${body}
  <div class="note">
    <p style="margin:0 0 10px">API 키는 <a href="${BASE}">GDoc Fixer</a> 에 로그인한 뒤 프로필 페이지에서 발급합니다. 발급 직후 한 번만 보이니 안전한 곳에 복사해 두세요.</p>
    <a class="cta" href="${BASE}">키 발급하러 가기</a>
  </div>
  <div class="note" style="margin-top:16px">
    <p style="margin:0">이 문서의 원본(마크다운): <a href="${BASE}/api/guide">${BASE}/api/guide</a><br>
    도구 스키마: <a href="${BASE}/api/tools">${BASE}/api/tools</a> · <a href="${BASE}/api/tools?format=openai">?format=openai</a></p>
  </div>
</div>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(html);
  }
);
