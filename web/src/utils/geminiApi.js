import { renderChartPlaceholders } from './chartRenderer.js';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;
const FLASH_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
const IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${API_KEY}`;

const SLIDE_DELIMITER = '<!--SLIDE_BREAK-->';
const FILE_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`;

// ── Common visualization rules injected into every planning / modify system prompt ──
//
// Defined at the top of the module so that every prompt const below can safely
// interpolate it via `${VISUAL_HTML_RULES}` — const has no hoisting, so any
// reference made before this definition would throw a TDZ ReferenceError.
//
// ASCII box-drawing diagrams produced by the LLM (or pasted by the user)
// break visual consistency and waste tokens via JSON escaping.
const VISUAL_HTML_RULES = `
[Visualization rules — applied to ALL planning modes]
- DO NOT draw diagrams, flow charts, or system architecture figures with ASCII box-drawing characters (┌ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼ ─ ━ ═ etc.).
  Always render them as HTML + Tailwind CSS instead:
    - Boxes: <div class="border border-gray-400 rounded-lg px-4 py-2 bg-gray-50">label</div>
    - Hierarchy / grouping: flex or grid layouts (e.g. <div class="flex flex-col gap-2 p-4 border-2 border-dashed">…</div>)
    - Connectors / arrows: inline SVG (<svg viewBox=…><line>·<path>·<polygon>) or simple arrow characters (→ ← ↑ ↓ ▶ ▼ ◀ ▲)
    - Labels / captions: <span class="text-xs text-gray-500">
- DO NOT emit markdown tables (| col1 | col2 |…). Always emit HTML <table>:
    <table class="w-full border-collapse text-sm">
      <thead class="bg-gray-100"><tr><th class="border px-3 py-2 text-left">…</th></tr></thead>
      <tbody><tr><td class="border px-3 py-2">…</td></tr></tbody>
    </table>
- Use code fences (\`\`\`) ONLY for real programming code (TypeScript, Python, etc.). Never wrap diagrams, tables, structure figures, or example outputs in code fences.
- These rules apply both to content you generate and to ASCII diagrams / markdown tables that appear in the user's original text. Preserve the user's prose (paragraphs, headings, lists, emphasis) verbatim, but rewrite ASCII diagrams and markdown tables in the HTML/CSS form above while preserving their meaning.

[Inline markdown → HTML conversion]
- Convert inline markdown syntax to HTML BEFORE emitting it. Never let raw markdown markers reach the rendered output — browsers render \`**bold**\` as literal asterisks.
  - **bold** / __bold__ → <strong>bold</strong>
  - *italic* / _italic_ → <em>italic</em>
  - \`inline code\` → <code class="px-1 py-0.5 bg-gray-100 rounded text-sm">inline code</code>
  - [link text](https://url) → <a href="https://url" target="_blank" rel="noopener" class="text-blue-600 hover:underline">link text</a>
  - ~~strike~~ → <s>strike</s>
  - Markdown headings (#, ##, ###, …) → <h1>, <h2>, <h3>, … with appropriate Tailwind classes
  - Markdown unordered lists (- item / * item) → <ul class="list-disc list-inside"> with <li>
  - Markdown ordered lists (1. item) → <ol class="list-decimal list-inside"> with <li>
  - Blockquotes (> …) → <blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">…</blockquote>
- This rule applies even in "preserve user content verbatim" modes (custom template). The user's prose stays exactly the same — only the markdown markers themselves are converted to their HTML equivalents (markers are presentation syntax, not content).
- Inside real code blocks (\`\`\` … \`\`\` or <pre><code>…</code></pre>) leave the content untouched.

[YouTube thumbnail rule]
- \`maxresdefault.jpg\` only exists for HD (720p+) videos and returns 404 for standard-definition ones.
- Always include an \`onerror\` fallback that switches to \`hqdefault.jpg\` on 404:
    <a href="https://www.youtube.com/watch?v=VIDEO_ID" target="_blank" rel="noopener">
      <img src="https://img.youtube.com/vi/VIDEO_ID/maxresdefault.jpg"
           onerror="this.onerror=null; this.src='https://img.youtube.com/vi/VIDEO_ID/hqdefault.jpg';"
           alt="..." class="w-full rounded-lg shadow" />
    </a>
- If you prefer a simpler form, just use \`hqdefault.jpg\` directly — it is always available for every video (480×360).

[Output language]
- All natural-language text you produce (titles, headings, body text, descriptions, captions) must be written in Korean (한국어).
- Field names, JSON keys, code identifiers, English-only image prompts, and the image_prompt field stay in English.
`;

/**
 * base64 데이터를 Gemini File API에 업로드하고 fileUri를 반환.
 * inlineData 대신 fileData로 참조하여 요청 페이로드 크기를 대폭 줄임.
 */
async function uploadToGeminiFileApi(base64Data, mimeType = 'image/png') {
  // data URI prefix 제거 (예: "data:image/png;base64,...")
  const pure = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  // base64 → Blob 변환 (fetch 방식이 atob보다 안전)
  const dataUri = `data:${mimeType};base64,${pure}`;
  const blobRes = await fetch(dataUri);
  const blob = await blobRes.blob();

  const res = await fetch(FILE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': mimeType },
    body: blob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `File upload failed: ${res.status}`);
  }
  const { file } = await res.json();
  return file.uri;
}

/**
 * base64를 File API에 업로드 후 fileData part를 반환.
 * 업로드 실패 시 fallback으로 inlineData를 반환.
 */
async function toFilePart(base64Data, mimeType = 'image/png') {
  try {
    const fileUri = await uploadToGeminiFileApi(base64Data, mimeType);
    return { fileData: { fileUri, mimeType } };
  } catch (e) {
    console.warn('[toFilePart] File API 업로드 실패, inlineData fallback:', e.message);
    return { inlineData: { mimeType, data: base64Data } };
  }
}

// ─── Prompts ───

const SYSTEM_PROMPT = `You are an expert who converts HTML content into 16:9 presentation slides.

Analyse the given HTML and recompose it into proposal / presentation-style slides.

Rules:
- Each slide is a self-contained HTML targeted at width:1280px × height:720px.
- Use inline CSS ONLY (no external CSS/JS references).
- The root element of each slide MUST be <div style="width:1280px;height:720px;overflow:hidden;position:relative;...">.

**[REQUIRED] Viewport constraints — must be followed:**
- All content must fit completely inside the 1280×720px region. Overflowing content is NOT allowed.
- The root <div> MUST set overflow:hidden.
- Position inner elements with position:absolute or position:relative using exact pixel coordinates.
- All width, height, top, left, padding, margin, font-size values MUST use px units. NEVER use %, vw, vh, em, or rem.
- If text is long, reduce font-size or shorten it so it fits inside the region.
- Ensure each element's top + height ≤ 720px and left + width ≤ 1280px.
- Before finalising, verify each element's position and size against the viewport.

- Apply a clean, professional presentation design:
  - Generous padding (60px+)
  - Readable, large font sizes (title 40px+, body 24px+)
  - Harmonious background and text colours
  - Clear visual hierarchy (title, subtitle, body)
- Make the first slide a title slide.
- Make the last slide a closing / thank-you slide.
- Split the original HTML into logical units across slides.
- Do not put too much content into a single slide (focus on the key points).
- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- NEVER use external image URLs (http/https).
- base64 data URI images (<img src="data:image/png;base64,..."/>) are allowed.
- NEVER reference external resources (font CDNs, etc.).
- All natural-language text inside the slides must remain in Korean (한국어).

Response format: emit each slide's HTML separated by the delimiter ${SLIDE_DELIMITER}.
Output the slide HTML only — no surrounding prose.

Example:
<div style="width:1280px;height:720px;overflow:hidden;position:relative;...">slide 1</div>
${SLIDE_DELIMITER}
<div style="width:1280px;height:720px;overflow:hidden;position:relative;...">slide 2</div>`;

