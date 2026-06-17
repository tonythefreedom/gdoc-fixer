const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.publishToTechBlog = require('./publishToTechBlog').publishToTechBlog;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// LaTeX 수식이 있는 HTML 에 MathJax 로더를 자동 주입.
// 클라이언트의 src/utils/injectMathJax.js 와 같은 로직 (server-side 사본).
const MATHJAX_SNIPPET = `
<style>
  mjx-container { display: inline-block !important; vertical-align: middle; line-height: normal; }
  mjx-container[display="true"] { display: block !important; margin: 1em 0 !important; text-align: center; }
  mjx-container svg { display: inline-block; vertical-align: middle; }
</style>
<script>
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
      displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
      processEscapes: true,
      packages: {'[+]': ['base', 'ams', 'noerrors', 'noundefined']}
    },
    svg: { fontCache: 'global' },
    options: { renderActions: { addMenu: [] } }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js" async></script>
`;

function normalizeLatexEscapes(html) {
  return html
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) =>
      '$$' + inner.replace(/\\\\/g, '\\') + '$$'
    )
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) =>
      '\\(' + inner.replace(/\\\\/g, '\\') + '\\)'
    )
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) =>
      '\\[' + inner.replace(/\\\\/g, '\\') + '\\]'
    )
    .replace(/\$([^\$\n<>]*?\\\\?[a-zA-Z]+[^\$\n<>]*?)\$/g, (_, inner) =>
      '$' + inner.replace(/\\\\/g, '\\') + '$'
    );
}

function injectMathJax(html) {
  if (!html || typeof html !== 'string') return html;
  const hasLatex =
    /\$\$[\s\S]+?\$\$/.test(html) ||
    /\\\([\s\S]+?\\\)/.test(html) ||
    /\\\[[\s\S]+?\\\]/.test(html);
  if (!hasLatex) return html;
  let out = normalizeLatexEscapes(html);
  if (/mathjax|tex-svg\.js|tex-chtml\.js|tex-mml/i.test(out)) return out;
  const headClose = out.search(/<\/head\s*>/i);
  if (headClose !== -1) {
    return out.slice(0, headClose) + MATHJAX_SNIPPET + out.slice(headClose);
  }
  const bodyOpen = out.search(/<body[^>]*>/i);
  if (bodyOpen !== -1) {
    const insertAt = out.indexOf('>', bodyOpen) + 1;
    return out.slice(0, insertAt) + MATHJAX_SNIPPET + out.slice(insertAt);
  }
  return MATHJAX_SNIPPET + out;
}

