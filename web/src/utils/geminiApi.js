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
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;..."> 형태여야 합니다
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
<div style="width:1280px;height:720px;...">슬라이드1</div>
${SLIDE_DELIMITER}
<div style="width:1280px;height:720px;...">슬라이드2</div>`;

const MODIFY_SLIDE_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

주어진 슬라이드 HTML과 사용자의 수정 지시를 받아 수정된 슬라이드 HTML을 반환하세요.

규칙:
- 기존 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;..."> 형태를 유지하세요
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
- 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;..."> 형태를 유지하세요
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
async function generateImages(imageDescriptions) {
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

async function processGeneratedImages(images) {
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

규칙:
- 각 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;..."> 형태를 유지하세요
- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 외부 이미지 URL(http/https)을 절대 사용하지 마세요
- 이미 슬라이드에 포함된 data URI 이미지는 그대로 유지하세요
- 외부 리소스(폰트 CDN 등)를 절대 참조하지 마세요
- 모든 슬라이드에 수정 지시를 일관되게 적용하세요 (예: 배경색 변경이면 모든 슬라이드 배경색 변경)
- 수정된 슬라이드 HTML들을 ${SLIDE_DELIMITER} 구분자로 구분하여 출력하세요
- 입력된 슬라이드 수와 동일한 수의 슬라이드를 반환해야 합니다
- 다른 설명 텍스트 없이 슬라이드 HTML만 출력하세요.`;

const MODIFY_ALL_WITH_IMAGES_PROMPT = `당신은 HTML 프레젠테이션 슬라이드를 수정하는 전문가입니다.

여러 슬라이드의 HTML이 ${SLIDE_DELIMITER} 구분자로 구분되어 제공됩니다.
사용자의 수정 지시를 모든 슬라이드에 일관되게 적용하여 수정된 슬라이드들을 반환하세요.
생성된 이미지들이 플레이스홀더로 제공됩니다. 이미지를 배치할 위치에 해당 플레이스홀더를 사용하세요.

규칙:
- 각 슬라이드의 크기(width:1280px, height:720px)를 유지하세요
- 반드시 인라인 CSS만 사용하세요
- 각 슬라이드의 루트 요소는 <div style="width:1280px;height:720px;overflow:hidden;..."> 형태를 유지하세요
- 한국어 폰트: font-family에 'Noto Sans KR', sans-serif를 사용하세요
- 이미지 플레이스홀더({{IMAGE_1}}, {{IMAGE_2}} 등)를 적절한 위치에 배치하세요:
  - 배경 이미지: background-image: url({{IMAGE_1}}) 형태로 사용
  - 일반 이미지: <img src="{{IMAGE_1}}" style="..."> 형태로 사용
- 이미지 크기와 위치를 슬라이드 레이아웃에 맞게 조정하세요
- 이미 슬라이드에 포함된 기존 data URI 이미지는 그대로 유지하세요
- 외부 리소스를 절대 참조하지 마세요
- 모든 슬라이드에 수정 지시를 일관되게 적용하세요
- 수정된 슬라이드 HTML들을 ${SLIDE_DELIMITER} 구분자로 구분하여 출력하세요
- 입력된 슬라이드 수와 동일한 수의 슬라이드를 반환해야 합니다
- 다른 설명 텍스트 없이 슬라이드 HTML만 출력하세요.`;

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

        if (slides.length > 0) return slides;
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

  return slides;
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
