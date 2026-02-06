function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function extractGoogleFontUrls(html) {
  const urls = [];
  const linkRegex = /href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["']/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  const importRegex = /@import\s+url\(["']?(https:\/\/fonts\.googleapis\.com\/css2[^"')]+)["']?\)/g;
  while ((match = importRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function fetchAndInlineFontCss(fontUrl) {
  try {
    const res = await fetch(fontUrl);
    if (!res.ok) return null;
    let cssText = await res.text();

    const fontFaceUrls = [...cssText.matchAll(/url\((https?:\/\/[^)]+)\)/g)];
    for (const [fullMatch, url] of fontFaceUrls) {
      try {
        const fontRes = await fetch(url);
        if (!fontRes.ok) continue;
        const fontData = await fontRes.arrayBuffer();
        const base64 = arrayBufferToBase64(fontData);
        const mimeType = url.includes('.woff2') ? 'font/woff2' : 'font/woff';
        cssText = cssText.replace(fullMatch, `url(data:${mimeType};base64,${base64})`);
      } catch {
        // skip failed font file
      }
    }
    return cssText;
  } catch {
    return null;
  }
}

export async function inlineExternalResources(html, iframeDoc) {
  // 1. Extract all computed styles from iframe stylesheets
  let inlinedStyles = '';
  if (iframeDoc) {
    try {
      for (const sheet of iframeDoc.styleSheets) {
        try {
          const rules = [...sheet.cssRules].map((r) => r.cssText).join('\n');
          inlinedStyles += rules + '\n';
        } catch {
          // cross-origin sheet - skip
        }
      }
    } catch {
      // no styleSheets access
    }
  }

  // 2. Inline Google Fonts
  const fontUrls = extractGoogleFontUrls(html);
  let fontStyles = '';
  for (const url of fontUrls) {
    const css = await fetchAndInlineFontCss(url);
    if (css) fontStyles += css + '\n';
  }

  // 3. Get the rendered HTML (post-Tailwind, post-Lucide)
  let processedHtml = iframeDoc
    ? iframeDoc.documentElement.outerHTML
    : html;

  // 4. Remove external scripts (Tailwind CDN, Lucide) since styles are already computed
  processedHtml = processedHtml.replace(
    /<script[^>]*src=["']https:\/\/cdn\.tailwindcss\.com[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  processedHtml = processedHtml.replace(
    /<script[^>]*src=["']https:\/\/unpkg\.com\/lucide[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );

  // 5. Remove lucide.createIcons() calls
  processedHtml = processedHtml.replace(
    /<script>\s*lucide\.createIcons\(\);\s*<\/script>/gi,
    ''
  );

  // 6. Remove Google Fonts link tags (we'll inline them)
  processedHtml = processedHtml.replace(
    /<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*\/?>/gi,
    ''
  );

  // 7. Inject inlined styles before </head>
  const styleBlock = `<style data-inlined="true">
${inlinedStyles}
${fontStyles}
</style>`;

  processedHtml = processedHtml.replace('</head>', `${styleBlock}\n</head>`);

  return processedHtml;
}
