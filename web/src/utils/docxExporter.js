/**
 * HTML → DOCX 변환기 (docx 라이브러리)
 *
 * iframe에서 Tailwind를 렌더링한 뒤,
 * 살아있는 DOM + getComputedStyle로 직접 docx 객체를 구축.
 * 중간 HTML 직렬화 없이 정확한 스타일 보존.
 */
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  TableLayoutType,
  ExternalHyperlink,
  convertInchesToTwip,
  Packer,
  ShadingType,
  VerticalAlign,
  UnderlineType,
} from 'docx';

// ─── 유틸 ───

function rgbToHex(str) {
  if (!str) return undefined;
  str = str.trim();
  if (str === 'rgba(0, 0, 0, 0)' || str === 'transparent' || str === 'none') return undefined;
  if (str.startsWith('#')) {
    const hex = str.replace('#', '');
    if (hex.length === 3) return hex.split('').map(c => c + c).join('').toUpperCase();
    return hex.substring(0, 6).toUpperCase();
  }
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return undefined;
  return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function parsePx(val) {
  if (!val) return 0;
  return Math.round(parseFloat(val)) || 0;
}

function pxToHalfPt(px) { return px ? Math.round((px / 96) * 72 * 2) : undefined; }
function pxToTwip(px) { return px ? Math.round((px / 96) * 1440) : 0; }

const PAGE_WIDTH_TWIP = 9029; // A4 본문 폭

// ─── 이미지 ───

function base64ToUint8(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  if (!b64) return null;
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function fetchAsBase64(url) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(r => {
      const rd = new FileReader();
      rd.onload = () => r(rd.result);
      rd.onerror = () => r(null);
      rd.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function makeImageRun(img, win) {
  let src = img.getAttribute('src') || '';
  if (src.startsWith('http')) {
    src = await fetchAsBase64(src) || '';
  }
  if (!src.startsWith('data:image/')) return null;
  const buf = base64ToUint8(src);
  if (!buf) return null;

  const cs = win.getComputedStyle(img);
  let w = parsePx(cs.width) || parseInt(img.getAttribute('width')) || 400;
  let h = parsePx(cs.height) || parseInt(img.getAttribute('height')) || 300;
  const MAX = 560;
  if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
  if (h < 1) h = 1;

  return new ImageRun({
    data: buf,
    transformation: { width: w, height: h },
    type: src.includes('image/png') ? 'png' : 'jpg',
  });
}

// ─── 텍스트 스타일 ───

function buildStyle(el, win, inherited) {
  const s = { ...inherited };
  if (!el || !el.tagName) return s;
  const tag = el.tagName.toLowerCase();
  const cs = win.getComputedStyle(el);

  if (tag === 'b' || tag === 'strong') s.bold = true;
  if (tag === 'i' || tag === 'em') s.italics = true;
  if (tag === 'u') s.underline = { type: UnderlineType.SINGLE };
  if (tag === 's' || tag === 'del' || tag === 'strike') s.strike = true;
  if (tag === 'sub') s.subScript = true;
  if (tag === 'sup') s.superScript = true;

  const fw = cs.fontWeight;
  if (fw === 'bold' || parseInt(fw) >= 700) s.bold = true;
  if (cs.fontStyle === 'italic') s.italics = true;
  const td = cs.textDecoration || cs.textDecorationLine || '';
  if (td.includes('underline')) s.underline = { type: UnderlineType.SINGLE };
  if (td.includes('line-through')) s.strike = true;

  const color = rgbToHex(cs.color);
  if (color && color !== '000000') s.color = color;

  const bg = rgbToHex(cs.backgroundColor);
  if (bg) s.shading = { type: ShadingType.CLEAR, fill: bg };

  const fsPx = parsePx(cs.fontSize);
  if (fsPx && fsPx !== 16) s.size = pxToHalfPt(fsPx);

  const ff = cs.fontFamily;
  if (ff) {
    const name = ff.replace(/['"]/g, '').split(',')[0].trim();
    if (name && name !== 'Times New Roman' && name !== 'serif') s.font = name;
  }

  return s;
}

function mkRun(text, style) {
  const o = { text };
  if (style.bold) o.bold = true;
  if (style.italics) o.italics = true;
  if (style.underline) o.underline = style.underline;
  if (style.strike) o.strike = true;
  if (style.subScript) o.subScript = true;
  if (style.superScript) o.superScript = true;
  if (style.color) o.color = style.color;
  if (style.size) o.size = style.size;
  if (style.font) o.font = { name: style.font };
  if (style.shading) o.shading = style.shading;
  return new TextRun(o);
}

// ─── 인라인 요소 → runs ───

function collectRuns(node, win, inherited) {
  const runs = [];
  if (node.nodeType === 3) {
    const t = node.textContent;
    if (t) runs.push(mkRun(t, inherited));
    return runs;
  }
  if (node.nodeType !== 1) return runs;
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') { runs.push(new TextRun({ break: 1 })); return runs; }
  if (tag === 'img') { runs.push({ __img: node }); return runs; }
  if (tag === 'svg' || tag === 'script' || tag === 'style') return runs;

  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const st = buildStyle(node, win, inherited);
    st.color = st.color || '2563EB';
    st.underline = { type: UnderlineType.SINGLE };
    const lr = [];
    for (const c of node.childNodes) lr.push(...collectRuns(c, win, st));
    const textOnly = lr.filter(r => r instanceof TextRun);
    if (href && textOnly.length > 0) {
      runs.push({ __link: new ExternalHyperlink({ link: href, children: textOnly }) });
    } else { runs.push(...lr); }
    return runs;
  }

  const st = buildStyle(node, win, inherited);
  for (const c of node.childNodes) runs.push(...collectRuns(c, win, st));
  return runs;
}

// runs를 텍스트/이미지로 분리
function splitRuns(runs) {
  const groups = [];
  let cur = [];
  for (const r of runs) {
    if (r && r.__img) {
      if (cur.length) { groups.push({ t: 'text', r: cur }); cur = []; }
      groups.push({ t: 'img', el: r.__img });
    } else if (r && r.__link) {
      cur.push(r.__link);
    } else {
      cur.push(r);
    }
  }
  if (cur.length) groups.push({ t: 'text', r: cur });
  return groups;
}

// ─── 정렬 ───

function getAlign(cs) {
  switch (cs.textAlign) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return undefined;
  }
}

// ─── 테이블 ───

function borderSide(cs, side) {
  const w = parsePx(cs[`border${side}Width`]);
  const s = cs[`border${side}Style`];
  const c = rgbToHex(cs[`border${side}Color`]);
  if (s === 'none' || w === 0) return { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  let bs = BorderStyle.SINGLE;
  if (s === 'dashed') bs = BorderStyle.DASHED;
  if (s === 'dotted') bs = BorderStyle.DOTTED;
  if (s === 'double') bs = BorderStyle.DOUBLE;
  return { style: bs, size: Math.max(1, w * 8), color: c || 'CCCCCC' };
}

async function convertTable(tableEl, win) {
  const trEls = tableEl.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr');
  if (trEls.length === 0) return null;

  const tableCs = win.getComputedStyle(tableEl);
  const tableWPx = parsePx(tableCs.width);
  const tableWidthTwip = tableWPx > 100 ? pxToTwip(tableWPx) : PAGE_WIDTH_TWIP;

  // 1단계: 실제 열(column) 수 파악 — colspan을 풀어서 최대 열 수 계산
  let maxCols = 0;
  for (const tr of trEls) {
    const tds = tr.querySelectorAll(':scope > td, :scope > th');
    let cols = 0;
    for (const td of tds) cols += parseInt(td.getAttribute('colspan')) || 1;
    if (cols > maxCols) maxCols = cols;
  }
  if (maxCols === 0) maxCols = 1;

  // 2단계: <col> 또는 <colgroup> 에서 명시적 너비 확인
  const explicitColWidths = [];
  const colEls = tableEl.querySelectorAll(':scope > colgroup > col, :scope > col');
  for (const col of colEls) {
    const cs = win.getComputedStyle(col);
    const w = parsePx(cs.width);
    explicitColWidths.push(w > 0 ? w : 0);
  }

  // 3단계: colspan이 없는 행 중 셀 수가 maxCols인 행에서 computed width 수집
  let refWidths = null;
  for (const tr of trEls) {
    const tds = tr.querySelectorAll(':scope > td, :scope > th');
    // colspan 없이 셀 수 == maxCols 인 행 찾기
    let allSingle = true;
    let cnt = 0;
    for (const td of tds) {
      const cs = parseInt(td.getAttribute('colspan')) || 1;
      if (cs > 1) { allSingle = false; break; }
      cnt++;
    }
    if (allSingle && cnt === maxCols) {
      refWidths = [];
      let total = 0;
      for (const td of tds) {
        const w = parsePx(win.getComputedStyle(td).width);
        refWidths.push(w);
        total += w;
      }
      // 너비 편차가 너무 크면 (최대/최소 > 10배) 불량 → 균등 분배로 폴백
      const maxW = Math.max(...refWidths);
      const minW = Math.min(...refWidths.filter(w => w > 0));
      if (minW > 0 && maxW / minW > 10) refWidths = null;
      else if (total < 50) refWidths = null;
      else break; // 유효한 행을 찾음
    }
  }

  // 4단계: columnWidths (twips) 배열 결정
  let cellTwips;

  if (explicitColWidths.length === maxCols && explicitColWidths.some(w => w > 0)) {
    // <col> 명시적 너비 사용
    const total = explicitColWidths.reduce((a, b) => a + b, 0) || 1;
    cellTwips = explicitColWidths.map(w =>
      w > 0 ? Math.round((w / total) * tableWidthTwip) : Math.round(tableWidthTwip / maxCols)
    );
  } else if (refWidths && refWidths.length === maxCols) {
    // 참조 행의 computed width 비율 사용
    const total = refWidths.reduce((a, b) => a + b, 0) || 1;
    cellTwips = refWidths.map(w =>
      Math.max(Math.round((w / total) * tableWidthTwip), 400)
    );
  } else {
    // 폴백: 균등 분배
    cellTwips = Array(maxCols).fill(Math.round(tableWidthTwip / maxCols));
  }

  // twip 합계 보정
  const twipSum = cellTwips.reduce((a, b) => a + b, 0);
  if (twipSum !== tableWidthTwip && cellTwips.length > 0) {
    cellTwips[cellTwips.length - 1] += (tableWidthTwip - twipSum);
  }

  // 5단계: 행 변환
  const rows = [];

  for (const tr of trEls) {
    const cells = [];
    const tdEls = tr.querySelectorAll(':scope > td, :scope > th');
    let colIdx = 0;

    for (const td of tdEls) {
      const isHeader = td.tagName.toLowerCase() === 'th';
      const cs = win.getComputedStyle(td);

      const children = await convertBlock(td, win);
      if (children.length === 0) children.push(new Paragraph({}));

      const colspan = parseInt(td.getAttribute('colspan')) || 1;
      const rowspan = parseInt(td.getAttribute('rowspan')) || 1;

      // 셀 너비: columnWidths 맵에서 해당 열들 합산
      let cellW = 0;
      for (let c = 0; c < colspan && (colIdx + c) < cellTwips.length; c++) {
        cellW += cellTwips[colIdx + c];
      }
      if (cellW === 0) cellW = Math.round(tableWidthTwip / maxCols);

      const bgColor = rgbToHex(cs.backgroundColor);
      const va = cs.verticalAlign;

      cells.push(new TableCell({
        children,
        borders: {
          top: borderSide(cs, 'Top'),
          right: borderSide(cs, 'Right'),
          bottom: borderSide(cs, 'Bottom'),
          left: borderSide(cs, 'Left'),
        },
        width: { size: Math.max(cellW, 400), type: WidthType.DXA },
        shading: bgColor
          ? { type: ShadingType.CLEAR, fill: bgColor }
          : isHeader ? { type: ShadingType.CLEAR, fill: 'F0F0F0' } : undefined,
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
        verticalAlign: va === 'middle' ? VerticalAlign.CENTER : va === 'bottom' ? VerticalAlign.BOTTOM : undefined,
        margins: {
          top: pxToTwip(parsePx(cs.paddingTop) || 3),
          right: pxToTwip(parsePx(cs.paddingRight) || 6),
          bottom: pxToTwip(parsePx(cs.paddingBottom) || 3),
          left: pxToTwip(parsePx(cs.paddingLeft) || 6),
        },
      }));

      colIdx += colspan;
    }

    if (cells.length > 0) rows.push(new TableRow({ children: cells }));
  }

  if (rows.length === 0) return null;

  return new Table({
    rows,
    width: { size: tableWidthTwip, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: cellTwips,
  });
}

// ─── 리스트 ───

async function convertList(listEl, win, level = 0) {
  const results = [];
  const isOrdered = listEl.tagName.toLowerCase() === 'ol';

  for (const li of listEl.children) {
    if (li.tagName.toLowerCase() !== 'li') continue;

    const inlineRuns = [];
    const subBlocks = [];

    for (const child of li.childNodes) {
      if (child.nodeType === 1) {
        const ct = child.tagName.toLowerCase();
        if (ct === 'ul' || ct === 'ol') { subBlocks.push(child); continue; }
        if (ct === 'table' || ct === 'div' || ct === 'p') { subBlocks.push(child); continue; }
      }
      inlineRuns.push(...collectRuns(child, win, {}));
    }

    const groups = splitRuns(inlineRuns);
    for (const g of groups) {
      if (g.t === 'text') {
        results.push(new Paragraph({
          children: g.r,
          bullet: isOrdered ? undefined : { level },
          numbering: isOrdered ? { reference: 'default-numbering', level } : undefined,
        }));
      } else {
        const ir = await makeImageRun(g.el, win);
        if (ir) results.push(new Paragraph({ children: [ir] }));
      }
    }

    for (const sub of subBlocks) {
      const st = sub.tagName.toLowerCase();
      if (st === 'ul' || st === 'ol') results.push(...await convertList(sub, win, level + 1));
      else results.push(...await convertBlock(sub, win));
    }
  }
  return results;
}

// ─── 블록 변환 ───

const HEADING_MAP = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
};
const HEADING_SIZES = { h1: 44, h2: 36, h3: 28, h4: 24, h5: 22, h6: 20 };

const BLOCK_TAGS = new Set([
  'div', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside',
  'figure', 'figcaption', 'address', 'details', 'summary',
]);

function isBlock(el) {
  if (!el || el.nodeType !== 1) return false;
  const t = el.tagName.toLowerCase();
  return BLOCK_TAGS.has(t) || t === 'p' || t === 'table' || t === 'ul' || t === 'ol' ||
    t === 'blockquote' || t === 'pre' || t === 'hr' || !!HEADING_MAP[t];
}

async function convertBlock(parent, win) {
  const results = [];

  for (const node of parent.childNodes) {
    if (node.nodeType === 3) {
      const t = node.textContent.trim();
      if (t) results.push(new Paragraph({ children: [new TextRun({ text: t })] }));
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'svg' || tag === 'head') continue;

    const cs = win.getComputedStyle(node);

    // 테이블
    if (tag === 'table') {
      const tbl = await convertTable(node, win);
      if (tbl) results.push(tbl);
      continue;
    }

    // 리스트
    if (tag === 'ul' || tag === 'ol') {
      results.push(...await convertList(node, win));
      continue;
    }

    // 이미지
    if (tag === 'img') {
      const ir = await makeImageRun(node, win);
      if (ir) results.push(new Paragraph({ children: [ir], alignment: getAlign(cs) }));
      continue;
    }

    // 수평선
    if (tag === 'hr') {
      results.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
        spacing: { before: 120, after: 120 },
      }));
      continue;
    }

    // 제목
    if (HEADING_MAP[tag]) {
      const hStyle = { bold: true };
      const fsPx = parsePx(cs.fontSize);
      hStyle.size = fsPx > 0 ? pxToHalfPt(fsPx) : HEADING_SIZES[tag];
      const hColor = rgbToHex(cs.color);
      if (hColor) hStyle.color = hColor;

      const runs = collectRuns(node, win, hStyle);
      const groups = splitRuns(runs);
      for (const g of groups) {
        if (g.t === 'text') {
          results.push(new Paragraph({
            children: g.r,
            heading: HEADING_MAP[tag],
            alignment: getAlign(cs),
            spacing: { before: 240, after: 120 },
          }));
        } else {
          const ir = await makeImageRun(g.el, win);
          if (ir) results.push(new Paragraph({ children: [ir] }));
        }
      }
      continue;
    }

    // blockquote
    if (tag === 'blockquote') {
      const inner = await convertBlock(node, win);
      if (inner.length > 0) {
        for (const child of inner) results.push(child);
      } else {
        const runs = collectRuns(node, win, { color: '64748B' });
        const groups = splitRuns(runs);
        for (const g of groups) {
          if (g.t === 'text') {
            results.push(new Paragraph({
              children: g.r,
              indent: { left: convertInchesToTwip(0.5) },
              border: { left: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' } },
            }));
          }
        }
      }
      continue;
    }

    // pre
    if (tag === 'pre') {
      for (const line of (node.textContent || '').split('\n')) {
        results.push(new Paragraph({
          children: [new TextRun({ text: line || ' ', font: { name: 'Consolas' }, size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
          spacing: { before: 20, after: 20 },
          indent: { left: convertInchesToTwip(0.2) },
        }));
      }
      continue;
    }

    // p, div 등 블록
    if (tag === 'p' || BLOCK_TAGS.has(tag)) {
      const hasBlockChild = Array.from(node.children).some(isBlock);
      if (hasBlockChild) {
        results.push(...await convertBlock(node, win));
      } else {
        const pStyle = buildStyle(node, win, {});
        const runs = collectRuns(node, win, pStyle);
        const groups = splitRuns(runs);
        const bgColor = rgbToHex(cs.backgroundColor);
        const ml = parsePx(cs.marginLeft) || parsePx(cs.paddingLeft);
        const mb = parsePx(cs.marginBottom);

        for (const g of groups) {
          if (g.t === 'text' && g.r.length > 0) {
            results.push(new Paragraph({
              children: g.r,
              alignment: getAlign(cs),
              spacing: { after: mb > 0 ? pxToTwip(mb) : 80 },
              indent: ml > 0 ? { left: pxToTwip(ml) } : undefined,
              shading: bgColor ? { type: ShadingType.CLEAR, fill: bgColor } : undefined,
            }));
          } else if (g.t === 'img') {
            const ir = await makeImageRun(g.el, win);
            if (ir) results.push(new Paragraph({ children: [ir] }));
          }
        }
      }
      continue;
    }

    // 기타 인라인/알 수 없는 태그
    if (node.children !== undefined) {
      const hasBlockChild = Array.from(node.children).some(isBlock);
      if (hasBlockChild) {
        results.push(...await convertBlock(node, win));
      } else {
        const runs = collectRuns(node, win, {});
        const groups = splitRuns(runs);
        for (const g of groups) {
          if (g.t === 'text' && g.r.length > 0) {
            results.push(new Paragraph({ children: g.r }));
          } else if (g.t === 'img') {
            const ir = await makeImageRun(g.el, win);
            if (ir) results.push(new Paragraph({ children: [ir] }));
          }
        }
      }
    }
  }
  return results;
}

// ─── 이미지 URL → base64 사전 변환 ───

async function convertAllImagesToBase64(html) {
  const regex = /(<img\s[^>]*?src=["'])(https?:\/\/[^"']+)(["'])/gi;
  const urls = new Set();
  let m;
  while ((m = regex.exec(html)) !== null) urls.add(m[2]);
  if (urls.size === 0) return html;

  const map = new Map();
  await Promise.all([...urls].map(async url => {
    const b64 = await fetchAsBase64(url);
    if (b64) map.set(url, b64);
  }));

  let result = html;
  for (const [url, b64] of map) result = result.replaceAll(url, b64);
  return result;
}

// ─── 공개 API ───

export async function htmlToDocxBlob(html, title = 'document') {
  console.log('[DOCX] 변환 시작...');

  // 1. 외부 이미지 → base64
  const htmlWithImages = await convertAllImagesToBase64(html);

  // 2. iframe 렌더링 → 살아있는 DOM에서 직접 docx 객체 구축
  const children = await new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;height:600px;visibility:hidden;';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
      try {
        const win = iframe.contentWindow;
        const body = iframe.contentDocument.body;
        await new Promise(r => setTimeout(r, 2000)); // Tailwind 로딩 대기

        if (!body || !body.innerHTML.trim()) throw new Error('iframe 렌더링 실패');

        const result = await convertBlock(body, win);
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

    iframe.srcdoc = htmlWithImages;
  });

  console.log(`[DOCX] ${children.length}개 블록 변환 완료`);
  if (children.length === 0) children.push(new Paragraph({ children: [new TextRun({ text: ' ' })] }));

  // 3. Document 생성
  const doc = new Document({
    title,
    creator: 'GDoc Fixer',
    styles: {
      default: {
        document: {
          run: { font: 'Malgun Gothic', size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
        heading1: { run: { font: 'Malgun Gothic', size: 44, bold: true, color: '0F172A' }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading2: { run: { font: 'Malgun Gothic', size: 36, bold: true, color: '1E293B' }, paragraph: { spacing: { before: 300, after: 120 } } },
        heading3: { run: { font: 'Malgun Gothic', size: 28, bold: true, color: '334155' }, paragraph: { spacing: { before: 240, after: 100 } } },
        heading4: { run: { font: 'Malgun Gothic', size: 24, bold: true, color: '475569' }, paragraph: { spacing: { before: 200, after: 80 } } },
      },
    },
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
          { level: 1, format: 'decimal', text: '%1.%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } } },
          { level: 2, format: 'decimal', text: '%1.%2.%3.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
        ],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  console.log('[DOCX] 변환 완료');
  return blob;
}
