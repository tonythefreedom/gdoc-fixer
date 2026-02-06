const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    const htmlContent = JSON.stringify(data.html || '').replace(/<\//g, '<\\/');

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
  <iframe id="preview" sandbox="allow-scripts allow-same-origin"></iframe>
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