exports.shareOg = onRequest(async (req, res) => {
  // Extract share ID from path: /share/ABC12345
  const match = req.path.match(/\/share\/([A-Za-z0-9]{8})$/);
  if (!match) {
    res.status(404).send('Not found');
    return;
  }

  const shareId = match[1];

  try {
    const snap = await db.collection('shared').doc(shareId).get();
    if (!snap.exists) {
      res.status(404).send('Not found');
      return;
    }

    const data = snap.data();
    const name = data.name || '공유된 HTML 문서';
    const textContent = (data.html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    const ogUrl = `https://gdoc-fixer.web.app/share/${shareId}`;
    const ogImage = 'https://gdoc-fixer.web.app/icon.png';
    const htmlContent = JSON.stringify(injectMathJax(data.html || '')).replace(/<\//g, '<\\/');

    const page = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(name)} - GDoc Fixer</title>
  <meta property="og:title" content="${escapeHtml(name)}">
  <meta property="og:description" content="${escapeHtml(textContent)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,'Noto Sans KR',sans-serif;background:#0f172a}
    .header{background:rgba(15,23,42,0.95);backdrop-filter:blur(8px);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.1)}
    .header .title{color:rgba(255,255,255,0.7);font-size:12px}
    .header a{color:#818cf8;font-size:12px;text-decoration:none;padding:4px 12px;border:1px solid rgba(129,140,248,0.3);border-radius:6px}
    .header a:hover{background:rgba(129,140,248,0.1)}
    iframe{width:100%;height:calc(100vh - 41px);border:none;background:#fff}
  </style>
</head>
<body>
  <div class="header">
    <span class="title">${escapeHtml(name)}</span>
    <a href="https://gdoc-fixer.web.app">에디터로 열기</a>
  </div>
  <iframe id="preview" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
  <script>document.getElementById('preview').srcdoc=${htmlContent};</script>
</body>
</html>`;

    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(page);
  } catch (err) {
    console.error('shareOg error:', err);
    res.status(500).send('Internal error');
  }
});

// OG 메타만 필요한 unfurl 봇 user-agent 만 매칭. KAKAOTALK 전체를 잡으면
// 카카오톡 in-app 브라우저로 링크를 여는 일반 사용자까지 봇 페이지를 보게 되어
// 슬라이드뷰어가 안 뜬다. 카카오톡 OG fetch 봇은 'kakaotalk-scrap' 토큰 사용.
function isSocialBot(userAgent = '') {
  return /kakaotalk-scrap|Slackbot|facebookexternalhit|Twitterbot|Discordbot|TelegramBot|LinkedInBot|WhatsApp|SkypeUriPreview|Embedly|Googlebot|bingbot|ChatGPT|GPTBot|Perplexity/i.test(userAgent);
}

// 슬라이드 HTML 에서 외부에서 접근 가능한 첫 이미지 URL 추출.
// <img src="...">, background-image:url(...), <source src="..."> 등.
// http(s) 이고 SVG / data URI 가 아닌 이미지여야 카카오톡 unfurl 이 표시.
function extractFirstImageUrl(slides) {
  if (!Array.isArray(slides)) return null;
  const patterns = [
    /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
    /<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i,
    /background(?:-image)?\s*:\s*[^;}"']*url\(\s*["']?([^"')]+)["']?\s*\)/i,
  ];
  const isUsable = (url) => {
    if (!url) return false;
    if (!/^https?:\/\//i.test(url)) return false;
    // SVG 는 OG 봇이 보통 거부, 데이터 URI 는 외부 노출 불가
    if (/\.svg(\?|#|$)/i.test(url)) return false;
    if (/img\.youtube\.com\/vi\/[^/]+\/maxresdefault\.jpg/i.test(url)) {
      // YouTube maxresdefault 는 404 가능 → hqdefault 로 안전화
      return true;
    }
    return true;
  };
  for (const slide of slides) {
    if (typeof slide !== 'string') continue;
    for (const re of patterns) {
      const m = slide.match(re);
      if (m && isUsable(m[1])) {
        let url = m[1];
        // maxresdefault 가 잡혔으면 hqdefault 로 fallback (항상 존재)
        url = url.replace(
          /(img\.youtube\.com\/vi\/[^/]+\/)maxresdefault\.jpg/i,
          '$1hqdefault.jpg'
        );
        return url;
      }
    }
  }
  return null;
}

// 공유 프리젠테이션(/p/:id) — 카카오톡/슬랙 unfurl 용 OG 메타 + SPA hydrate
exports.presentationOg = onRequest(async (req, res) => {
  const match = req.path.match(/\/p\/([A-Za-z0-9]{8})$/);
  if (!match) {
    res.status(404).send('Not found');
    return;
  }
  const shareId = match[1];

  try {
    const snap = await db.collection('presentations-shared').doc(shareId).get();
    if (!snap.exists) {
      res.status(404).send('Not found');
      return;
    }
    const data = snap.data();
    const name = data.name || '공유된 프리젠테이션';
    const slideCount = Array.isArray(data.slides) ? data.slides.length : 0;
    const firstSlideText = (Array.isArray(data.slides) && data.slides[0] ? data.slides[0] : '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);
    const description = firstSlideText
      ? `${firstSlideText}${firstSlideText.length >= 180 ? '…' : ''}`
      : `슬라이드 ${slideCount}장 · GDoc Fixer 로 만든 공유 프리젠테이션`;

    const ogUrl = `https://gdoc-fixer.web.app/p/${shareId}`;
    // 프리젠테이션에서 첫 이미지를 추출해 OG 썸네일로 사용. 없으면 앱 아이콘.
    const extractedImage = extractFirstImageUrl(data.slides);
    const ogImage = extractedImage || 'https://gdoc-fixer.web.app/icon.png';
    const userAgent = req.get('user-agent') || '';

    const ogHeadTags = `
  <title>${escapeHtml(name)} · 공유 프리젠테이션</title>
  <meta property="og:title" content="${escapeHtml(name)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:url" content="${ogUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="GDoc Fixer">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(name)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="description" content="${escapeHtml(description)}">`.trim();

    // 봇이면 OG 만 들어간 가벼운 페이지 (실제 SPA 다운로드 불필요)
    if (isSocialBot(userAgent)) {
      const botPage = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${ogHeadTags}
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${ogUrl}">슬라이드 뷰어로 열기</a></p>
</body>
</html>`;
      res.set('Cache-Control', 'public, max-age=300');
      res.status(200).send(botPage);
      return;
    }

    // 일반 사용자: SPA index.html 에 OG 메타 inject 후 그대로 응답.
    // chunk hash 가 매 빌드마다 바뀌므로 hosting 의 최신 index.html 을 fetch.
    let spaHtml;
    try {
      const indexRes = await fetch('https://gdoc-fixer.web.app/index.html', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      spaHtml = await indexRes.text();
    } catch (e) {
      console.error('SPA index.html fetch 실패:', e);
      res.redirect(302, ogUrl); // 폴백: 라우트 그대로 (실제로는 같은 path 라 무한 루프 위험 → 그냥 OG 페이지 반환)
      return;
    }

    // <head> 안에 OG 메타 inject (기본 <title> 은 OG title 로 대체)
    const injected = spaHtml
      .replace(/<title>[^<]*<\/title>/i, '')
      .replace(/<head>/i, `<head>${ogHeadTags}`);

    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(injected);
  } catch (err) {
    console.error('presentationOg error:', err);
    res.status(500).send('Internal error');
  }
});
