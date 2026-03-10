const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;
const FLASH_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
const IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${API_KEY}`;

const SLIDE_DELIMITER = '<!--SLIDE_BREAK-->';

// ─── Prompts ───

const SYSTEM_PROMPT = `당신은 HTML 콘텐츠를 16:9 비율의 프레젠테이션 슬라이드로 변환하는 전문가입니다.

주어진 HTML을 분석하여 제안서/프레젠테이션 형식의 슬라이드들로 재구성하세요.

규칙:
- 각 슬라이드는 width:1280px, height:720px 크기에 맞는 독립적인 HTML입니다
- 반드시 인라인 CSS만 사용하세요 (외부 CSS/JS 참조 불가)
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> 형태여야 합니다

**[필수] 뷰포트 제약 — 반드시 준수하세요:**
- 모든 콘텐츠는 반드시 1280×720px 영역 안에 완전히 들어가야 합니다. 영역 밖으로 넘치는 콘텐츠는 절대 허용되지 않습니다.
- 루트 div에 반드시 overflow:hidden을 설정하세요.
- 내부 요소 배치 시 position:absolute 또는 position:relative를 사용하여 정확한 좌표(px)로 배치하세요.
- 모든 width, height, top, left, padding, margin, font-size 값은 반드시 px 단위를 사용하세요. %, vw, vh, em, rem 단위는 절대 사용하지 마세요.
- 텍스트가 길어질 경우 폰트 크기를 줄이거나 내용을 축약하여 반드시 영역 안에 맞추세요.
- 각 요소의 top + height가 720px를 초과하지 않도록, left + width가 1280px를 초과하지 않도록 계산하세요.
- 배치 전 각 요소의 위치와 크기를 계산하여 뷰포트를 벗어나지 않는지 검증하세요.

- 깔끔하고 전문적인 프레젠테이션 디자인을 적용하세요
  - 적절한 여백(padding: 60px 이상)
  - 가독성 좋은 큰 폰트 크기(제목 40px+, 본문 24px+)
  - 조화로운 배경색과 텍스트 색상
  - 시각적 계층 구조(제목, 부제목, 본문)
- 첫 슬라이드는 제목 슬라이드로 구성
- 마지막 슬라이드는 감사/마무리 슬라이드로 구성
- 원본 HTML의 내용을 논리적 단위로 분리하여 슬라이드를 만드세요
- 한 슬라이드에 너무 많은 내용을 넣지 마세요 (핵심 포인트 위주)
- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 외부 이미지 URL(http/https)을 절대 사용하지 마세요
- base64 data URI 이미지(<img src="data:image/png;base64,...">)는 사용 가능합니다
- 외부 리소스(폰트 CDN 등)를 절대 참조하지 마세요

응답 형식: 각 슬라이드 HTML을 ${SLIDE_DELIMITER} 구분자로 구분하여 출력하세요.
다른 설명 텍스트 없이 슬라이드 HTML만 출력하세요.

예시:
<div style="width:1280px;height:720px;overflow:hidden;position:relative;...">슬라이드1</div>
${SLIDE_DELIMITER}
<div style="width:1280px;height:720px;overflow:hidden;position:relative;...">슬라이드2</div>`;

const MODIFY_SLIDE_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

주어진 슬라이드 HTML과 사용자의 수정 지시를 받아 수정된 슬라이드 HTML을 반환하세요.

규칙:
- 기존 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> 형태를 유지하세요

**[필수] 뷰포트 제약 — 반드시 준수하세요:**
- 모든 콘텐츠는 반드시 1280×720px 영역 안에 완전히 들어가야 합니다. 영역 밖으로 넘치는 콘텐츠는 절대 허용되지 않습니다.
- 루트 div에 반드시 overflow:hidden을 설정하세요.
- 내부 요소 배치 시 position:absolute 또는 position:relative를 사용하여 정확한 좌표(px)로 배치하세요.
- 모든 width, height, top, left, padding, margin, font-size 값은 반드시 px 단위를 사용하세요. %, vw, vh, em, rem 단위는 절대 사용하지 마세요.
- 텍스트가 길어질 경우 폰트 크기를 줄이거나 내용을 축약하여 반드시 영역 안에 맞추세요.
- 각 요소의 top + height가 720px를 초과하지 않도록, left + width가 1280px를 초과하지 않도록 계산하세요.
- 배치 전 각 요소의 위치와 크기를 계산하여 뷰포트를 벗어나지 않는지 검증하세요.

- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 외부 이미지 URL(http/https)을 절대 사용하지 마세요
- base64 data URI 이미지(<img src="data:image/png;base64,...">)는 사용 가능합니다. 이미 슬라이드에 포함된 data URI 이미지는 그대로 유지하세요.
- 외부 리소스(폰트 CDN 등)를 절대 참조하지 마세요
- 수정된 슬라이드 HTML만 출력하세요. 다른 설명 텍스트는 없이 HTML만 출력하세요.`;