const MODIFY_SLIDE_PROMPT = `You are an expert who modifies HTML presentation slides.

Given the slide HTML and the user's modification instruction, return the modified slide HTML.

Rules:
- Keep the existing slide size (width:1280px, height:720px).
- Use inline CSS ONLY.
- Keep the root element as <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> form.

**[REQUIRED] Viewport constraints — must be followed:**
- All content must fit completely inside the 1280×720px region. Overflowing content is NOT allowed.
- The root <div> MUST set overflow:hidden.
- Position inner elements with position:absolute or position:relative using exact pixel coordinates.
- All width, height, top, left, padding, margin, font-size values MUST use px units. NEVER use %, vw, vh, em, or rem.
- If text is long, reduce font-size or shorten the text so it fits inside the region.
- For each element, ensure top + height ≤ 720px and left + width ≤ 1280px.
- Before finalising, mentally verify each element's position and size against the viewport.

- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- NEVER use external image URLs (http/https).
- base64 data URI images (<img src="data:image/png;base64,..."/>) are allowed. Keep any existing data URI images in the slide as-is.
- NEVER reference external resources (font CDNs, etc.).
- Output the modified slide HTML only — no surrounding prose, HTML only.
- All natural-language text inside the HTML must remain in Korean (한국어).`;

const MODIFY_WITH_IMAGES_PROMPT = `You are an expert who modifies HTML presentation slides.

Given the slide HTML and the user's modification instruction, return the modified slide HTML. Generated images are provided as placeholders — use them at the positions where images should appear.

Rules:
- Keep the existing slide size (width:1280px, height:720px).
- Use inline CSS ONLY.
- Keep the root element as <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> form.

**[REQUIRED] Viewport constraints — must be followed:**
- All content must fit completely inside the 1280×720px region. Overflowing content is NOT allowed.
- The root <div> MUST set overflow:hidden.
- Position inner elements with position:absolute or position:relative using exact pixel coordinates.
- All width, height, top, left, padding, margin, font-size values MUST use px units. NEVER use %, vw, vh, em, or rem.
- If text is long, reduce font-size or shorten the text so it fits inside the region.
- For each element, ensure top + height ≤ 720px and left + width ≤ 1280px.
- Before finalising, mentally verify each element's position and size against the viewport.

- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- Place image placeholders ({{IMAGE_1}}, {{IMAGE_2}} …) at appropriate positions:
  - Background image: use as background-image: url({{IMAGE_1}})
  - Regular image: use as <img src="{{IMAGE_1}}" style="...">
- Adjust image size and position to fit the slide layout.
- Keep any existing data URI images in the slide as-is.
- NEVER reference external resources.
- Output the modified slide HTML only — no surrounding prose.
- All natural-language text inside the HTML must remain in Korean (한국어).`;

const EXTRACT_IMAGES_PROMPT = `Analyse the user's slide modification instruction and return a JSON array of images that need to be generated.

Each image follows this format:
{"label": "이미지 용도 (예: 배경, 로고, 아이콘 등) — Korean", "prompt": "Detailed English prompt for image generation"}

Rules:
- Extract only items that require image generation.
- Ignore instructions that are not about images (text changes, layout changes, etc.).
- The prompt must be a concrete, detailed description to pass to the image-generation AI.
- The prompt MUST be in English (for image-generation quality).
- For background images, include "16:9 aspect ratio, suitable for presentation background" in the prompt.
- For logos, include "simple, clean logo design, transparent background" in the prompt.
- If no images are needed, return an empty array [].
- Output the JSON array only. No surrounding text.
- The "label" field is in Korean (한국어); the "prompt" field is in English.

Example input: "관련된 내용으로 슬라이드의 배경 이미지를 생성해서 깔고 로고 이미지도 만들어서 넣어줘"
Example output:
[{"label":"배경 이미지","prompt":"Professional corporate presentation background, abstract blue gradient with subtle geometric patterns, 16:9 aspect ratio, suitable for presentation background"},{"label":"로고","prompt":"Modern minimalist company logo design, simple clean icon, transparent background, professional business style"}]`;

const VIEWPORT_FIX_PROMPT = `You are an expert who fixes viewport overflow in HTML presentation slides.

The attached screenshot shows this slide rendered in a 1280×720px viewport with overflow:hidden.
If any content appears clipped, it has overflowed the 1280×720 viewport.

Analyse the provided HTML and the screenshot, and modify the HTML so that all content fits completely inside 1280×720px.

How to fix:
- Reduce font-size.
- Reduce padding / margin.
- Reduce spacing between elements.
- Shorten text that is too long.
- Recompute element positions so that top + height ≤ 720px and left + width ≤ 1280px.

Rules:
- Preserve the original design and colour scheme as much as possible.
- DO NOT delete content — only adjust sizes.
- Keep the root <div> as width:1280px; height:720px; overflow:hidden.
- Use inline CSS only.
- Output the modified HTML only. No surrounding prose.
- All natural-language text inside the HTML must remain in Korean (한국어).`;

// ─── Helpers ───

function stripCodeFences(text) {
  let html = text.trim();
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html|json)?\n?/, '').replace(/\n?```$/, '');
  }
  return html.trim();
}

function parseGeminiResponse(data) {
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(blockReason
      ? `Gemini가 요청을 차단했습니다: ${blockReason}`
      : 'Gemini API에서 응답을 받지 못했습니다.');
  }

  // Gemini 2.5 thinking 모델은 응답을 여러 parts 로 split 한다 (thought part + content part).
  // parts[0] 만 보면 실제 응답이 누락되어 JSON 이 잘린 것처럼 보이므로,
  // thought 가 아닌 모든 text part 를 순서대로 합쳐서 반환한다.
  const parts = candidate.content?.parts || [];
  const text = parts
    .filter(p => typeof p?.text === 'string' && !p.thought)
    .map(p => p.text)
    .join('');

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    if (candidate.finishReason === 'MAX_TOKENS' && text) {
      console.warn('Gemini 응답이 토큰 제한으로 잘렸습니다. 부분 결과를 사용합니다.');
      return text;
    }
    throw new Error(`Gemini 응답 중단: ${candidate.finishReason}`);
  }

  if (!text) {
    throw new Error('Gemini API 응답에 텍스트가 없습니다.');
  }

  return text;
}

const IMAGE_KEYWORDS = [
  '이미지', '그림', '사진', '그래프', '차트', '아이콘', '로고',
  '일러스트', '삽화', '다이어그램', '인포그래픽', '배경 이미지',
  '스크린샷', '캐릭터', '그려', '생성해',
  'image', 'picture', 'photo', 'graph', 'chart', 'icon', 'logo',
  'illustration', 'diagram', 'infographic', 'draw', 'generate',
];

function isImageRelated(instruction) {
  const lower = instruction.toLowerCase();
  return IMAGE_KEYWORDS.some((kw) => lower.includes(kw));
}

// ─── Step 1: Extract image descriptions from instruction ───

async function extractImagePrompts(instruction, slideContext) {
  const res = await fetch(FLASH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: withCurrentDate(EXTRACT_IMAGES_PROMPT) },
            { text: `슬라이드 내용 요약: ${slideContext}\n\n사용자 수정 지시: ${instruction}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`이미지 분석 API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = parseGeminiResponse(data);
  const cleaned = stripCodeFences(text);

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    console.warn('이미지 프롬프트 파싱 실패:', cleaned);
    return [];
  }
}

// ─── Step 2: Generate a single image ───

async function generateImage(prompt) {
  const res = await fetch(IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `Generate a high-quality professional image for a presentation slide.\n\n${prompt}` },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `이미지 생성 API 오류: ${res.status}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('이미지 생성 응답을 받지 못했습니다.');
  }

  const parts = candidate.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const { mimeType, data: b64 } = part.inlineData;
      return `data:${mimeType};base64,${b64}`;
    }
  }

  throw new Error('이미지가 생성되지 않았습니다.');
}

