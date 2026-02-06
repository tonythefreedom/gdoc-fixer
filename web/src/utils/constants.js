export const DEFAULT_VIEWPORT_WIDTH = 1080;
export const DEFAULT_VIEWPORT_HEIGHT = 1080;

export const MIN_VIEWPORT = 320;
export const MAX_VIEWPORT = 4096;

export const SIZE_STEP_SMALL = 10;
export const SIZE_STEP_LARGE = 100;

export const VIEWPORT_PRESETS = [
  { label: '1080x1080', w: 1080, h: 1080 },
  { label: '1024x768', w: 1024, h: 768 },
  { label: '1024x900', w: 1024, h: 900 },
  { label: '1920x1080', w: 1920, h: 1080 },
  { label: '1080x1920', w: 1080, h: 1920 },
  { label: '800x600', w: 800, h: 600 },
];

export const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Document</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Noto Sans KR', sans-serif; }
    </style>
</head>
<body class="p-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-4">Hello World</h1>
    <p class="text-slate-600">HTML/CSS를 붙여넣으세요.</p>
</body>
</html>`;