const MODIFY_WITH_IMAGES_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

주어진 슬라이드 HTML과 사용자의 수정 지시를 받아 수정된 슬라이드 HTML을 반환하세요.
생성된 이미지들이 플레이스홀더로 제공됩니다. 이미지를 배치할 위치에 해당 플레이스홀더를 사용하세요.

규칙:
- 기존 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> 형태를 유지하세요

**[필수] 뷰포트 제약 — 반드시 준수하세요:**
- 모든 콘텐츠는 반드시 1280×720px 영역 안에 완전히 들어가야 합니다. 영역 밖으로 넘치는 콘텐츠는 절대 허용되지 않습니다.
- 루트 div에 반드시 overflow:hidden을 설정하세요.
- 내부 요소 배치 시 position:absolute 또는 position:relative를 사용하여 정확한 좌표(px)로 배치하세요.
- 모든 width, height, top, left, padding, margin, font-size 값은 반드시 px 단위를 사용하세요. %, vw, vh, em, rem 단위는 절대 사용하지 마세요.
- 텍스트가 길어질 경우 폰트 크기를 줄이거나 내용을 축약하여 반드시 영역 안에 맞추세요.
- 각 요소의 top + height가 720px를 초과하지 않도록, left + width가 1280px를 초과하지 않도록 계산하세요.
- 배치 전 각 요소의 위치와 크기를 계산하여 뷰포트를 벗어나지 않는지 검증하세요.

- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 이미지 플레이스홀더({{IMAGE_1}}, {{IMAGE_2}} 등)를 적절한 위치에 배치하세요:
  - 배경 이미지: background-image: url({{IMAGE_1}}) 형태로 사용
  - 일반 이미지: <img src="{{IMAGE_1}}" style="..."> 형태로 사용
- 이미지 크기와 위치를 슬라이드 레이아웃에 맞게 조정하세요
- 이미 슬라이드에 포함된 기존 data URI 이미지는 그대로 유지하세요
- 외부 리소스를 절대 참조하지 마세요
- 수정된 슬라이드 HTML만 출력하세요. 다른 설명 텍스트는 없이 HTML만 출력하세요.`;

const EXTRACT_IMAGES_PROMPT = `사용자의 슬라이드 수정 지시를 분석하여 생성해야 할 이미지 목록을 JSON 배열로 반환하세요.

각 이미지는 다음 형식입니다:
{"label": "이미지 용도 (예: 배경, 로고, 아이콘 등)", "prompt": "이미지 생성을 위한 상세한 영문 프롬프트"}

규칙:
- 이미지 생성이 필요한 항목만 추출하세요
- 텍스트 변경, 레이아웃 변경 등 이미지가 아닌 지시는 무시하세요
- prompt는 이미지 생성 AI에게 전달할 구체적이고 상세한 설명이어야 합니다
- prompt는 영문으로 작성하세요 (이미지 생성 품질을 위해)
- 배경 이미지인 경우 "16:9 aspect ratio, suitable for presentation background" 를 prompt에 포함하세요
- 로고인 경우 "simple, clean logo design, transparent background" 를 prompt에 포함하세요
- 이미지가 필요 없으면 빈 배열 []을 반환하세요
- JSON 배열만 출력하세요. 다른 텍스트 없이.

