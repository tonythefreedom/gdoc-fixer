/**
 * HTML → DOCX 변환 전처리
 * 1단계: 이미지 URL → base64 인라인화 (메인 컨텍스트, CORS 가능)
 * 2단계: background-image CSS → <img> 태그 변환
 * 3단계: 이미지를 플레이스홀더로 교체 (iframe 보호)
 * 4단계: iframe 렌더링으로 Tailwind → 인라인 스타일 + flex→table 변환
 * 5단계: 플레이스홀더를 원본 이미지로 복원
 */

// ─── 1단계: 이미지 URL을 모두 base64로 변환 (iframe 전) ───

async function fetchAsBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(res.status);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function convertAllImagesToBase64(html) {
  const srcRegex = /(<img\s[^>]*?src=["'])(https?:\/\/[^"']+)(["'])/gi;
  const bgRegex = /(url\(["']?)(https?:\/\/[^"')]+)(["']?\))/gi;

  const urls = new Set();
  let m;
  while ((m = srcRegex.exec(html)) !== null) urls.add(m[2]);
  while ((m = bgRegex.exec(html)) !== null) urls.add(m[2]);

  if (urls.size === 0) return html;

  const urlMap = new Map();
  await Promise.all(
    [...urls].map(async (url) => {
      const base64 = await fetchAsBase64(url);
      if (base64) urlMap.set(url, base64);
    })
  );

  let result = html;
  for (const [url, base64] of urlMap) {
    result = result.replaceAll(url, base64);
  }

  return result;
}

// ─── 2단계: background-image CSS를 <img> 태그로 변환 ───

function insertImgForBackgrounds(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const match = style.match(/background-image:\s*url\(["']?(data:[^"')]+|https?:[^"')]+)["']?\)/i);
    if (!match) return;

    const imgUrl = match[1];

    const cleanStyle = style
      .replace(/background-image:\s*url\([^)]+\);?\s*/gi, '')
      .replace(/background-size:\s*[^;]+;?\s*/gi, '')
      .replace(/background-position:\s*[^;]+;?\s*/gi, '')
      .replace(/background-repeat:\s*[^;]+;?\s*/gi, '');
    el.setAttribute('style', cleanStyle);

    const img = doc.createElement('img');
    img.setAttribute('src', imgUrl);
    img.setAttribute('style', 'width: 100%; height: auto; display: block;');
    img.setAttribute('alt', '');
    el.insertBefore(img, el.firstChild);
  });

  return doc.documentElement.outerHTML;
}

// ─── 3단계: 이미지 src를 플레이스홀더로 교체 (iframe 손상 방지) ───

const PLACEHOLDER_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function extractAndReplaceImages(html) {
  const imageMap = new Map();
  let counter = 0;

  const result = html.replace(
    /(<img\s[^>]*?)src=(["'])(data:[^"']+|https?:\/\/[^"']+)\2/gi,
    (match, before, quote, src) => {
      const id = `__DOCX_IMG_${counter++}__`;
      imageMap.set(id, src);
      return `${before}data-docx-id="${id}" src=${quote}${PLACEHOLDER_GIF}${quote}`;
    }
  );

  return { html: result, imageMap };
}

function restoreImages(html, imageMap) {
  let result = html;

  for (const [id, originalSrc] of imageMap) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imgTagRegex = new RegExp(
      `(<img\\s[^>]*?)data-docx-id="${escapedId}"([^>]*?)>`,
      'gi'
    );

    result = result.replace(imgTagRegex, (match, before, after) => {
      const escapedPlaceholder = PLACEHOLDER_GIF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const srcRegex = new RegExp(`src=["']${escapedPlaceholder}["']`, 'i');

      const fullTag = before + after;
      if (srcRegex.test(fullTag)) {
        return fullTag.replace(srcRegex, `src="${originalSrc}"`) + '>';
      }
      return `${before}src="${originalSrc}"${after}>`;
    });
  }

  result = result.replace(/\s*data-docx-id="[^"]*"/g, '');
  return result;
}

// ─── 4단계: iframe에서 Tailwind → 인라인 스타일 + 레이아웃 변환 ───

