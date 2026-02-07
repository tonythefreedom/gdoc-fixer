/**
 * HWP → HTML 변환 유틸리티
 * hwp.js의 Viewer를 오프스크린 DOM에 렌더링하고 innerHTML을 추출합니다.
 */

const HWP_FONT_MAP = [
  ['한컴바탕', "'Noto Sans KR', sans-serif"],
  ['한컴돋움', "'Noto Sans KR', sans-serif"],
  ['HY신명조', "'Noto Sans KR', sans-serif"],
  ['HY중고딕', "'Noto Sans KR', sans-serif"],
  ['HYGoThic-Medium', "'Noto Sans KR', sans-serif"],
  ['HYSinMyeongJo-Medium', "'Noto Sans KR', sans-serif"],
  ['함초롬돋움', "'Noto Sans KR', sans-serif"],
  ['함초롬바탕', "'Noto Sans KR', sans-serif"],
  ['바탕', "'Noto Sans KR', sans-serif"],
  ['돋움', "'Noto Sans KR', sans-serif"],
  ['굴림', "'Noto Sans KR', sans-serif"],
  ['궁서', "'Noto Sans KR', sans-serif"],
];

function replaceHwpFonts(html) {
  let result = html;
  for (const [hwpFont, webFont] of HWP_FONT_MAP) {
    result = result.replaceAll(hwpFont, webFont);
  }
  return result;
}

/**
 * hwp.js가 렌더링한 <img> 중 blob: URL을 canvas로 캡처하여 base64 data URI로 변환
 */
function inlineImages(container) {
  const imgs = container.querySelectorAll('img');
  const promises = Array.from(imgs).map((img) => {
    const src = img.getAttribute('src') || '';
    // blob: URL 또는 상대경로(hwp.js 내부 생성) → base64로 변환
    if (!src.startsWith('data:')) {
      return new Promise((resolve) => {
        const cvs = document.createElement('canvas');
        const onLoad = () => {
          try {
            cvs.width = img.naturalWidth || img.width || 200;
            cvs.height = img.naturalHeight || img.height || 200;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(img, 0, 0);
            img.src = cvs.toDataURL('image/png');
          } catch {
            // CORS 등으로 실패 시 원본 유지
          }
          resolve();
        };
        if (img.complete && img.naturalWidth > 0) {
          onLoad();
        } else {
          img.onload = onLoad;
          img.onerror = resolve;
        }
      });
    }
    return Promise.resolve();
  });
  return Promise.all(promises);
}

/**
 * 배경 이미지(background-image: url(...))를 캡처하여 base64 인라인으로 변환
 */
function inlineBackgroundImages(container) {
  const allElements = container.querySelectorAll('*');
  const promises = Array.from(allElements).map((el) => {
    const bg = el.style.backgroundImage || '';
    const match = bg.match(/url\(["']?(blob:[^"')]+|(?!data:)[^"')]+)["']?\)/);
    if (!match) return Promise.resolve();

    const url = match[1];
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cvs = document.createElement('canvas');
          cvs.width = img.naturalWidth || 200;
          cvs.height = img.naturalHeight || 200;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUri = cvs.toDataURL('image/png');
          el.style.backgroundImage = `url(${dataUri})`;
        } catch {
          // 실패 시 원본 유지
        }
        resolve();
      };
      img.onerror = resolve;
      img.src = url;
    });
  });
  return Promise.all(promises);
}

/**
 * 어두운 배경색 → 흰색, 밝은 텍스트 → 어두운 색으로 보정
 * hwp.js가 검정 배경 + 흰색 텍스트로 렌더링하는 경우 대응
 */