예시 입력: "관련된 내용으로 슬라이드의 배경 이미지를 생성해서 깔고 로고 이미지도 만들어서 넣어줘"
예시 출력:
[{"label":"배경 이미지","prompt":"Professional corporate presentation background, abstract blue gradient with subtle geometric patterns, 16:9 aspect ratio, suitable for presentation background"},{"label":"로고","prompt":"Modern minimalist company logo design, simple clean icon, transparent background, professional business style"}]`;

const VIEWPORT_FIX_PROMPT = `당신은 HTML 프레젠테이션 슬라이드의 뷰포트 오버플로우를 수정하는 전문가입니다.

첨부된 스크린샷은 이 슬라이드를 1280×720px 뷰포트에서 overflow:hidden으로 렌더링한 결과입니다.
콘텐츠가 잘려 보인다면 뷰포트(1280×720) 밖으로 넘친 것입니다.

주어진 HTML 코드를 분석하고 스크린샷을 참고하여, 모든 콘텐츠가 1280×720px 안에 완전히 들어가도록 수정하세요.

수정 방법:
- 폰트 크기를 줄이세요
- 여백(padding/margin)을 줄이세요
- 요소 간 간격을 줄이세요
- 텍스트가 너무 길면 축약하세요
- 모든 요소의 위치를 재계산하여 top+height ≤ 720px, left+width ≤ 1280px 확인

규칙:
- 원본의 디자인과 색상 구성을 최대한 유지하세요
- 콘텐츠를 삭제하지 마세요 — 크기만 조정하세요
- 루트 div의 width:1280px;height:720px;overflow:hidden을 반드시 유지하세요
- 인라인 CSS만 사용하세요
- 수정된 HTML만 출력하세요. 다른 설명 없이.`;

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

  const text = candidate.content?.parts?.[0]?.text;

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
            { text: EXTRACT_IMAGES_PROMPT },
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
  return Promise.all(
    images.map(async (img) => {
      if (isBackgroundImage(img.label)) {
        console.log(`이미지 "${img.label}" → 배경 이미지, 투명 처리 생략`);
        return img;
      }

      console.log(`이미지 "${img.label}" → 비배경 이미지, 배경 투명 처리`);
      const processedUri = await removeImageBackground(img.dataUri);
      return { ...img, dataUri: processedUri };
    })
  );
}

// ─── Step 3: Modify slide HTML ───

async function callProModel(systemPrompt, userText) {
  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: userText },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
  }

  const data = await res.json();
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
            { text: SYSTEM_PROMPT },
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

const MODIFY_ALL_SLIDES_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

여러 슬라이드의 HTML이 ${SLIDE_DELIMITER} 구분자로 구분되어 제공됩니다.
사용자의 수정 지시를 모든 슬라이드에 일관되게 적용하여 수정된 슬라이드들을 반환하세요.

**슬라이드 삭제/추가 규칙:**
- 사용자가 명시적으로 특정 슬라이드 삭제를 요청하면 해당 슬라이드를 제거하세요.
- 사용자가 명시적으로 슬라이드 추가를 요청하면 새 슬라이드를 추가하세요.
- 삭제/추가 요청이 없으면 입력된 슬라이드 수를 유지하세요.

규칙:
- 각 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> 형태를 유지하세요

**[필수] 뷰포트 제약 — 반드시 준수하세요:**
- 모든 콘텐츠는 반드시 1280×720px 영역 안에 완전히 들어가야 합니다. 영역 밖으로 넘치는 콘텐츠는 절대 허용되지 않습니다.
- 루트 div에 반드시 overflow:hidden을 설정하세요.
- 내부 요소 배치 시 position:absolute 또는 position:relative를 사용하여 정확한 좌표(px)로 배치하세요.
- 모든 width, height, top, left, padding, margin, font-size 값은 반드시 px 단위를 사용하세요. %, vw, vh, em, rem 단위는 절대 사용하지 마세요.
- 텍스트가 길어질 경우 폰트 크기를 줄이거나 내용을 축약하여 반드시 영역 안에 맞추세요.
- 각 요소의 top + height가 720px를 초과하지 않도록, left + width가 1280px를 초과하지 않도록 계산하세요.
- 배치 전 각 요소의 위치와 크기를 계산하여 뷰포트를 벗어나지 않는지 검증하세요.

- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 외부 이미지 URL(http/https)을 절대 사용하지 마세요
- 이미 슬라이드에 포함된 data URI 이미지는 그대로 유지하세요
- 외부 리소스(폰트 CDN 등)를 절대 참조하지 마세요
- 모든 슬라이드에 수정 지시를 일관되게 적용하세요 (예: 배경색 변경이면 모든 슬라이드 배경색 변경)
- 수정된 슬라이드 HTML들을 ${SLIDE_DELIMITER} 구분자로 구분하여 출력하세요
- 다른 설명 텍스트 없이 슬라이드 HTML만 출력하세요.`;