// Generate multiple images in parallel
export async function generateImages(imageDescriptions) {
  const results = await Promise.allSettled(
    imageDescriptions.map(async (desc) => {
      const dataUri = await generateImage(desc.prompt);
      return { label: desc.label, dataUri };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ─── Image post-processing: transparent background for non-background images ───

const BG_LABEL_KEYWORDS = ['배경', 'background', 'bg'];

function isBackgroundImage(label) {
  const lower = (label || '').toLowerCase();
  return BG_LABEL_KEYWORDS.some((kw) => lower.includes(kw));
}

function removeImageBackground(dataUri, tolerance = 40) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, w, h);
      const { data } = imageData;
      const visited = new Uint8Array(w * h);
      const tolSq = tolerance * tolerance;

      const colorDistSq = (idx, r, g, b) => {
        const dr = data[idx] - r;
        const dg = data[idx + 1] - g;
        const db = data[idx + 2] - b;
        return dr * dr + dg * dg + db * db;
      };

      // Flood-fill from the 4 corners to remove connected background
      const seeds = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];

      for (const [sx, sy] of seeds) {
        const si = (sy * w + sx) * 4;
        const bgR = data[si], bgG = data[si + 1], bgB = data[si + 2];

        const queue = [sx, sy];
        let head = 0;

        while (head < queue.length) {
          const x = queue[head++];
          const y = queue[head++];

          if (x < 0 || x >= w || y < 0 || y >= h) continue;
          const key = y * w + x;
          if (visited[key]) continue;

          const idx = key * 4;
          if (colorDistSq(idx, bgR, bgG, bgB) > tolSq) continue;

          visited[key] = 1;
          data[idx + 3] = 0; // make transparent

          queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

export async function processGeneratedImages(images) {
  // 배경 제거 처리를 비활성화: flood-fill 방식이 이미지 모서리를
  // 불규칙하게 투명화시켜 흰색 잔상을 만드는 문제가 있음.
  // Gemini Image 모델이 생성한 이미지를 그대로 사용.
  return images;
}

// ─── Step 3: Modify slide HTML ───

// Force the LLM's notion of "today" to the host's current date.
// Without this, the model leans on its training-time date and emits stale years
// (e.g. 2024) for "today / recently / this week" expressions and document dates.
function withCurrentDate(systemPrompt) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `[System context] Today's date is ${today} (YYYY-MM-DD). All time expressions you produce — document dates, publication dates, "today", "recently", "this week / month / year" — must be computed relative to this date. Do not fall back to your training-time year (e.g. 2024).\n\n${systemPrompt}`;
}

async function callProModel(systemPrompt, userText, options = {}) {
  const { maxOutputTokens = 32768, temperature = 0.7, thinkingBudget } = options;
  const generationConfig = { temperature, maxOutputTokens };
  // Gemini 2.5 Pro는 thinking 토큰이 maxOutputTokens 안에 포함되며 thinking 완전 비활성(0)은 불가.
  // 단순 변환 작업은 최소값(128)을 주어 thinking이 응답 공간을 잡아먹지 못하게 한다.
  if (typeof thinkingBudget === 'number') {
    generationConfig.thinkingConfig = { thinkingBudget };
  }
  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: withCurrentDate(systemPrompt) },
            { text: userText },
          ],
        },
      ],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
  }

  const data = await res.json();
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new Error('LLM 응답이 출력 토큰 한도(MAX_TOKENS)에 잘렸습니다. 원문을 줄이거나 thinkingBudget을 낮춰 다시 시도하세요.');
  }
  if (finishReason && finishReason !== 'STOP') {
    throw new Error(`LLM 응답이 비정상 종료되었습니다 (finishReason=${finishReason}).`);
  }
  const text = parseGeminiResponse(data);
  return stripCodeFences(text);
}

// ─── Public API ───

/**
 * base64 data URI를 플레이스홀더로 대체 (API 요청 크기 축소).
 * 반환: { stripped: 플레이스홀더로 대체된 HTML, images: Map<placeholder, dataUri> }
 */
function stripBase64Images(html) {
  const images = new Map();
  let idx = 0;
  const stripped = html.replace(
    /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,
    (match) => {
      const placeholder = `__B64_IMG_${idx++}__`;
      images.set(placeholder, match);
      return placeholder;
    }
  );
  return { stripped, images };
}

function restoreBase64Images(html, images) {
  let result = html;
  for (const [placeholder, dataUri] of images) {
    result = result.replaceAll(placeholder, dataUri);
  }
  return result;
}

/**
 * 반복되는 인라인 style을 CSS 클래스로 추출하여 HTML 크기를 대폭 축소.
 * DOCX-imported HTML에서 동일 style이 수백 번 반복되는 문제를 해결.
 * 반환: { compressed, styleMap } — styleMap은 복원용 Map<className, styleString>
 */
function compressInlineStyles(html) {
  // 1단계: 모든 인라인 style의 출현 횟수 집계
  const styleCounts = new Map();
  html.replace(/ style="([^"]*)"/g, (_, s) => {
    const trimmed = s.trim();
    if (trimmed) styleCounts.set(trimmed, (styleCounts.get(trimmed) || 0) + 1);
  });

  // 2회 이상 반복 & 20자 이상인 style만 클래스로 추출
  const styleToClass = new Map();
  let idx = 0;
  for (const [style, count] of styleCounts) {
    if (count >= 2 && style.length > 20) {
      styleToClass.set(style, `_s${idx++}`);
    }
  }

  if (styleToClass.size === 0) {
    // 최적화 대상 없으면 공백만 축소
    const minified = html.replace(/\n\s+/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
    return { compressed: minified, styleMap: styleToClass };
  }

  // 2단계: 인라인 style → class로 대체
  let result = html.replace(/ style="([^"]*)"/g, (match, s) => {
    const cls = styleToClass.get(s.trim());
    return cls ? ` class="${cls}"` : match;
  });

  // 3단계: <style> 블록 생성 & 삽입
  const cssRules = Array.from(styleToClass.entries())
    .map(([style, cls]) => `.${cls}{${style}}`)
    .join('\n');
  const styleTag = `<style>\n${cssRules}\n</style>`;

  if (result.includes('</head>')) {
    result = result.replace('</head>', styleTag + '\n</head>');
  } else {
    result = styleTag + '\n' + result;
  }

  // 4단계: 공백 축소, 주석 제거
  result = result.replace(/\n\s+/g, '\n').replace(/<!--[\s\S]*?-->/g, '');

  return { compressed: result, styleMap: styleToClass };
}

/**
 * Gemini 응답에서 압축된 CSS 클래스(_s0, _s1, ...)를 인라인 style로 복원.
 * 1) 응답 HTML 내 <style> 블록에서 ._sN{...} 규칙 파싱
 * 2) class="_sN" → style="..." 로 대체
 * 3) 생성된 ._sN CSS 규칙 제거
 */
function decompressInlineStyles(html) {
  // 1단계: <style> 블록에서 ._sN{...} 규칙 추출
  const classToStyle = new Map();
  const rulePattern = /\._s(\d+)\{([^}]+)\}/g;
  let match;
  while ((match = rulePattern.exec(html)) !== null) {
    classToStyle.set(`_s${match[1]}`, match[2]);
  }

  if (classToStyle.size === 0) return html;

  // 2단계: class="_sN" → style="..." 복원
  let result = html.replace(/ class="(_s\d+)"/g, (m, cls) => {
    const style = classToStyle.get(cls);
    return style ? ` style="${style}"` : m;
  });

  // 3단계: ._sN{...} CSS 규칙 제거 (style 블록 내부에서)
  result = result.replace(/\._s\d+\{[^}]+\}\n?/g, '');

  // 빈 <style> 블록 정리
  result = result.replace(/<style>\s*<\/style>\n?/g, '');

  return result;
}

