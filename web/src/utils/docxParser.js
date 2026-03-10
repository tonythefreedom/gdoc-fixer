import mammoth from 'mammoth';

/**
 * DOCX 파일을 HTML로 변환
 * - mammoth.js로 DOCX → HTML 변환
 * - 이미지는 base64 인라인으로 포함
 * - Tailwind CSS + Noto Sans KR 폰트 적용한 완전한 HTML 문서로 래핑
 */
export async function parseDocxToHtml(file) {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement((image) =>
        image.read('base64').then((imageBuffer) => ({
          src: `data:${image.contentType};base64,${imageBuffer}`,
        }))
      ),
    }
  );

  if (result.messages.length > 0) {
    console.warn('[DOCX] 변환 경고:', result.messages);
  }

  const bodyHtml = result.value;

  if (!bodyHtml || !bodyHtml.trim()) {
    throw new Error('DOCX 파일에서 내용을 추출할 수 없습니다.');
  }

  // 완전한 HTML 문서로 래핑
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Noto Sans KR', sans-serif;
      line-height: 1.8;
      color: #1e293b;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 32px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5em 0 0.5em; color: #0f172a; }
    h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25em 0 0.5em; color: #1e293b; }
    h3 { font-size: 1.25rem; font-weight: 600; margin: 1em 0 0.5em; color: #334155; }
    h4 { font-size: 1.1rem; font-weight: 600; margin: 0.75em 0 0.5em; color: #475569; }
    p { margin: 0.5em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: 600; }
    img { max-width: 100%; height: auto; margin: 1em 0; }
    ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
    li { margin: 0.25em 0; }
    blockquote { border-left: 3px solid #cbd5e1; padding-left: 1em; color: #64748b; margin: 1em 0; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