const MODIFY_ALL_WITH_IMAGES_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

여러 슬라이드의 HTML이 ${SLIDE_DELIMITER} 구분자로 구분되어 제공됩니다.
사용자의 수정 지시를 모든 슬라이드에 일관되게 적용하여 수정된 슬라이드들을 반환하세요.
생성된 이미지들이 플레이스홀더로 제공됩니다. 이미지를 배치할 위치에 해당 플레이스홀더를 사용하세요.

**슬라이드 삭제/추가 규칙:**
- 사용자가 명시적으로 특정 슬라이드 삭제를 요청하면 해당 슬라이드를 제거하세요.
- 사용자가 명시적으로 슬라이드 추가를 요청하면 새 슬라이드를 추가하세요.
- 삭제/추가 요청이 없으면 입력된 슬라이드 수를 유지하세요.

규칙:
- 각 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;position:relative;..."> 형태를 유지하세요

**[필수] 뷰포트 제약 — 반드시 준수하세요:**
- 모든 콘텐츠는 반드시 1280×720px 영역 안에 완전히 들어가야 합니다. 영역 밖으로 넘치는 콘텐츠는 절대 허용되지 않습니다.
- 루트 div에 반드시 overflow:hidden을 설정하세요.
- 내부 요소 배치 시 position:absolute 또는 position:relative를 사용하여 정확한 좌표(px)로 배치하세요.
- 모든 width, height, top, left, padding, margin, font-size 값은 반드시 px 단위를 사용하세요. %, vw, vh, em, rem 단위는 절대 사용하지 마세요.
- 텍스트가 길어질 경우 폰트 크기를 줄이거나 내용을 축약하여 반드시 영역 안에 맞추세요.
- 각 요소의 top + height가 720px를 초과하지 않도록, left + width가 1280px를 초과하지 않도록 계산하세요.
- 배치 전 각 요소의 위치와 크기를 계산하여 뷰포트를 벗어나지 않는지 검증하세요.

- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 이미지 플레이스홀더({{IMAGE_1}}, {{IMAGE_2}} 등)를 적절한 위치에 배치하세요:
  - 배경 이미지: background-image: url({{IMAGE_1}}) 형태로 사용
  - 일반 이미지: <img src="{{IMAGE_1}}" style="..."> 형태로 사용