// html-to-docx가 지원하는 CSS 속성만 추출
const STYLE_PROPS = [
  'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontStyle',
  'fontFamily', 'textAlign', 'textDecoration', 'lineHeight', 'letterSpacing',
  'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'borderTopStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderRightStyle',
  'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
  'width', 'maxWidth', 'minHeight',
  'verticalAlign', 'textIndent',
];

function toKebab(prop) {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

const SKIP_VALUES = new Set([
  'rgba(0, 0, 0, 0)', 'transparent', 'none', 'normal', 'start',
  '0px', 'auto', 'medium', 'rgb(0, 0, 0)',
]);

function inlineStylesFromComputed(el, win) {
  const computed = win.getComputedStyle(el);
  const parts = [];

  for (const prop of STYLE_PROPS) {
    const val = computed[prop];
    if (!val || SKIP_VALUES.has(val)) continue;
    if (prop === 'fontSize' && val === '16px') continue;
    if (prop === 'fontWeight' && (val === '400' || val === 'normal')) continue;
    if (prop === 'lineHeight' && val === 'normal') continue;
    if (prop === 'textAlign' && val === 'start') continue;

    parts.push(`${toKebab(prop)}: ${val}`);
  }

  return parts.join('; ');
}

/**
 * 컬러 관련 스타일만 추출 (table/td에 사용)
 */
function extractColorStyles(computed) {
  const parts = [];
  const bg = computed.backgroundColor;
  if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
    parts.push(`background-color: ${bg}`);
  }
  const color = computed.color;
  if (color && color !== 'rgb(0, 0, 0)') {
    parts.push(`color: ${color}`);
  }
  return parts.join('; ');
}

/**
 * flex 컨테이너를 table 구조로 변환 (html-to-docx 호환)
 * display: flex인 요소 → <table><tr><td>...</td></tr></table>
 */
function convertFlexToTable(el, win, doc) {
  const computed = win.getComputedStyle(el);
  const display = computed.display;

  if (display !== 'flex' && display !== 'inline-flex') return false;

  const flexDir = computed.flexDirection || 'row';
  const isRow = flexDir === 'row' || flexDir === 'row-reverse';
  const gap = parseInt(computed.gap) || parseInt(computed.columnGap) || 0;
  const children = Array.from(el.children);

  if (children.length === 0) return false;

  // flex 컨테이너의 배경색/색상 보존
  const containerStyles = extractColorStyles(computed);
  const containerWidth = computed.width;

  const containerPxVal = parseInt(containerWidth) || 800;
  const table = doc.createElement('table');
  let tableStyle = `border-collapse: collapse; width: ${containerPxVal}px;`;
  if (containerStyles) tableStyle += `; ${containerStyles}`;
  table.setAttribute('style', tableStyle);

  if (isRow) {
    // 가로 배치: 한 행에 여러 열
    const tr = doc.createElement('tr');

    children.forEach((child, i) => {
      const td = doc.createElement('td');
      const childComputed = win.getComputedStyle(child);

      // td 스타일: 너비, 정렬, 배경, 패딩 (border longhand — html-to-docx는 shorthand 미지원)
      const tdParts = ['vertical-align: top', 'border-top-style: none', 'border-right-style: none', 'border-bottom-style: none', 'border-left-style: none'];

      // 자식 너비 계산
      const childWidth = childComputed.width;
      const flexBasis = childComputed.flexBasis;
      const flexGrow = childComputed.flexGrow;
      if (flexBasis && flexBasis !== 'auto' && flexBasis !== '0px') {
        tdParts.push(`width: ${flexBasis}`);
      } else if (childWidth && childWidth !== 'auto') {
        tdParts.push(`width: ${childWidth}`);
      } else if (flexGrow && flexGrow !== '0') {
        // 동일 비율로 분배 (html-to-docx는 %를 미지원 → px로 변환)
        const containerPx = parseInt(containerWidth) || 800;
        const cellPx = Math.round(containerPx / children.length);
        tdParts.push(`width: ${cellPx}px`);
      }

      // 패딩/간격
      if (gap > 0 && i < children.length - 1) {
        tdParts.push(`padding-right: ${gap}px`);
      }

      // 자식 배경/색상
      const childColors = extractColorStyles(childComputed);
      if (childColors) tdParts.push(childColors);

      // 텍스트 정렬
      const textAlign = childComputed.textAlign;
      if (textAlign && textAlign !== 'start' && textAlign !== 'left') {
        tdParts.push(`text-align: ${textAlign}`);
      }

      td.setAttribute('style', tdParts.join('; '));

      // 자식의 내부 컨텐츠를 td로 이동 (void 요소는 자체를 이동)
      if (child.firstChild) {
        while (child.firstChild) {
          td.appendChild(child.firstChild);
        }
      } else {
        td.appendChild(child);
      }

      tr.appendChild(td);
    });

    table.appendChild(tr);
  } else {
    // 세로 배치: 각 자식이 한 행
    children.forEach((child, i) => {
      const tr = doc.createElement('tr');
      const td = doc.createElement('td');
      const childComputed = win.getComputedStyle(child);

      const containerPx = parseInt(containerWidth) || 800;
      const tdParts = ['border-top-style: none', 'border-right-style: none', 'border-bottom-style: none', 'border-left-style: none', `width: ${containerPx}px`];

      if (gap > 0 && i < children.length - 1) {
        tdParts.push(`padding-bottom: ${gap}px`);
      }

      const childColors = extractColorStyles(childComputed);
      if (childColors) tdParts.push(childColors);

      td.setAttribute('style', tdParts.join('; '));

      if (child.firstChild) {
        while (child.firstChild) {
          td.appendChild(child.firstChild);
        }
      } else {
        td.appendChild(child);
      }

      tr.appendChild(td);
      table.appendChild(tr);
    });
  }

  // 원래 요소를 table로 교체
  el.parentNode.replaceChild(table, el);
  return true;
}