export async function convertHtmlToSlides(html) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // base64 이미지를 제거하여 API 요청 크기 축소
  const { stripped, images } = stripBase64Images(html);

  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: withCurrentDate(SYSTEM_PROMPT) },
            { text: `다음 HTML을 프레젠테이션 슬라이드로 변환하세요:\n\n${stripped}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 65536,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = parseGeminiResponse(data);
  const cleaned = stripCodeFences(text);

  const slides = cleaned
    .split(SLIDE_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('<div'));

  if (slides.length === 0) {
    throw new Error('유효한 슬라이드가 생성되지 않았습니다.');
  }

  // Gemini가 플레이스홀더를 슬라이드에 포함시킨 경우 원본 이미지로 복원
  return slides.map((s) => restoreBase64Images(s, images));
}

const MODIFY_ALL_SLIDES_PROMPT = `You are an expert who modifies HTML presentation slides.

Multiple slides are provided as HTML separated by the delimiter ${SLIDE_DELIMITER}.
Apply the user's modification instruction consistently to ALL slides and return the modified slides.

**Slide add / delete rules:**
- If the user explicitly requests deleting specific slides, remove them.
- If the user explicitly requests adding slides, add them.
- Otherwise, keep the same number of slides as the input.

Rules:
- Keep each slide's size (width:1280px, height:720px).
- Use inline CSS ONLY.
- Keep each slide's root element as <div style="width:1280px;height:720px;overflow:hidden;position:relative;...">.

**[REQUIRED] Viewport constraints — must be followed:**
- All content must fit completely inside the 1280×720px region. Overflowing content is NOT allowed.
- The root <div> MUST set overflow:hidden.
- Position inner elements with position:absolute or position:relative using exact pixel coordinates.
- All width, height, top, left, padding, margin, font-size values MUST use px units. NEVER use %, vw, vh, em, or rem.
- If text is long, reduce font-size or shorten it so it fits inside the region.
- Ensure each element's top + height ≤ 720px and left + width ≤ 1280px.
- Before finalising, verify each element's position and size against the viewport.

- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- NEVER use external image URLs (http/https).
- Keep any existing data URI images in the slides as-is.
- NEVER reference external resources (font CDNs, etc.).
- Apply the modification consistently to every slide (e.g. if a background-colour change is requested, change every slide's background colour).
- Emit the modified slide HTMLs separated by ${SLIDE_DELIMITER}.
- Output the slide HTML only — no surrounding prose.
- All natural-language text inside the slides must remain in Korean (한국어).`;

const MODIFY_ALL_WITH_IMAGES_PROMPT = `You are an expert who modifies HTML presentation slides.

Multiple slides are provided as HTML separated by the delimiter ${SLIDE_DELIMITER}.
Apply the user's modification instruction consistently to ALL slides and return the modified slides.
Generated images are provided as placeholders — use them at the positions where images should appear.

**Slide add / delete rules:**
- If the user explicitly requests deleting specific slides, remove them.
- If the user explicitly requests adding slides, add them.
- Otherwise, keep the same number of slides as the input.

Rules:
- Keep each slide's size (width:1280px, height:720px).
- Use inline CSS ONLY.
- Keep each slide's root element as <div style="width:1280px;height:720px;overflow:hidden;position:relative;...">.

**[REQUIRED] Viewport constraints — must be followed:**
- All content must fit completely inside the 1280×720px region. Overflowing content is NOT allowed.
- The root <div> MUST set overflow:hidden.
- Position inner elements with position:absolute or position:relative using exact pixel coordinates.
- All width, height, top, left, padding, margin, font-size values MUST use px units. NEVER use %, vw, vh, em, or rem.
- If text is long, reduce font-size or shorten it so it fits inside the region.
- Ensure each element's top + height ≤ 720px and left + width ≤ 1280px.
- Before finalising, verify each element's position and size against the viewport.

- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- Place image placeholders ({{IMAGE_1}}, {{IMAGE_2}} …) at appropriate positions:
  - Background image: use as background-image: url({{IMAGE_1}})
  - Regular image: use as <img src="{{IMAGE_1}}" style="...">
- Adjust image size and position to fit the slide layout.
- Keep any existing data URI images in the slides as-is.
- NEVER reference external resources.
- Apply the modification consistently to every slide.
- Emit the modified slide HTMLs separated by ${SLIDE_DELIMITER}.
- Output the slide HTML only — no surrounding prose.
- All natural-language text inside the slides must remain in Korean (한국어).`;

// 슬라이드 수 변동 로깅
function logSlideCountChange(result, originals) {
  if (result.length !== originals.length) {
    console.log(`슬라이드 수 변경: ${originals.length}개 → ${result.length}개`);
  }
  return result;
}

export async function modifyAllSlidesHtml(allSlides, instruction) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const allSlidesHtml = allSlides.join(`\n${SLIDE_DELIMITER}\n`);
  const slideContext = allSlides.map((s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)).join(' | ');

  // Check if instruction involves image generation
  if (isImageRelated(instruction)) {
    let imageDescriptions = [];
    try {
      imageDescriptions = await extractImagePrompts(instruction, slideContext.slice(0, 500));
    } catch (err) {
      console.warn('이미지 분석 실패:', err.message);
    }

    if (imageDescriptions.length > 0) {
      const generatedImages = await generateImages(imageDescriptions);

      if (generatedImages.length > 0) {
        const processedImages = await processGeneratedImages(generatedImages);

        const imageInfo = processedImages
          .map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`)
          .join('\n');

        const userText = `전체 슬라이드 HTML (${allSlides.length}개):\n\n${allSlidesHtml}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시 (모든 슬라이드에 적용):\n${instruction}`;
        let html = await callProModel(MODIFY_ALL_WITH_IMAGES_PROMPT, userText);

        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        const slides = html
          .split(SLIDE_DELIMITER)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.includes('<div'));

        if (slides.length > 0) return logSlideCountChange(slides, allSlides);
        throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
      }
    }
  }

  // Text-only modification for all slides
  const userText = `전체 슬라이드 HTML (${allSlides.length}개):\n\n${allSlidesHtml}\n\n수정 지시 (모든 슬라이드에 적용):\n${instruction}`;
  const html = await callProModel(MODIFY_ALL_SLIDES_PROMPT, userText);

  const slides = html
    .split(SLIDE_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('<div'));

  if (slides.length === 0) {
    throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
  }

  return logSlideCountChange(slides, allSlides);
}