- 이미지 크기와 위치를 슬라이드 레이아웃에 맞게 조정하세요
- 이미 슬라이드에 포함된 기존 data URI 이미지는 그대로 유지하세요
- 외부 리소스를 절대 참조하지 마세요
- 모든 슬라이드에 수정 지시를 일관되게 적용하세요
- 수정된 슬라이드 HTML들을 ${SLIDE_DELIMITER} 구분자로 구분하여 출력하세요
- 다른 설명 텍스트 없이 슬라이드 HTML만 출력하세요.`;

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

export async function modifySlideHtml(currentSlideHtml, instruction, screenshotBase64) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // 스크린샷을 포함한 multimodal parts 구성 헬퍼
  const buildParts = (systemPrompt, userText) => {
    const parts = [{ text: systemPrompt }, { text: userText }];
    if (screenshotBase64) {
      parts.push({ inlineData: { mimeType: 'image/png', data: screenshotBase64 } });
      parts.push({ text: '위 이미지는 현재 슬라이드의 렌더링 결과입니다. 현재 레이아웃과 시각적 상태를 참고하여 수정하세요.' });
    }
    return parts;
  };

  const callProModelWithScreenshot = async (systemPrompt, userText) => {
    const res = await fetch(PRO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: buildParts(systemPrompt, userText) }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 32768 },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
    }
    const data = await res.json();
    return stripCodeFences(parseGeminiResponse(data));
  };

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

        const userText = `현재 슬라이드 HTML:\n\n${currentSlideHtml}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시:\n${instruction}`;
        let html = await callProModelWithScreenshot(MODIFY_WITH_IMAGES_PROMPT, userText);

        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        if (html.includes('<div')) return html;
        throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
      }
    }
  }

  // Text-only modification (with screenshot)
  const userText = `현재 슬라이드 HTML:\n\n${currentSlideHtml}\n\n수정 지시:\n${instruction}`;
  const html = await callProModelWithScreenshot(MODIFY_SLIDE_PROMPT, userText);

  if (!html.includes('<div')) {
    throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
  }

  return html;
}

// ─── Document-level HTML modification ───

const MODIFY_DOCUMENT_PROMPT = `당신은 HTML 문서를 수정하는 전문가입니다.

주어진 HTML 문서와 사용자의 수정 지시를 받아 수정된 HTML 문서를 반환하세요.

규칙:
- 원본 HTML 문서의 전체 구조(<!DOCTYPE html>부터 </html>까지)를 유지하세요
- <head> 내의 메타 태그, 스타일, 폰트 링크 등을 그대로 유지하세요
- Tailwind CSS CDN 스크립트가 포함되어 있으면 유지하세요
- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 사용자의 수정 지시에 따라 <body> 내의 콘텐츠를 수정하세요
- 문서의 서식(글꼴, 크기, 색상, 정렬 등)을 최대한 유지하면서 지시사항을 반영하세요
- 표(table), 목록(ul/ol), 이미지(img) 등 기존 HTML 요소를 적절히 활용하세요
- 첨부된 파일 데이터가 있으면 사용자 지시에 따라 해당 데이터를 참조하여 문서를 수정하세요. Excel 데이터는 시트별 CSV 형식으로, 텍스트 파일은 원본 텍스트로, 이미지/PDF는 인라인 데이터로 제공됩니다.
- HTML 내에 __B64_IMG_N__ 형태의 플레이스홀더가 있으면 이미지 자리이므로 절대 삭제하지 말고 그대로 유지하세요.
- 수정된 전체 HTML 문서만 출력하세요. 다른 설명 텍스트 없이 HTML만 출력하세요.`;

const MODIFY_DOCUMENT_WITH_IMAGES_PROMPT = `당신은 HTML 문서를 수정하는 전문가입니다.

주어진 HTML 문서와 사용자의 수정 지시를 받아 수정된 HTML 문서를 반환하세요.
이미지 플레이스홀더({{IMAGE_1}}, {{IMAGE_2}} 등)가 제공되며, 이를 적절한 위치에 배치하세요.

