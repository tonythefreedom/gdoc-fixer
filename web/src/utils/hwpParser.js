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

    return wrapInHtmlTemplate(cleanBody, cleanStyles);
  } finally {
    document.body.removeChild(container);
  }
}