export async function modifySlideHtml(currentSlideHtml, instruction, screenshotBase64, attachedImages = []) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // 첨부 이미지의 dataUri 맵 (플레이스홀더 → 실제 data URI)
  const attachedImageMap = new Map();
  if (attachedImages.length > 0) {
    attachedImages.forEach((img, i) => {
      attachedImageMap.set(`{{ATTACHED_${i + 1}}}`, img.dataUri);
    });
  }

  // 스크린샷 + 첨부 이미지를 Gemini File API에 업로드 후 parts 구성
  const buildParts = async (systemPrompt, userText) => {
    const parts = [{ text: withCurrentDate(systemPrompt) }, { text: userText }];
    // 첨부 이미지 업로드 (시각적 참조용) + 플레이스홀더 안내
    if (attachedImages.length > 0) {
      for (let i = 0; i < attachedImages.length; i++) {
        const img = attachedImages[i];
        const base64 = img.dataUri.split(',')[1] || img.dataUri;
        const mimeType = img.mimeType || 'image/png';
        parts.push(await toFilePart(base64, mimeType));
        parts.push({ text: `위 이미지는 사용자가 첨부한 이미지 #${i + 1}입니다. 이 이미지를 슬라이드에 삽입할 때 src="{{ATTACHED_${i + 1}}}" 플레이스홀더를 사용하세요. 절대 base64 data URI를 직접 생성하지 마세요.` });
      }
    }
    if (screenshotBase64) {
      parts.push(await toFilePart(screenshotBase64, 'image/png'));
      parts.push({ text: '위 이미지는 현재 슬라이드의 렌더링 결과입니다. 현재 레이아웃과 시각적 상태를 참고하여 수정하세요.' });
    }
    return parts;
  };

  const callProModelWithScreenshot = async (systemPrompt, userText) => {
    const parts = await buildParts(systemPrompt, userText);
    const bodyJson = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
    });
    console.log('[callProModelWithScreenshot] request body 크기:', bodyJson.length.toLocaleString(), '자');
    const res = await fetch(PRO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJson,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
    }
    const data = await res.json();
    console.log('[callProModelWithScreenshot] usageMetadata:', JSON.stringify(data.usageMetadata));
    console.log('[callProModelWithScreenshot] finishReason:', data.candidates?.[0]?.finishReason);
    return stripCodeFences(parseGeminiResponse(data));
  };

  // 슬라이드 HTML 내 base64 이미지를 플레이스홀더로 교체 (토큰 절약)
  const { stripped: strippedSlideHtml, images: embeddedImages } = stripBase64Images(currentSlideHtml);
  console.log(`[modifySlideHtml] base64 스트립: ${embeddedImages.size}개 이미지 제거, ${strippedSlideHtml.length.toLocaleString()}자`);

  // Check if instruction involves image generation
  if (isImageRelated(instruction)) {
    const slideText = currentSlideHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    let imageDescriptions = [];
    try {
      imageDescriptions = await extractImagePrompts(instruction, slideText);
    } catch (err) {
      console.warn('이미지 분석 실패:', err.message);
    }

    if (imageDescriptions.length > 0) {
      const generatedImages = await generateImages(imageDescriptions);

      if (generatedImages.length > 0) {
        const processedImages = await processGeneratedImages(generatedImages);

        const imageInfo = processedImages
          .map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`)
          .join('\n');

        const userText = `현재 슬라이드 HTML:\n\n${strippedSlideHtml}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시:\n${instruction}`;
        let html = await callProModelWithScreenshot(MODIFY_WITH_IMAGES_PROMPT, userText);

        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        // 원본 base64 이미지 복원
        html = restoreBase64Images(html, embeddedImages);
        // 첨부 이미지 플레이스홀더 복원
        for (const [ph, dataUri] of attachedImageMap) {
          html = html.replaceAll(ph, dataUri);
        }

        if (html.includes('<div')) return html;
        throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
      }
    }
  }

  // Text-only modification (with screenshot)
  const userText = `현재 슬라이드 HTML:\n\n${strippedSlideHtml}\n\n수정 지시:\n${instruction}`;
  let html = await callProModelWithScreenshot(MODIFY_SLIDE_PROMPT, userText);

  // 원본 base64 이미지 복원
  html = restoreBase64Images(html, embeddedImages);
  // 첨부 이미지 플레이스홀더 복원
  for (const [ph, dataUri] of attachedImageMap) {
    html = html.replaceAll(ph, dataUri);
  }

  if (!html.includes('<div')) {
    throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
  }

  return html;
}

// ─── Document-level HTML modification ───

const MODIFY_DOCUMENT_PROMPT = `You are an expert who modifies HTML documents.

Given an HTML document and the user's modification instruction, return the modified HTML document.

Rules:
- Preserve the full structure of the original HTML (from <!DOCTYPE html> to </html>).
- Keep meta tags, styles, and font links inside <head> intact.
- If Tailwind CSS CDN script is present, keep it.
- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- Apply the user's instruction by editing content inside <body>.
- Preserve the document's formatting (font, size, color, alignment, etc.) as much as possible while applying the changes.
- Reuse existing HTML elements where appropriate: <table>, <ul>/<ol>, <img>, etc.
- When attachment data is provided, reference it according to the user's instruction. Excel comes as CSV per sheet, text files as raw text, images/PDFs as inline data.
- Placeholders of the form __B64_IMG_N__ are image slots — NEVER delete them, always keep them in place.
- When a chart/graph is needed, do not draw it yourself. Insert an HTML comment placeholder in this exact form (the client renders it via Chart.js):
  <!--CHART:{"type":"line","title":"차트 제목","labels":["1월","2월"],"datasets":[{"label":"시리즈명","data":[10,20]}],"xLabel":"X축","yLabel":"Y축"}-->
  type: "line" | "bar" | "pie" | "doughnut" | "radar"
  width/height are optional (default 800x500)
  stacked: true enables stacked charts
- Output the complete modified HTML document only — no surrounding prose, HTML only.
- All natural-language text inside the HTML must remain in Korean (한국어). Chart titles, labels, axis names go in Korean as in the example above.
${VISUAL_HTML_RULES}`;

const MODIFY_DOCUMENT_WITH_IMAGES_PROMPT = `You are an expert who modifies HTML documents.

Given an HTML document and the user's modification instruction, return the modified HTML document. Image placeholders ({{IMAGE_1}}, {{IMAGE_2}} …) are provided — place them appropriately.

Rules:
- Preserve the full structure of the original HTML (from <!DOCTYPE html> to </html>).
- Keep meta tags, styles, and font links inside <head> intact.
- If Tailwind CSS CDN script is present, keep it.
- Korean font: use font-family: 'Noto Sans KR', sans-serif.
- Place image placeholders appropriately as <img src="{{IMAGE_N}}" ...> or as background images.
- Background image: style="background-image: url({{IMAGE_N}}); background-size: cover;"
- Illustration / icon: <img src="{{IMAGE_N}}" class="..." alt="..." />
- NEVER use external image URLs (placeholders only).
- Output the complete modified HTML document only — no surrounding prose.
- All natural-language text inside the HTML must remain in Korean (한국어).
${VISUAL_HTML_RULES}`;

// ─── Diff-based modification prompt for large documents ───

const MODIFY_DOCUMENT_DIFF_PROMPT = `You are an expert who modifies HTML documents.

Analyse the given HTML document and the user's modification instruction, and return ONLY the parts that need to change, in the delimited format below.
Because the document is very large, do not output it in full again — specify only the precise changes.

Response format (output only this delimited form):
===DIFF_START===
<<<FIND>>>
The original HTML text to modify (must match the original exactly)
<<<REPLACE>>>
The replacement HTML text
===DIFF_END===
===DIFF_START===
<<<FIND>>>
Another section to modify
<<<REPLACE>>>
New content
===DIFF_END===

Rules:
- The text under <<<FIND>>> must exist in the original HTML EXACTLY. Include enough surrounding context to make the match unique.
- Put the modified HTML under <<<REPLACE>>>.
- To delete content, leave <<<REPLACE>>> empty (immediately before ===DIFF_END===).
- To add content, put the existing HTML at the insertion point under <<<FIND>>>, and put existing + new content under <<<REPLACE>>>.
- Preserve the document's existing formatting (inline style, CSS classes, etc.) as much as possible.
- When attachment data is provided, reference it according to the user's instruction.
- Placeholders of the form __B64_IMG_N__ must never be deleted.
- When a chart/graph is needed, do not draw it. Insert an HTML comment placeholder inside <<<REPLACE>>> in this form (the client renders it via Chart.js):
  <!--CHART:{"type":"line","title":"차트 제목","labels":["1월","2월"],"datasets":[{"label":"시리즈명","data":[10,20]}],"xLabel":"X축","yLabel":"Y축"}-->
  type: "line" | "bar" | "pie" | "doughnut" | "radar"
  width/height are optional (default 800x500)
  stacked: true enables stacked charts
- Output the delimited form only — no surrounding prose.
- All natural-language text inside <<<REPLACE>>> must remain in Korean (한국어).`;

// 대형 문서 판단 기준: 압축 후 이 크기 초과 시 diff 모드 사용
const LARGE_DOC_THRESHOLD = 100_000; // ~25K 토큰

/**
 * 구분자 기반 Diff 응답을 파싱.
 * ===DIFF_START=== ... <<<FIND>>> ... <<<REPLACE>>> ... ===DIFF_END===
 */
function parseDiffResponse(text) {
  const diffs = [];
  const blocks = text.split('===DIFF_START===').slice(1); // 첫 빈 요소 제거
  for (const block of blocks) {
    const endIdx = block.indexOf('===DIFF_END===');
    const content = endIdx >= 0 ? block.slice(0, endIdx) : block;

    const findIdx = content.indexOf('<<<FIND>>>');
    const replaceIdx = content.indexOf('<<<REPLACE>>>');
    if (findIdx < 0 || replaceIdx < 0) continue;

    const find = content.slice(findIdx + '<<<FIND>>>'.length, replaceIdx).trim();
    const replace = content.slice(replaceIdx + '<<<REPLACE>>>'.length).trim();
    if (find) diffs.push({ find, replace });
  }
  return diffs;
}

/**
 * Diff 배열을 원본 HTML에 적용.
 * [{find, replace}, ...] 형태의 수정 사항을 순차 적용.
 */
function applyDiffOperations(html, diffs) {
  let result = html;
  let applied = 0;
  for (const { find, replace } of diffs) {
    if (!find) continue;
    if (result.includes(find)) {
      result = result.replace(find, replace);
      applied++;
    } else {
      console.warn('[applyDiff] 매칭 실패:', find.slice(0, 80) + '...');
    }
  }
  console.log(`[applyDiff] ${diffs.length}개 중 ${applied}개 적용 완료`);
  return result;
}

export async function modifyDocumentHtml(currentHtml, instruction, attachments = []) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // 1) HTML 내 base64 이미지를 플레이스홀더로 대체
  const { stripped: b64Stripped, images: embeddedImages } = stripBase64Images(currentHtml);

  // 2) 반복 인라인 스타일을 CSS 클래스로 압축
  const { compressed: strippedHtml } = compressInlineStyles(b64Stripped);

  // 대형 문서 여부 판단
  const isLargeDoc = strippedHtml.length > LARGE_DOC_THRESHOLD;

  // 디버깅 로그
  console.log('[modifyDocumentHtml] 원본 HTML:', currentHtml.length.toLocaleString(), '자');
  console.log('[modifyDocumentHtml] base64 스트립 후:', b64Stripped.length.toLocaleString(), '자 (이미지', embeddedImages.size, '개 제거)');
  console.log('[modifyDocumentHtml] 스타일 압축 후:', strippedHtml.length.toLocaleString(), '자');
  console.log('[modifyDocumentHtml] 모드:', isLargeDoc ? 'DIFF (대형 문서)' : 'FULL (전체 반환)');
  console.log('[modifyDocumentHtml] 첨부 파일 수:', attachments.length);
  attachments.forEach((a, i) => {
    if (a.promptText) {
      console.log(`  첨부[${i}] ${a.fileName} (text): ${a.promptText.length.toLocaleString()} 자`);
    } else if (a.base64) {
      console.log(`  첨부[${i}] ${a.fileName} (binary): ${a.base64.length.toLocaleString()} 자`);
    }
  });

  // 텍스트 첨부 데이터 (excel, text) → 프롬프트에 포함
  const textAttachments = attachments
    .filter((a) => a.promptText)
    .map((a) => a.promptText)
    .join('\n\n');
  const textSection = textAttachments
    ? `\n\n── 첨부된 파일 데이터 (참조용) ──\n${textAttachments}\n── 첨부 데이터 끝 ──\n`
    : '';

  // 바이너리 첨부 (image, pdf) → Gemini File API 업로드 후 fileData parts
  const binaryAttachments = attachments.filter((a) => a.base64 && a.mimeType);
  const binaryParts = await Promise.all(
    binaryAttachments.map((a) => toFilePart(a.base64, a.mimeType))
  );
  const binaryLabels = binaryAttachments
    .map((a) => `[첨부 파일: ${a.fileName}]`)
    .join('\n');
  const binaryLabelPart = binaryLabels ? `\n\n${binaryLabels}\n위 파일들이 첨부되어 있습니다. 사용자의 지시에 따라 참조하세요.` : '';

  // callProModel wrapper that supports extra binary parts
  const callWithAttachments = async (systemPrompt, userText) => {
    const parts = [
      { text: withCurrentDate(systemPrompt) },
      { text: userText },
      ...binaryParts,
    ];
    const bodyJson = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
    });
    console.log('[callWithAttachments] request body 크기:', bodyJson.length.toLocaleString(), '자 (~', Math.round(bodyJson.length / 4).toLocaleString(), '토큰 추정)');
    const res = await fetch(PRO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyJson,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
    }
    const data = await res.json();
    return stripCodeFences(parseGeminiResponse(data));
  };

  // ── 대형 문서: Diff 모드 ──
  if (isLargeDoc) {
    const prompt = MODIFY_DOCUMENT_DIFF_PROMPT;
    const userText = `현재 HTML 문서:\n\n${strippedHtml}${textSection}${binaryLabelPart}\n\n수정 지시:\n${instruction}`;
    console.log('[modifyDocumentHtml] DIFF 모드 — userText:', userText.length.toLocaleString(), '자');

    // Diff 모드는 maxOutputTokens를 65536으로 올림
    const callDiffModel = async (systemPrompt, uText) => {
      const parts = [
        { text: withCurrentDate(systemPrompt) },
        { text: uText },
        ...binaryParts,
      ];
      const res = await fetch(PRO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
      }
      const data = await res.json();
      return stripCodeFences(parseGeminiResponse(data));
    };

    const rawResponse = await callDiffModel(prompt, userText);

    // 구분자 기반 파싱
    const diffs = parseDiffResponse(rawResponse);
    if (diffs.length === 0) {
      console.error('[modifyDocumentHtml] Diff 파싱 결과 없음:', rawResponse.slice(0, 300));
      throw new Error('문서 수정 결과를 파싱할 수 없습니다. 다시 시도해주세요.');
    }

    console.log('[modifyDocumentHtml] Diff 수:', diffs.length);

    // 압축된 HTML에 diff 적용 후, 원본(비압축) HTML에도 적용
    // 원본 HTML(b64Stripped)에 직접 적용 — 스타일 압축은 API 전송용이었으므로
    // Gemini가 반환한 find 텍스트에는 CSS 클래스(_sN)가 포함될 수 있으므로,
    // 압축된 HTML과 원본 HTML 양쪽에 시도
    let result = b64Stripped;

    // 먼저 압축 HTML 기준으로 diff 적용한 뒤, 인라인 스타일로 복원
    const compressedResult = applyDiffOperations(strippedHtml, diffs);
    const decompressed = decompressInlineStyles(compressedResult);

    // base64 이미지 복원
    result = restoreBase64Images(decompressed, embeddedImages);

    // 차트 플레이스홀더를 Chart.js 이미지로 렌더링
    result = renderChartPlaceholders(result);

    return result;
  }

  // ── 소형 문서: 기존 FULL 모드 ──

  // 이미지 관련 지시인지 LLM이 판단하여 이미지 생성
  if (isImageRelated(instruction)) {
    const docText = currentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    let imageDescriptions = [];
    try {
      imageDescriptions = await extractImagePrompts(instruction, docText);
    } catch (err) {
      console.warn('이미지 분석 실패:', err.message);
    }

    if (imageDescriptions.length > 0) {
      const generatedImages = await generateImages(imageDescriptions);

      if (generatedImages.length > 0) {
        const processedImages = await processGeneratedImages(generatedImages);

        const imageInfo = processedImages
          .map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`)
          .join('\n');

        const userText = `현재 HTML 문서:\n\n${strippedHtml}${textSection}${binaryLabelPart}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시:\n${instruction}`;
        let html = binaryParts.length > 0
          ? await callWithAttachments(MODIFY_DOCUMENT_WITH_IMAGES_PROMPT, userText)
          : await callProModel(MODIFY_DOCUMENT_WITH_IMAGES_PROMPT, userText);

        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        // 압축된 CSS 클래스를 인라인 스타일로 복원
        html = decompressInlineStyles(html);
        // 원본 base64 이미지 복원
        html = restoreBase64Images(html, embeddedImages);

        // 차트 플레이스홀더를 Chart.js 이미지로 렌더링
        html = renderChartPlaceholders(html);

        if (html.includes('<')) return html;
        throw new Error('유효한 HTML이 반환되지 않았습니다.');
      }
    }
  }

  // 텍스트만 수정
  const userText = `현재 HTML 문서:\n\n${strippedHtml}${textSection}${binaryLabelPart}\n\n수정 지시:\n${instruction}`;
  console.log('[modifyDocumentHtml] FULL 모드 — userText:', userText.length.toLocaleString(), '자');
  let html = binaryParts.length > 0
    ? await callWithAttachments(MODIFY_DOCUMENT_PROMPT, userText)
    : await callProModel(MODIFY_DOCUMENT_PROMPT, userText);

  // 압축된 CSS 클래스를 인라인 스타일로 복원
  html = decompressInlineStyles(html);
  // 원본 base64 이미지 복원
  html = restoreBase64Images(html, embeddedImages);

  // 차트 플레이스홀더를 Chart.js 이미지로 렌더링
  html = renderChartPlaceholders(html);

  if (!html.includes('<')) {
    throw new Error('유효한 HTML이 반환되지 않았습니다.');
  }

  return html;
}