규칙:
- 원본 HTML 문서의 전체 구조(<!DOCTYPE html>부터 </html>까지)를 유지하세요
- <head> 내의 메타 태그, 스타일, 폰트 링크 등을 그대로 유지하세요
- Tailwind CSS CDN 스크립트가 포함되어 있으면 유지하세요
- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 이미지 플레이스홀더를 적절한 위치에 <img src="{{IMAGE_N}}" ...> 또는 배경 이미지로 배치하세요
- 배경용 이미지: style="background-image: url({{IMAGE_N}}); background-size: cover;" 형태
- 삽화/아이콘: <img src="{{IMAGE_N}}" class="..." alt="..."> 형태
- 외부 이미지 URL을 절대 사용하지 마세요 (플레이스홀더만 사용)
- 수정된 전체 HTML 문서만 출력하세요. 다른 설명 텍스트 없이 HTML만 출력하세요.`;

// ─── 대형 문서용 Diff 기반 수정 프롬프트 ───

const MODIFY_DOCUMENT_DIFF_PROMPT = `당신은 HTML 문서를 수정하는 전문가입니다.

주어진 HTML 문서와 사용자의 수정 지시를 분석하여, **수정이 필요한 부분만** 구분자 형식으로 반환하세요.
문서가 매우 크므로 전체를 다시 출력하지 마세요. 변경 사항만 정확히 지정하세요.

응답 형식 (아래 구분자 형식만 출력):
===DIFF_START===
<<<FIND>>>
수정할 원본 HTML 텍스트 (원본과 정확히 일치)
<<<REPLACE>>>
대체할 새 HTML 텍스트
===DIFF_END===
===DIFF_START===
<<<FIND>>>
다른 수정할 부분
<<<REPLACE>>>
새 내용
===DIFF_END===

규칙:
- <<<FIND>>> 아래의 텍스트는 원본 HTML에서 **정확히** 존재해야 합니다. 고유하게 매칭되도록 충분한 컨텍스트를 포함하세요.
- <<<REPLACE>>> 아래에 수정된 결과 HTML을 넣으세요.
- 내용을 삭제하려면 <<<REPLACE>>> 아래를 비워두세요 (===DIFF_END=== 바로 전).
- 내용을 추가하려면 <<<FIND>>>에 삽입 위치의 기존 HTML을 넣고, <<<REPLACE>>>에 기존 내용 + 추가 내용을 넣으세요.
- 문서의 기존 서식(인라인 style, CSS 클래스 등)을 최대한 유지하세요.
- 첨부된 파일 데이터가 있으면 사용자 지시에 따라 참조하세요.
- HTML 내에 __B64_IMG_N__ 형태의 플레이스홀더가 있으면 절대 삭제하지 마세요.
- 위 구분자 형식만 출력하세요. 다른 설명 텍스트 없이.`;

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

  // 바이너리 첨부 (image, pdf) → Gemini inlineData parts
  const binaryParts = attachments
    .filter((a) => a.base64 && a.mimeType)
    .map((a) => ({
      inlineData: { mimeType: a.mimeType, data: a.base64 },
    }));
  const binaryLabels = attachments
    .filter((a) => a.base64 && a.mimeType)
    .map((a) => `[첨부 파일: ${a.fileName}]`)
    .join('\n');
  const binaryLabelPart = binaryLabels ? `\n\n${binaryLabels}\n위 파일들이 인라인 데이터로 첨부되어 있습니다. 사용자의 지시에 따라 참조하세요.` : '';

  // callProModel wrapper that supports extra binary parts
  const callWithAttachments = async (systemPrompt, userText) => {
    const parts = [
      { text: systemPrompt },
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
        { text: systemPrompt },
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

  if (!html.includes('<')) {
    throw new Error('유효한 HTML이 반환되지 않았습니다.');
  }

  return html;
}

// ─── Planning: Research + Document Generation with Google Search Grounding ───

const PLANNING_JSON_FORMAT = `반드시 다음 JSON 형식으로만 응답하세요:

{
  "title": "기획안 제목",
  "sections": [
    {
      "heading": "섹션 제목",
      "subsections": [
        {
          "subheading": "소제목",
          "contentBrief": "이 소제목 아래에 들어갈 내용 설명 (2-3문장, 조사한 데이터/수치 포함)"
        }
      ]
    }
  ],
  "imageDescriptions": [
    {
      "label": "이미지 용도 설명 (한글)",
      "prompt": "Detailed English prompt for image generation AI. Professional, high-quality style."
    }
  ],
  "searchFindings": "조사 결과 요약 (핵심 데이터, 통계, 트렌드 등)"
}