function fixColors(html) {
  const replacements = [
    // ── 어두운 배경색 → 흰색 ──
    // background-color: black / #000 / #000000 / rgb(0,0,0)
    [/background-color\s*:\s*black\b/gi, 'background-color: #ffffff'],
    [/background-color\s*:\s*#000\b(?![\da-f])/gi, 'background-color: #ffffff'],
    [/background-color\s*:\s*#000000\b/gi, 'background-color: #ffffff'],
    [/background-color\s*:\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, 'background-color: #ffffff'],
    // 매우 어두운 배경 (rgb 0~30 범위)
    [/background-color\s*:\s*rgb\(\s*([0-2]?\d)\s*,\s*([0-2]?\d)\s*,\s*([0-2]?\d)\s*\)/gi, 'background-color: #ffffff'],
    // #000~#1f1f1f 범위
    [/background-color\s*:\s*#([0-1][0-9a-f])([0-1][0-9a-f])([0-1][0-9a-f])\b/gi, 'background-color: #ffffff'],
    // background 단축형 (color만 있는 경우)
    [/background\s*:\s*black\b/gi, 'background: #ffffff'],
    [/background\s*:\s*#000\b(?![\da-f])/gi, 'background: #ffffff'],
    [/background\s*:\s*#000000\b/gi, 'background: #ffffff'],
    [/background\s*:\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, 'background: #ffffff'],

    // ── 밝은 텍스트 색상 → 어두운 색 ──
    // color: white / #fff / #ffffff
    [/(?<![-\w])color\s*:\s*white\b/gi, 'color: #222'],
    [/(?<![-\w])color\s*:\s*#fff\b(?![\da-f])/gi, 'color: #222'],
    [/(?<![-\w])color\s*:\s*#ffffff\b/gi, 'color: #222'],
    [/(?<![-\w])color\s*:\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'color: #222'],
    // 매우 밝은 회색 (rgb 240~255 범위)
    [/(?<![-\w])color\s*:\s*rgb\(\s*(2[4-5]\d)\s*,\s*(2[4-5]\d)\s*,\s*(2[4-5]\d)\s*\)/gi, 'color: #222'],
    // #eee ~ #fff 범위
    [/(?<![-\w])color\s*:\s*#([e-f])([e-f])([e-f])\b(?![\da-f])/gi, 'color: #222'],
    [/(?<![-\w])color\s*:\s*#([e-f]{2})([e-f]{2})([e-f]{2})\b/gi, 'color: #222'],
  ];

  let result = html;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function wrapInHtmlTemplate(bodyHtml, stylesHtml = '') {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HWP Document</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans KR', sans-serif; padding: 24px; }
    </style>
    ${stylesHtml}
</head>
<body>
    ${bodyHtml}
</body>
</html>`;
}

function readFileAsUint8Array(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(new Error('파일 읽기 실패'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseHwpToHtml(file) {
  const { Viewer: HWPViewer } = await import('hwp.js');

  const data = await readFileAsUint8Array(file);

  // 오프스크린 컨테이너에 렌더링
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;width:800px;';
  document.body.appendChild(container);

  try {
    new HWPViewer(container, data, { type: 'array' });

    // 이미지 로딩 대기 후 base64 인라인 변환
    await inlineImages(container);
    await inlineBackgroundImages(container);

    // style 태그 추출
    const styles = container.querySelectorAll('style');
    const stylesHtml = Array.from(styles)
      .map((s) => s.outerHTML)
      .join('\n');

    // style 태그를 제외한 본문 추출
    styles.forEach((s) => s.remove());
    const bodyHtml = container.innerHTML;

    if (!bodyHtml.trim()) {
      throw new Error('HWP 파일에서 내용을 추출하지 못했습니다.');
    }

    // HWP 전용 폰트를 웹 폰트로 교체
    const cleanBody = replaceHwpFonts(bodyHtml);
    const cleanStyles = replaceHwpFonts(stylesHtml);

    // 색상 보정: 어두운 배경 → 흰색, 밝은 텍스트 → 어두운 색
    const fixedBody = fixColors(cleanBody);
    const fixedStyles = fixColors(cleanStyles);

    return wrapInHtmlTemplate(fixedBody, fixedStyles);
  } finally {
    document.body.removeChild(container);
  }
}