// ─── Planning: Research + Document Generation with Google Search Grounding ───
const PLANNING_JSON_FORMAT = `Respond strictly in the following JSON format:

{
  "title": "기획안 제목 (Korean)",
  "sections": [
    {
      "heading": "섹션 제목 (Korean)",
      "subsections": [
        {
          "subheading": "소제목 (Korean)",
          "contentBrief": "이 소제목에 들어갈 내용 설명 — 2-3 문장, 조사한 데이터·수치 포함 (Korean)"
        }
      ]
    }
  ],
  "imageDescriptions": [
    {
      "label": "이미지 용도 설명 (Korean)",
      "prompt": "Detailed English prompt for image generation AI. Professional, high-quality style."
    }
  ],
  "searchFindings": "조사 결과 요약 — 핵심 데이터·통계·트렌드 (Korean)"
}

Common rules:
- Use Google Search to gather up-to-date information, statistics, and trends.
- The imageDescriptions[*].prompt MUST be written in English.
- For background images: include "배경" in the label and "16:9 aspect ratio, suitable for document header background" in the prompt.
- For icon / logo images: include "simple, clean icon design, flat style, white background" in the prompt.
- For general illustration images: include "professional illustration, clean style" in the prompt.
- Include concrete numbers and statistics from your research in each contentBrief.
- Output JSON only — no surrounding prose.
${VISUAL_HTML_RULES}`;