공통 규칙:
- Google 검색으로 최신 정보, 통계, 트렌드를 조사하세요
- imageDescriptions의 prompt는 반드시 영문으로 작성하세요
- 배경용 이미지의 label에 "배경"을 포함하고 prompt에 "16:9 aspect ratio, suitable for document header background"를 포함하세요
- 아이콘/로고 이미지의 prompt에 "simple, clean icon design, flat style, white background"를 포함하세요
- 일반 삽화 이미지의 prompt에 "professional illustration, clean style"을 포함하세요
- contentBrief에 조사한 구체적 데이터와 수치를 포함하세요
- JSON만 출력하세요. 다른 텍스트 없이.`;

const TEMPLATE_PROMPTS = {
  business_plan: `당신은 사업계획서 전문 작성자입니다. 사용자의 브리프를 받아 Google 검색을 활용하여 시장과 산업을 조사하고, 투자자 또는 경영진을 설득할 수 있는 전문적인 사업계획서 구조를 설계하세요.

필수 포함 섹션:
- 사업 개요 (Executive Summary): 사업 아이디어, 비전, 미션
- 시장 분석: 목표 시장 규모(TAM/SAM/SOM), 성장률, 트렌드 (Google 검색으로 최신 시장 데이터 조사)
- 경쟁 분석: 주요 경쟁사, 경쟁 우위, SWOT 분석
- 비즈니스 모델: 수익 모델, 가격 전략, 고객 획득 전략
- 마케팅/영업 전략: 채널 전략, GTM 전략, 핵심 KPI
- 운영 계획: 조직 구조, 핵심 인력, 기술 인프라
- 재무 계획: 매출 추정, 손익 전망, 투자 요청 금액 및 사용처
- 로드맵: 주요 마일스톤, 단계별 실행 계획

섹션은 7-10개, 이미지는 4-6개로 구성하세요.

${PLANNING_JSON_FORMAT}`,

  company_intro: `당신은 회사 소개서 전문 작성자입니다. 사용자의 브리프를 받아 Google 검색을 활용하여 해당 업계 정보를 조사하고, 신뢰감과 전문성을 전달하는 회사 소개서 구조를 설계하세요.

필수 포함 섹션:
- 회사 개요: 회사명, 설립일, 대표이사, 비전/미션, 핵심 가치
- CEO 인사말: 경영 철학, 회사 방향성
- 연혁/주요 성과: 설립부터 현재까지 주요 이정표, 수상 내역
- 사업 영역: 주요 사업 분야, 서비스/제품 라인업 (Google 검색으로 업계 현황 조사)
- 핵심 역량/기술력: 보유 기술, 특허, 인증, 차별화 포인트
- 주요 실적/포트폴리오: 대표 프로젝트, 주요 고객사, 매출 규모
- 조직/인재: 조직 규모, 핵심 인력, 기업 문화
- 파트너십/네트워크: 주요 협력사, 제휴 관계
- 오시는 길/연락처: 본사 및 지사 위치, 연락 정보

섹션은 7-9개, 이미지는 4-6개로 구성하세요. 기업의 신뢰성과 전문성을 강조하는 톤으로 작성하세요.

${PLANNING_JSON_FORMAT}`,

  product_intro: `당신은 제품/서비스 소개서 전문 작성자입니다. 사용자의 브리프를 받아 Google 검색을 활용하여 해당 제품 시장과 경쟁 제품을 조사하고, 고객의 구매 결정을 이끌어내는 제품 소개서 구조를 설계하세요.