/**
 * grid 컨테이너를 table 구조로 변환
 */
function convertGridToTable(el, win, doc) {
  const computed = win.getComputedStyle(el);
  if (computed.display !== 'grid' && computed.display !== 'inline-grid') return false;

  const columns = computed.gridTemplateColumns;
  const gap = parseInt(computed.gap) || parseInt(computed.rowGap) || 0;
  const children = Array.from(el.children);

  if (children.length === 0) return false;

  // 열 수 추정
  const colCount = columns ? columns.split(/\s+/).length : 1;
  const containerStyles = extractColorStyles(computed);

  const containerPxVal = parseInt(computed.width) || 800;
  const table = doc.createElement('table');
  let tableStyle = `border-collapse: collapse; width: ${containerPxVal}px;`;
  if (containerStyles) tableStyle += `; ${containerStyles}`;
  table.setAttribute('style', tableStyle);

  // 자식을 열 수에 맞게 행으로 배분
  for (let i = 0; i < children.length; i += colCount) {
    const tr = doc.createElement('tr');
    for (let j = 0; j < colCount && i + j < children.length; j++) {
      const child = children[i + j];
      const td = doc.createElement('td');
      const childComputed = win.getComputedStyle(child);

      const containerPx = parseInt(computed.width) || 800;
      const cellPx = Math.round(containerPx / colCount);
      const tdParts = [`width: ${cellPx}px`, 'vertical-align: top', 'border-top-style: none', 'border-right-style: none', 'border-bottom-style: none', 'border-left-style: none'];

      if (gap > 0) {
        tdParts.push(`padding: ${Math.round(gap / 2)}px`);
      }

      const childColors = extractColorStyles(childComputed);
      if (childColors) tdParts.push(childColors);

      td.setAttribute('style', tdParts.join('; '));

      if (child.firstChild) {
        while (child.firstChild) {
          td.appendChild(child.firstChild);
        }
      } else {
        td.appendChild(child);
      }

      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  el.parentNode.replaceChild(table, el);
  return true;
}

/**
 * DOM 순회: flex/grid → table 변환 후 인라인 스타일 적용
 * 변환은 잎(leaf) 노드부터 상위로 진행 (bottom-up)
 */
function walkAndConvertLayout(el, win, doc) {
  if (el.nodeType !== 1) return;

  // 먼저 자식들을 처리 (bottom-up)
  const childrenSnapshot = Array.from(el.children);
  for (const child of childrenSnapshot) {
    walkAndConvertLayout(child, win, doc);
  }

  // flex/grid 변환 시도
  if (convertFlexToTable(el, win, doc)) return;
  if (convertGridToTable(el, win, doc)) return;

  // 일반 요소: 인라인 스타일 적용
  const tag = el.tagName.toLowerCase();

  if (tag === 'img') {
    const inlineStyle = inlineStylesFromComputed(el, win);
    const imgStyle = inlineStyle
      ? `${inlineStyle}; max-width: 100%; height: auto;`
      : 'max-width: 100%; height: auto;';
    el.setAttribute('style', imgStyle);
  } else if (tag === 'table' || tag === 'tr' || tag === 'td' || tag === 'th') {
    // 이미 변환된 table 요소는 건드리지 않음
  } else {
    const inlineStyle = inlineStylesFromComputed(el, win);
    if (inlineStyle) {
      el.setAttribute('style', inlineStyle);
    }
  }

  el.removeAttribute('class');
}

/**
 * 변환된 table 내부의 자식들도 인라인 스타일 적용
 */
function walkAndInlineStylesOnly(el, win) {
  if (el.nodeType !== 1) return;
  const tag = el.tagName.toLowerCase();

  // table 구조는 스킵 (이미 스타일 지정됨), 내부 컨텐츠만 처리
  if (tag !== 'table' && tag !== 'tr' && tag !== 'td' && tag !== 'th' && tag !== 'img') {
    const inlineStyle = inlineStylesFromComputed(el, win);
    if (inlineStyle) {
      el.setAttribute('style', inlineStyle);
    }
    el.removeAttribute('class');
  }

  for (const child of Array.from(el.children)) {
    walkAndInlineStylesOnly(child, win);
  }
}

// ─── 메인 함수 ───

export async function preprocessHtmlForDocx(html) {
  // 1단계: 모든 외부 이미지 URL → base64 (메인 컨텍스트에서 CORS fetch)
  let processed = await convertAllImagesToBase64(html);

  // 2단계: background-image CSS → <img> 태그 변환
  processed = insertImgForBackgrounds(processed);

  // 3단계: 이미지를 작은 플레이스홀더로 교체 (iframe에서 손상 방지)
  const { html: safeHtml, imageMap } = extractAndReplaceImages(processed);

  console.log(`[DOCX] 이미지 ${imageMap.size}개를 플레이스홀더로 보호`);

  // 4단계: iframe에서 Tailwind CSS 렌더링 → 레이아웃 변환 + 인라인 스타일 추출
  const styledHtml = await new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;visibility:hidden;';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      try {
        const iframeDoc = iframe.contentDocument;
        const win = iframe.contentWindow;

        // Tailwind CSS CDN 로딩 대기
        await new Promise((r) => setTimeout(r, 2000));

        const body = iframeDoc.body;
        if (!body || !body.innerHTML.trim()) {
          throw new Error('iframe 렌더링 실패');
        }

        // DOM 순회: flex/grid → table 변환 + 인라인 스타일 (bottom-up)
        walkAndConvertLayout(body, win, iframeDoc);

        // 변환된 table 내부 콘텐츠에도 인라인 스타일 적용
        iframeDoc.querySelectorAll('table td, table th').forEach((cell) => {
          walkAndInlineStylesOnly(cell, win);
        });

        // SVG 요소 제거 (Lucide 아이콘 등 — DOCX 렌더링 불가, XML 네임스페이스 충돌 방지)
        iframeDoc.querySelectorAll('svg').forEach((svg) => svg.remove());

        // 빈 <i> 요소 제거 (아이콘 플레이스홀더)
        iframeDoc.querySelectorAll('i').forEach((el) => {
          if (!el.textContent.trim() && el.children.length === 0) {
            el.remove();
          }
        });

        // data-* 속성 제거 (data-docx-id 제외) + xmlns 속성 제거 (XML 충돌 방지)
        iframeDoc.querySelectorAll('*').forEach((el) => {
          const attrs = Array.from(el.attributes);
          for (const attr of attrs) {
            if (attr.name.startsWith('data-') && attr.name !== 'data-docx-id') {
              el.removeAttribute(attr.name);
            }
            if (attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) {
              el.removeAttribute(attr.name);
            }
          }
        });

        // script, link, style 태그 제거
        iframeDoc.querySelectorAll('script, link[rel="stylesheet"], style').forEach((el) => el.remove());

        // DOCX용 기본 스타일 추가
        const style = iframeDoc.createElement('style');
        style.textContent = `
          body { font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; font-size: 11pt; line-height: 1.6; color: #222; }
          table { border-collapse: collapse; }
          th, td { border-top: 1px solid #ccc; border-right: 1px solid #ccc; border-bottom: 1px solid #ccc; border-left: 1px solid #ccc; padding: 6px 10px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          img { max-width: 100%; height: auto; }
          h1 { font-size: 22pt; font-weight: bold; }
          h2 { font-size: 18pt; font-weight: bold; }
          h3 { font-size: 14pt; font-weight: bold; }
          h4 { font-size: 12pt; font-weight: bold; }
        `;
        iframeDoc.head.appendChild(style);

        const result = `<!DOCTYPE html><html><head><meta charset="UTF-8">${iframeDoc.head.innerHTML}</head><body>${iframeDoc.body.innerHTML}</body></html>`;

        document.body.removeChild(iframe);
        resolve(result);
      } catch (err) {
        document.body.removeChild(iframe);
        reject(err);
      }
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      reject(new Error('iframe 로드 실패'));
    };

    iframe.srcdoc = safeHtml;
  });

  // 5단계: html-to-docx 호환 CSS 정리
  // (a) border shorthand → longhand 변환 (html-to-docx의 border 파서는 shorthand 미지원)
  let sanitizedHtml = styledHtml.replace(
    /(?<![-a-z])border\s*:\s*none\b[^;]*;?/gi,
    'border-top-style:none;border-right-style:none;border-bottom-style:none;border-left-style:none;'
  ).replace(
    /(?<![-a-z])border\s*:\s*0\b[^;]*;?/gi,
    'border-top-width:0;border-right-width:0;border-bottom-width:0;border-left-width:0;'
  ).replace(
    // border: Npx solid #color 같은 shorthand → 4방향 longhand
    /(?<![-a-z])border\s*:\s*(\d+(?:\.\d+)?(?:px|pt))\s+(solid|dashed|dotted|double|groove|ridge|inset|outset)\s+([^;"]+)\s*;?/gi,
    (_, w, s, c) =>
      `border-top-width:${w};border-right-width:${w};border-bottom-width:${w};border-left-width:${w};` +
      `border-top-style:${s};border-right-style:${s};border-bottom-style:${s};border-left-style:${s};` +
      `border-top-color:${c.trim()};border-right-color:${c.trim()};border-bottom-color:${c.trim()};border-left-color:${c.trim()};`
  );

  // (b) width 값 중 html-to-docx tcW 파서가 지원하지 않는 형식 변환/제거
  // tcW는 px, pt, cm, in만 지원 — %, auto, fit-content 등은 Invalid XML name: @w 에러 유발
  sanitizedHtml = sanitizedHtml.replace(/style="([^"]*)"/gi, (match, styleStr) => {
    const fixed = styleStr.replace(
      /(?<![-a-z])width\s*:\s*([^;"]+)/gi,
      (widthMatch, val) => {
        const v = val.trim();
        // px, pt, cm, in → 그대로 유지
        if (/^\d+(\.\d+)?(px|pt|cm|in)$/i.test(v)) return widthMatch;
        // 퍼센트 → 800px 폴백
        if (/%/.test(v)) return 'width: 800px';
        // 단위 없는 숫자 → px 추가
        if (/^\d+(\.\d+)?$/.test(v)) return `width: ${v}px`;
        // auto, inherit, fit-content 등 → width 제거 (tcW 생성 방지)
        return '';
      }
    );
    return `style="${fixed}"`;
  });

  // 6단계: 플레이스홀더를 원본 이미지로 복원
  const finalHtml = restoreImages(sanitizedHtml, imageMap);

  // 검증
  const restoredCount = (finalHtml.match(/src=["']data:image\//g) || []).length +
    (finalHtml.match(/src=["']https?:\/\//g) || []).length;
  console.log(`[DOCX] 복원된 이미지: ${restoredCount}개 (원본: ${imageMap.size}개)`);

  return finalHtml;
}