const TEMPLATE_PROMPTS = {
  business_plan: `You are a professional business-plan writer. Given the user's brief, use Google Search to research the relevant market and industry, and design a business-plan structure that can persuade investors or executives.

Required sections:
- Executive Summary: business idea, vision, mission
- Market Analysis: target market size (TAM/SAM/SOM), growth rate, trends (research up-to-date market data via Google Search)
- Competitive Analysis: key competitors, competitive advantage, SWOT
- Business Model: revenue model, pricing strategy, customer-acquisition strategy
- Marketing / Sales Strategy: channel strategy, GTM plan, key KPIs
- Operations Plan: org structure, key people, tech infrastructure
- Financial Plan: revenue projection, P&L outlook, funding ask and intended use
- Roadmap: major milestones, phased execution plan

Produce 7-10 sections and 4-6 images.

${PLANNING_JSON_FORMAT}`,

  company_intro: `You are a professional writer of company-introduction documents. Given the user's brief, use Google Search to research the relevant industry context and design a company-intro structure that conveys credibility and expertise.

Required sections:
- Company Overview: name, founding date, CEO, vision/mission, core values
- CEO's Message: management philosophy, company direction
- History / Milestones: key milestones since founding, awards
- Business Areas: main business domains, service/product lineup (research industry context via Google Search)
- Core Capabilities / Technology: owned tech, patents, certifications, differentiators
- Key Track Record / Portfolio: flagship projects, key clients, revenue scale
- Organization / People: org size, key people, culture
- Partnerships / Network: major partners, alliances
- Directions / Contact: HQ and branch locations, contact info

Produce 7-9 sections and 4-6 images. Use a tone that emphasises credibility and professionalism.

${PLANNING_JSON_FORMAT}`,

  product_intro: `You are a professional writer of product/service introduction documents. Given the user's brief, use Google Search to research the target product market and competing products, and design a structure that drives customer purchase decisions.

Required sections:
- Product Overview: product name, value proposition, one-line description
- Problem Definition: the customer's core problem / pain point
- Solution: how the product solves it, the core mechanism
- Key Features: 3-5 main features and the customer benefit of each (research differentiators vs competitors via Google Search)
- Tech Specs: detailed specifications, supported environments, compatibility
- Use Cases / Scenarios: real-world usage examples and scenarios
- Competitive Comparison: advantages over competing products, comparison table
- Customer Testimonials / Results: adoption stories, performance numbers, recommendations
- Pricing / Plans: pricing structure, feature comparison by plan
- Onboarding: adoption process, free trial, contact

Produce 7-10 sections and 4-6 images. Clearly communicate functional benefits and customer value.

${PLANNING_JSON_FORMAT}`,

  custom: `You are a professional proposal writer. Given the user's planning brief, use Google Search to research the topic and design a structure for a professional proposal document.

Reflect the user-provided content as faithfully as possible, and fill in gaps with Google Search findings.
Prioritise the user's specified structure, ordering, and emphasis; use research only to enrich, not to override.

Produce 5-8 sections and 3-6 images.

${PLANNING_JSON_FORMAT}`,
};

const PLANNING_RESEARCH_PROMPT = TEMPLATE_PROMPTS.custom;

// ─── Custom mode: no research, preserve user content verbatim ───

const PLANNING_CUSTOM_EXTRACT_PROMPT = `You are an operator who (1) organises the user's hand-written proposal into sections and (2) extracts image descriptions that match the body content. You are NOT a writer.

Absolute rules:
- Never add anything that is not in the user's original text. Do not invent outside knowledge, reasoning, statistics, or sources.
- The user's prose (paragraphs, headings, lists, emphasis) must be carried over verbatim — no summarising, compressing, reorganising, or polishing. Preserve line breaks, spacing, and even typos.
- TWO exceptions are converted in form while preserving meaning (see [Visualization rules] below):
    (a) ASCII box-drawing diagrams / flow charts / system architecture figures → HTML + Tailwind CSS
    (b) Markdown tables (| col | col | …) → HTML <table>
- Real programming code inside code fences must be left exactly as-is (only diagrams are converted).
- Split sections only where the original is clearly already split. When in doubt, keep one section.
- If the user supplies explicit titles/subtitles, use them verbatim as headings. Otherwise create a 1-3 word heading that summarises the section (prefer reusing words from the body).
- Extract images only where a visualisation/diagram/illustration clearly helps. 0 images is fine — do not force them. (Do not re-extract diagrams you already converted to HTML/CSS as images.)

${VISUAL_HTML_RULES}

Respond strictly in the following JSON format:

{
  "title": "The most fitting title taken from the user's original text. If absent, use the first line or a short summary of the core topic. (Korean)",
  "sections": [
    {
      "heading": "Section heading (Korean)",
      "content": "Body text taken verbatim from the user's original (line breaks preserved). May contain HTML-converted diagrams/tables. (Korean prose)"
    }
  ],
  "imageDescriptions": [
    {
      "label": "Korean description of the image's purpose (which section, what role)",
      "prompt": "Detailed English image generation prompt. Professional, high-quality style."
    }
  ]
}

Image prompt rules:
- The prompt MUST be in English.
- Background images: include "배경" in the label and "16:9 aspect ratio, suitable for document header background" in the prompt.
- Icons / logos: include "simple, clean icon design, flat style, white background" in the prompt.
- General illustrations: include "professional illustration, clean style" in the prompt.

Output JSON only. No surrounding text.`;

export async function planUserContentForFormatting(brief) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const text = await callProModel(
    PLANNING_CUSTOM_EXTRACT_PROMPT,
    `User original text:\n\n${brief}`,
    { maxOutputTokens: 65536, temperature: 0.2, thinkingBudget: 128 },
  );

  try {
    const plan = JSON.parse(text);
    if (!plan.title || !Array.isArray(plan.sections) || !Array.isArray(plan.imageDescriptions)) {
      throw new Error('기획안 구조가 올바르지 않습니다.');
    }
    return plan;
  } catch (parseErr) {
    if (parseErr.message === '기획안 구조가 올바르지 않습니다.') throw parseErr;
    console.error('Custom plan JSON parse failed:', text);
    throw new Error('기획안 구조 파싱에 실패했습니다. 다시 시도해주세요.');
  }
}