필수 포함 섹션:
- 제품 소개/개요: 제품명, 핵심 가치 제안(Value Proposition), 한 줄 설명
- 문제 정의: 고객이 겪는 핵심 문제/Pain Point 정의
- 솔루션: 제품이 해결하는 방식, 핵심 메커니즘
- 주요 기능/특징: 핵심 기능 3-5가지, 각 기능의 고객 혜택 (Google 검색으로 경쟁 제품 대비 차별점 조사)
- 기술 사양/스펙: 상세 스펙, 지원 환경, 호환성
- 사용 사례/시나리오: 실제 활용 사례, 고객 사용 시나리오
- 경쟁 비교: 경쟁 제품 대비 장점, 비교표
- 고객 후기/성과: 도입 사례, 성과 수치, 고객 추천
- 가격/플랜: 가격 체계, 플랜별 기능 비교
- 도입 안내: 도입 절차, 무료 체험, 문의 방법

섹션은 7-10개, 이미지는 4-6개로 구성하세요. 제품의 기능적 장점과 고객 혜택을 명확히 전달하세요.

${PLANNING_JSON_FORMAT}`,

  custom: `당신은 전문 기획안 작성자입니다. 사용자의 기획 브리프를 받아 Google 검색을 활용하여 주제를 조사하고, 전문적인 기획안 문서의 구조를 설계하세요.

사용자가 제공한 기획 내용을 최대한 그대로 반영하되, 부족한 부분은 Google 검색으로 보완하세요.
사용자가 지정한 구성, 순서, 강조 포인트를 우선적으로 따르고, 추가 조사 결과로 내용을 풍부하게 만드세요.

섹션은 5-8개, 이미지는 3-6개로 구성하세요.

${PLANNING_JSON_FORMAT}`,
};

const PLANNING_RESEARCH_PROMPT = TEMPLATE_PROMPTS.custom;

const PLANNING_COMPOSE_PROMPT = `당신은 전문적인 HTML 기획안 문서를 작성하는 전문가입니다.

주어진 구조화된 기획안 계획과 이미지 플레이스홀더를 사용하여 완성된 HTML 문서를 생성하세요.

규칙:
- 완전한 HTML 문서를 출력하세요 (<!DOCTYPE html>부터 </html>까지)
- Tailwind CSS CDN을 포함하세요: <script src="https://cdn.tailwindcss.com"><\\/script>
- 한국어 폰트: <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
- body에 font-family: 'Noto Sans KR', sans-serif를 적용하세요
- 전문적이고 깔끔한 기획안 문서 디자인을 적용하세요:
  - 표지/헤더 섹션 (제목, 날짜, 기획 의도)
  - 목차
  - 각 섹션은 명확한 시각적 구분 (배경색, 구분선 등)
  - 데이터는 표(table) 또는 리스트로 정리
  - 적절한 여백과 타이포그래피
  - 인용/출처 표시
- 이미지 플레이스홀더({{IMAGE_1}}, {{IMAGE_2}} 등)를 적절한 위치에 배치하세요:
  - 배경 이미지: style="background-image: url({{IMAGE_1}}); background-size: cover;" 형태
  - 삽화/아이콘 이미지: <img src="{{IMAGE_1}}" class="..." alt="..."> 형태
- 이미지 크기는 문서 레이아웃에 맞게 Tailwind 클래스로 조정하세요
- 외부 이미지 URL을 절대 사용하지 마세요 (플레이스홀더만 사용)
- A4 또는 웹 문서에 적합한 너비(max-width: 1024px)로 설계하세요
- 수정된 전체 HTML 문서만 출력하세요. 다른 설명 텍스트 없이.`;

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
            { text: systemPrompt },
            { text: `기획 브리프:\n\n${brief}` },
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

  const userText = `기획안 구조:\n\n${planText}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n위 구조에 따라 전문적인 HTML 기획안 문서를 작성하세요.`;

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
  const res = await fetch(FLASH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: VIEWPORT_FIX_PROMPT },
            { text: `수정할 슬라이드 HTML:\n\n${slideHtml}` },
            { inlineData: { mimeType: 'image/png', data: imageBase64 } },
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
