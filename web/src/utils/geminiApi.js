const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;
const FLASH_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
const IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;

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

export async function convertHtmlToSlides(html) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `다음 HTML을 프레젠테이션 슬라이드로 변환하세요:\n\n${html}` },
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

  return slides;
}

const MODIFY_ALL_SLIDES_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

여러 슬라이드의 HTML이 ${SLIDE_DELIMITER} 구분자로 구분되어 제공됩니다.
사용자의 수정 지시를 모든 슬라이드에 일관되게 적용하여 수정된 슬라이드들을 반환하세요.

**중요: 슬라이드를 절대 삭제하거나 병합하지 마세요. 입력된 슬라이드 수와 정확히 동일한 수의 슬라이드를 반환해야 합니다.**

규칙:
- **절대로 슬라이드를 삭제하지 마세요** — 입력 N개면 반드시 출력도 N개여야 합니다
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

**중요: 슬라이드를 절대 삭제하거나 병합하지 마세요. 입력된 슬라이드 수와 정확히 동일한 수의 슬라이드를 반환해야 합니다.**

규칙:
- **절대로 슬라이드를 삭제하지 마세요** — 입력 N개면 반드시 출력도 N개여야 합니다
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

// Ensure returned slides match original count — fill missing with originals
function padSlides(result, originals) {
  if (result.length >= originals.length) return result.slice(0, originals.length);
  console.warn(`슬라이드 수 불일치: 원본 ${originals.length}개, 반환 ${result.length}개 — 부족분을 원본으로 보충`);
  return originals.map((orig, i) => result[i] || orig);
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

        const userText = `전체 슬라이드 HTML (${allSlides.length}개, 반드시 ${allSlides.length}개 모두 반환):\n\n${allSlidesHtml}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시 (모든 슬라이드에 적용):\n${instruction}`;
        let html = await callProModel(MODIFY_ALL_WITH_IMAGES_PROMPT, userText);

        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        const slides = html
          .split(SLIDE_DELIMITER)
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.includes('<div'));

        if (slides.length > 0) return padSlides(slides, allSlides);
        throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
      }
    }
  }

  // Text-only modification for all slides
  const userText = `전체 슬라이드 HTML (${allSlides.length}개, 반드시 ${allSlides.length}개 모두 반환):\n\n${allSlidesHtml}\n\n수정 지시 (모든 슬라이드에 적용):\n${instruction}`;
  const html = await callProModel(MODIFY_ALL_SLIDES_PROMPT, userText);

  const slides = html
    .split(SLIDE_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('<div'));

  if (slides.length === 0) {
    throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
  }

  return padSlides(slides, allSlides);
}

export async function modifySlideHtml(currentSlideHtml, instruction) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  // Check if instruction involves image generation
  if (isImageRelated(instruction)) {
    // Extract slide text content for context (strip HTML tags)
    const slideText = currentSlideHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    // Step 1: Analyze instruction → extract image descriptions
    let imageDescriptions = [];
    try {
      imageDescriptions = await extractImagePrompts(instruction, slideText);
    } catch (err) {
      console.warn('이미지 분석 실패:', err.message);
    }

    if (imageDescriptions.length > 0) {
      // Step 2: Generate all images in parallel
      const generatedImages = await generateImages(imageDescriptions);

      if (generatedImages.length > 0) {
        // Step 2.5: Process non-background images → remove background (transparent)
        const processedImages = await processGeneratedImages(generatedImages);

        // Step 3: Tell pro model about available images via placeholders
        const imageInfo = processedImages
          .map((img, i) => `- {{IMAGE_${i + 1}}}: ${img.label}`)
          .join('\n');

        const userText = `현재 슬라이드 HTML:\n\n${currentSlideHtml}\n\n사용 가능한 이미지 플레이스홀더:\n${imageInfo}\n\n수정 지시:\n${instruction}`;
        let html = await callProModel(MODIFY_WITH_IMAGES_PROMPT, userText);

        // Replace placeholders with actual data URIs (transparent-processed where applicable)
        processedImages.forEach((img, i) => {
          const placeholder = `{{IMAGE_${i + 1}}}`;
          html = html.replaceAll(placeholder, img.dataUri);
        });

        if (html.includes('<div')) return html;
        throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
      }
    }
    // Fallback: no images extracted or generated, proceed without images
  }

  // Text-only modification
  const userText = `현재 슬라이드 HTML:\n\n${currentSlideHtml}\n\n수정 지시:\n${instruction}`;
  const html = await callProModel(MODIFY_SLIDE_PROMPT, userText);

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
- 수정된 전체 HTML 문서만 출력하세요. 다른 설명 텍스트 없이 HTML만 출력하세요.`;

export async function modifyDocumentHtml(currentHtml, instruction) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const userText = `현재 HTML 문서:\n\n${currentHtml}\n\n수정 지시:\n${instruction}`;
  const html = await callProModel(MODIFY_DOCUMENT_PROMPT, userText);

  if (!html.includes('<')) {
    throw new Error('유효한 HTML이 반환되지 않았습니다.');
  }

  return html;
}

// ─── Planning: Research + Document Generation with Google Search Grounding ───

const PLANNING_RESEARCH_PROMPT = `당신은 전문 기획안 작성자입니다. 사용자의 기획 브리프를 받아 Google 검색을 활용하여 주제를 조사하고, 전문적인 기획안 문서의 구조를 설계하세요.

반드시 다음 JSON 형식으로만 응답하세요:

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

규칙:
- Google 검색으로 최신 정보, 통계, 트렌드를 조사하세요
- 섹션은 5-8개 정도로 구성하세요
- 이미지는 3-6개 정도 포함하세요
- imageDescriptions의 prompt는 반드시 영문으로 작성하세요
- 배경용 이미지의 label에 "배경"을 포함하고 prompt에 "16:9 aspect ratio, suitable for document header background"를 포함하세요
- 아이콘/로고 이미지의 prompt에 "simple, clean icon design, flat style, white background"를 포함하세요
- 일반 삽화 이미지의 prompt에 "professional illustration, clean style"을 포함하세요
- contentBrief에 조사한 구체적 데이터와 수치를 포함하세요
- JSON만 출력하세요. 다른 텍스트 없이.`;

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

export async function researchAndPlan(brief) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetch(PRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PLANNING_RESEARCH_PROMPT },
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

async function renderSlideToBase64(slideHtml) {
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
      console.log(`뷰포트 픽스 ${i + 1}/${slides.length}...`);
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