const PLANNING_COMPOSE_PROMPT = `You are an expert who composes professional HTML proposal documents.

Given the structured plan and image placeholders, produce a complete HTML document.

Rules:
- Emit a full HTML document (from <!DOCTYPE html> to </html>).
- Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"><\\/script>
- Korean font link: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
- Apply font-family: 'Noto Sans KR', sans-serif on body.
- Use a professional, clean proposal document design:
  - Cover / header section (title, date, planning intent)
  - Table of contents
  - Each section visually separated (background colour, dividers, etc.)
  - Data presented in tables or lists
  - Appropriate spacing and typography
  - Citations / sources where present
- Place image placeholders ({{IMAGE_1}}, {{IMAGE_2}} …) appropriately:
  - Background image: style="background-image: url({{IMAGE_1}}); background-size: cover;"
  - Illustration / icon: <img src="{{IMAGE_1}}" class="..." alt="..." />
- Size images via Tailwind classes to fit the document layout.
- NEVER use external image URLs (placeholders only).
- Design for A4 / web width (max-width: 1024px).
- Output the full modified HTML document only — no surrounding prose.
- All natural-language text inside the HTML (titles, headings, captions, body) must be in Korean (한국어).
${VISUAL_HTML_RULES}`;

export async function researchAndPlan(brief, templateType = 'custom') {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const systemPrompt = TEMPLATE_PROMPTS[templateType] || PLANNING_RESEARCH_PROMPT;

  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: withCurrentDate(systemPrompt) },
            { text: `Planning brief:\n\n${brief}` },
          ],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `주제 조사 API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = parseGeminiResponse(data);
  const cleaned = stripCodeFences(text);

  try {
    const plan = JSON.parse(cleaned);
    if (!plan.title || !plan.sections || !plan.imageDescriptions) {
      throw new Error('기획안 구조가 올바르지 않습니다.');
    }
    return plan;
  } catch (parseErr) {
    if (parseErr.message === '기획안 구조가 올바르지 않습니다.') throw parseErr;
    console.error('Plan JSON parse failed:', cleaned);
    throw new Error('기획안 구조 파싱에 실패했습니다. 다시 시도해주세요.');
  }
}

export async function composeDocument(plan, processedImages) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const imageInfo = processedImages
    .map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`)
    .join('\n');

  const planText = JSON.stringify(plan, null, 2);

  const userText = `Proposal structure:\n\n${planText}\n\nAvailable image placeholders:\n${imageInfo}\n\nBased on the structure above, compose a professional HTML proposal document.`;

  let html = await callProModel(PLANNING_COMPOSE_PROMPT, userText);

  // Replace image placeholders with actual data URIs
  processedImages.forEach((img, i) => {
    const placeholder = `{{IMAGE_${i + 1}}}`;
    html = html.replaceAll(placeholder, img.dataUri);
  });

  if (!html.includes('<')) {
    throw new Error('유효한 HTML이 생성되지 않았습니다.');
  }

  return html;
}

const PLANNING_COMPOSE_CUSTOM_PROMPT = `You are a designer who formats the user's original text into a visually polished HTML proposal document. You are NOT a writer.

Absolute rules:
- The body text of sections[*].content (prose / headings / lists / emphasis) must be carried over verbatim — no additions, deletions, summarising, restructuring, or polishing. Place the user's original text into the HTML as-is.
- Do not invent any new sentences, data, statistics, sources, or citations that are not in the user's text.
- Splitting line breaks into paragraphs (<p>) or lists (<ul>/<ol>) for visual readability IS allowed — but never change the text itself.
- title and sections[*].heading must also be used exactly as the user wrote them.
- HTML markup already embedded in sections[*].content (in particular <div>/<table>/<svg> diagrams/tables that were already converted from ASCII/markdown) MUST be preserved as-is in the output HTML. Never revert them back to ASCII or markdown tables.

HTML design requirements:
- Emit a full HTML document (from <!DOCTYPE html> to </html>).
- Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"><\\/script>
- Korean font link: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
- Apply font-family: 'Noto Sans KR', sans-serif on body.
- Apply a professional, clean proposal-document design:
  - Cover / header section (title — exactly as given)
  - Each section visually separated (background colour, dividers, etc.)
  - Appropriate spacing and typography
- Design for A4 / web width (max-width: 1024px).

Image placement:
- Place image placeholders ({{IMAGE_1}}, {{IMAGE_2}} …) naturally near the section that matches each image's label.
- Background image: style="background-image: url({{IMAGE_1}}); background-size: cover;"
- Regular image: <img src="{{IMAGE_1}}" class="..." alt="..." />
- There may be zero images — in that case design cleanly with text only.
- NEVER use external image URLs (placeholders only).

Output the complete HTML document only. No surrounding text.
- All natural-language text inside the HTML must remain in Korean (한국어).
${VISUAL_HTML_RULES}`;

export async function composeCustomDocument(plan, processedImages) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const imageInfo = processedImages.length > 0
    ? processedImages.map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`).join('\n')
    : '(no images)';

  const planText = JSON.stringify(plan, null, 2);

  const userText = `Original plan data (sections[*].content IS the user's original text):\n\n${planText}\n\nAvailable image placeholders:\n${imageInfo}\n\nPlace title, sections[*].heading, and sections[*].content into the HTML without changing a single character of their text. You are only responsible for design and image placement.`;

  let html = await callProModel(PLANNING_COMPOSE_CUSTOM_PROMPT, userText, { maxOutputTokens: 65536, temperature: 0.2, thinkingBudget: 128 });

  processedImages.forEach((img, i) => {
    const placeholder = `{{IMAGE_${i + 1}}}`;
    html = html.replaceAll(placeholder, img.dataUri);
  });

  if (!html.includes('<')) {
    throw new Error('유효한 HTML이 생성되지 않았습니다.');
  }

  return html;
}

// ─── Viewport fix: render → screenshot → Gemini Flash multimodal → fixed HTML ───

export async function renderSlideToBase64(slideHtml) {
  const { toPng } = await import('html-to-image');

  const container = document.createElement('div');
  container.style.cssText =
    'position:fixed;left:-9999px;top:-9999px;width:1280px;height:720px;overflow:hidden;z-index:-1;';
  container.innerHTML = slideHtml;
  document.body.appendChild(container);

  try {
    // Wait for any images to load
    const images = container.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.onload = r;
              img.onerror = r;
            })
      )
    );

    const dataUrl = await toPng(container.firstElementChild || container, {
      width: 1280,
      height: 720,
      canvasWidth: 1280,
      canvasHeight: 720,
    });

    return dataUrl.split(',')[1]; // base64 only
  } finally {
    document.body.removeChild(container);
  }
}

async function fixSlideViewport(slideHtml, imageBase64) {
  const screenshotPart = await toFilePart(imageBase64, 'image/png');
  const res = await fetch(FLASH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: withCurrentDate(VIEWPORT_FIX_PROMPT) },
            { text: `수정할 슬라이드 HTML:\n\n${slideHtml}` },
            screenshotPart,
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `뷰포트 픽스 API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = parseGeminiResponse(data);
  return stripCodeFences(text);
}

export async function fixAllSlideViewports(slides) {
  const results = [];
  for (let i = 0; i < slides.length; i++) {
    try {
      const base64 = await renderSlideToBase64(slides[i]);
      const fixed = await fixSlideViewport(slides[i], base64);
      results.push(fixed.includes('<div') ? fixed : slides[i]);
    } catch (err) {
      console.warn(`슬라이드 ${i + 1} 뷰포트 픽스 실패:`, err);
      results.push(slides[i]);
    }
  }
  return results;
}

/** 단일 슬라이드 뷰포트 수정 (진행률 추적용) */
export async function fixSingleSlideViewport(slideHtml) {
  const base64 = await renderSlideToBase64(slideHtml);
  const fixed = await fixSlideViewport(slideHtml, base64);
  return fixed.includes('<div') ? fixed : slideHtml;
}
