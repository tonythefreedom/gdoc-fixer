const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;

const SLIDE_DELIMITER = '<!--SLIDE_BREAK-->';

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
- 절대로 외부 이미지(img src)를 사용하지 마세요. 이미지 대신 CSS로 도형이나 아이콘을 표현하세요
- 외부 리소스(이미지, 폰트 CDN 등)를 절대 참조하지 마세요

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
- 절대로 외부 이미지(img src)를 사용하지 마세요
- 외부 리소스(이미지, 폰트 CDN 등)를 절대 참조하지 마세요
- 수정된 슬라이드 HTML만 출력하세요. 다른 설명 텍스트는 없이 HTML만 출력하세요.`;

function stripCodeFences(text) {
  let html = text.trim();
  if (html.startsWith('```')) {
    html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
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

  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini 응답 중단: ${candidate.finishReason}`);
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini API 응답에 텍스트가 없습니다.');
  }

  return text;
}

export async function convertHtmlToSlides(html) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetch(API_URL, {
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

export async function modifySlideHtml(currentSlideHtml, instruction) {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: MODIFY_SLIDE_PROMPT },
            { text: `현재 슬라이드 HTML:\n\n${currentSlideHtml}\n\n수정 지시:\n${instruction}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 오류: ${res.status}`);
  }

  const data = await res.json();
  const text = parseGeminiResponse(data);
  const html = stripCodeFences(text);

  if (!html.includes('<div')) {
    throw new Error('유효한 슬라이드 HTML이 반환되지 않았습니다.');
  }

  return html;
}
