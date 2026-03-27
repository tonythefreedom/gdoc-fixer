import { useState, useCallback } from 'react';
import { downloadBlob } from '../utils/downloadBlob';

const SLIDE_W_PX = 1280;
const SLIDE_H_PX = 720;

// PPTX는 inches 단위: 16:9 = 13.33" x 7.5" (PptxGenJS 기본값은 10" x 5.625")
const PPTX_W = 13.333;
const PPTX_H = 7.5;
const PX_TO_INCH_X = PPTX_W / SLIDE_W_PX;
const PX_TO_INCH_Y = PPTX_H / SLIDE_H_PX;

function pxToInchX(px) { return px * PX_TO_INCH_X; }
function pxToInchY(px) { return px * PX_TO_INCH_Y; }

/**
 * CSS color 문자열을 PPTX hex (RRGGBB) 로 변환
 */
function cssColorToHex(color) {
  if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;
  // 이미 hex 형태
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.slice(1);
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [, r, g, b] = color.match(/^#(.)(.)(.)$/);
    return `${r}${r}${g}${g}${b}${b}`;
  }
  // rgb/rgba
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }
  // named colors (간략 매핑)
  const named = {
    white: 'FFFFFF', black: '000000', red: 'FF0000', blue: '0000FF',
    green: '008000', yellow: 'FFFF00', gray: '808080', grey: '808080',
    orange: 'FFA500', purple: '800080', navy: '000080', teal: '008080',
  };
  return named[color.toLowerCase()] || null;
}

/**
 * CSS font-weight → PptxGenJS bold
 */
function isBold(fontWeight) {
  if (!fontWeight) return false;
  const w = parseInt(fontWeight);
  if (!isNaN(w)) return w >= 700;
  return fontWeight === 'bold' || fontWeight === 'bolder';
}

/**
 * CSS font-size (px) → pt 변환
 */
function pxToPt(pxStr) {
  const px = parseFloat(pxStr);
  if (isNaN(px)) return 12;
  return Math.round(px * 0.75 * 10) / 10; // 1px = 0.75pt
}

/**
 * CSS text-align → PptxGenJS align
 */
function mapAlign(align) {
  const map = { left: 'left', center: 'center', right: 'right', justify: 'justify' };
  return map[align] || 'left';
}

/**
 * 요소의 절대 위치를 계산 (offsetParent 기준)
 */
function getAbsoluteRect(el, rootEl) {
  let x = 0, y = 0;
  let current = el;
  while (current && current !== rootEl) {
    x += current.offsetLeft || 0;
    y += current.offsetTop || 0;
    current = current.offsetParent;
  }
  return {
    x, y,
    w: el.offsetWidth || 0,
    h: el.offsetHeight || 0,
  };
}

/**
 * 텍스트 노드에서 서식 정보를 추출하여 PptxGenJS textRun 배열로 변환
 */
function extractTextRuns(el, computedStyle) {
  const runs = [];

  function walk(node, parentStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (!text.trim()) return;
      runs.push({
        text,
        options: {
          fontSize: pxToPt(parentStyle.fontSize),
          fontFace: cleanFontFamily(parentStyle.fontFamily),
          bold: isBold(parentStyle.fontWeight),
          italic: parentStyle.fontStyle === 'italic',
          underline: parentStyle.textDecoration?.includes('underline') ? { style: 'sng' } : undefined,
          strike: parentStyle.textDecoration?.includes('line-through') ? 'sngStrike' : undefined,
          color: cssColorToHex(parentStyle.color) || '000000',
        },
      });
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const style = window.getComputedStyle(node);
      // <br> 처리
      if (node.tagName === 'BR') {
        runs.push({ text: '\n', options: {} });
        return;
      }
      for (const child of node.childNodes) {
        walk(child, style);
      }
      // block 요소 뒤에 줄바꿈
      const display = style.display;
      if (display === 'block' || display === 'list-item' || node.tagName === 'P' || node.tagName === 'DIV' || /^H[1-6]$/.test(node.tagName)) {
        if (runs.length > 0 && runs[runs.length - 1].text !== '\n') {
          runs.push({ text: '\n', options: {} });
        }
      }
    }
  }

  walk(el, computedStyle);

  // 마지막 빈 줄바꿈 제거
  while (runs.length > 0 && runs[runs.length - 1].text === '\n') {
    runs.pop();
  }
  return runs;
}

function cleanFontFamily(ff) {
  if (!ff) return 'Noto Sans KR';
  // 첫 번째 폰트만 추출, 따옴표 제거
  const first = ff.split(',')[0].trim().replace(/['"]/g, '');
  return first || 'Noto Sans KR';
}

/**
 * <img> 요소의 src에서 base64 데이터를 추출
 */
function getImageData(imgEl) {
  const src = imgEl.getAttribute('src') || '';
  if (src.startsWith('data:image/')) {
    const mimeMatch = src.match(/^data:(image\/[^;]+);base64,/);
    return {
      data: src,
      type: mimeMatch ? mimeMatch[1].split('/')[1].toUpperCase() : 'PNG',
    };
  }
  return null;
}

/**
 * <table> → PptxGenJS table 배열로 변환
 */
function convertTable(tableEl, rootEl) {
  const rows = [];
  const trs = tableEl.querySelectorAll('tr');

  for (const tr of trs) {
    const row = [];
    const cells = tr.querySelectorAll('th, td');
    for (const cell of cells) {
      const style = window.getComputedStyle(cell);
      const cellOpts = {
        text: cell.textContent.trim(),
        options: {
          fontSize: pxToPt(style.fontSize),
          fontFace: cleanFontFamily(style.fontFamily),
          bold: isBold(style.fontWeight) || cell.tagName === 'TH',
          color: cssColorToHex(style.color) || '000000',
          fill: { color: cssColorToHex(style.backgroundColor) || 'FFFFFF' },
          align: mapAlign(style.textAlign),
          valign: 'middle',
          border: { pt: 0.5, color: 'CCCCCC' },
          colspan: cell.colSpan || 1,
          rowspan: cell.rowSpan || 1,
        },
      };
      row.push(cellOpts);
    }
    if (row.length > 0) rows.push(row);
  }
  return rows;
}

/**
 * 리스트(ul/ol) → 텍스트 runs 변환
 */
function convertList(listEl) {
  const runs = [];
  const items = listEl.querySelectorAll(':scope > li');
  const isOrdered = listEl.tagName === 'OL';

  items.forEach((li, idx) => {
    const style = window.getComputedStyle(li);
    const prefix = isOrdered ? `${idx + 1}. ` : '• ';
    runs.push({
      text: prefix + li.textContent.trim() + '\n',
      options: {
        fontSize: pxToPt(style.fontSize),
        fontFace: cleanFontFamily(style.fontFamily),
        bold: isBold(style.fontWeight),
        color: cssColorToHex(style.color) || '000000',
      },
    });
  });

  // 마지막 줄바꿈 제거
  if (runs.length > 0) {
    const last = runs[runs.length - 1];
    last.text = last.text.replace(/\n$/, '');
  }
  return runs;
}

/**
 * 슬라이드 HTML을 파싱하여 PptxGenJS 슬라이드에 요소를 추가
 */
function processSlideHtml(pptx, slideHtml) {
  const slide = pptx.addSlide();

  // 오프스크린 렌더링을 위한 컨테이너
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${SLIDE_W_PX}px;height:${SLIDE_H_PX}px;overflow:hidden;`;
  document.body.appendChild(container);
  container.innerHTML = slideHtml;

  const rootEl = container.firstElementChild || container;
  const rootStyle = window.getComputedStyle(rootEl);

  // 슬라이드 배경색
  const bgColor = cssColorToHex(rootStyle.backgroundColor);
  if (bgColor && bgColor !== 'FFFFFF') {
    slide.background = { color: bgColor };
  }

  // 배경 이미지 (CSS background-image)
  const bgImage = rootStyle.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const urlMatch = bgImage.match(/url\(["']?(data:image\/[^"')]+)["']?\)/);
    if (urlMatch) {
      slide.background = { data: urlMatch[1] };
    }
  }

  // 요소 수집 및 변환
  const processedElements = new Set();

  function processElement(el) {
    if (processedElements.has(el) || el === rootEl) return;

    const tag = el.tagName;
    const style = window.getComputedStyle(el);
    const display = style.display;

    // 숨겨진 요소 무시
    if (display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

    const rect = getAbsoluteRect(el, container);
    if (rect.w === 0 || rect.h === 0) return;

    const x = pxToInchX(rect.x);
    const y = pxToInchY(rect.y);
    const w = pxToInchX(rect.w);
    const h = pxToInchY(rect.h);

    // 이미지 처리
    if (tag === 'IMG') {
      processedElements.add(el);
      const imgData = getImageData(el);
      if (imgData) {
        try {
          slide.addImage({
            data: imgData.data,
            x, y, w, h,
            sizing: { type: 'contain', w, h },
          });
        } catch (e) {
          console.warn('PPTX 이미지 추가 실패:', e.message);
        }
      }
      return;
    }

    // SVG 처리 — 직접 변환이 어려우므로 base64 이미지로 변환
    if (tag === 'svg' || tag === 'SVG') {
      processedElements.add(el);
      try {
        const svgStr = new XMLSerializer().serializeToString(el);
        const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
        slide.addImage({ data: svgBase64, x, y, w, h });
      } catch (e) {
        console.warn('SVG 변환 실패:', e.message);
      }
      return;
    }

    // 테이블 처리
    if (tag === 'TABLE') {
      processedElements.add(el);
      // 테이블 하위 모든 요소도 처리 완료 마킹
      el.querySelectorAll('*').forEach(child => processedElements.add(child));

      const tableData = convertTable(el, rootEl);
      if (tableData.length > 0) {
        try {
          slide.addTable(tableData, {
            x, y, w,
            fontSize: 10,
            border: { pt: 0.5, color: 'CCCCCC' },
            autoPage: false,
          });
        } catch (e) {
          console.warn('PPTX 테이블 추가 실패:', e.message);
        }
      }
      return;
    }

    // 리스트 처리
    if (tag === 'UL' || tag === 'OL') {
      processedElements.add(el);
      el.querySelectorAll('*').forEach(child => processedElements.add(child));

      const listRuns = convertList(el);
      if (listRuns.length > 0) {
        try {
          slide.addText(listRuns, {
            x, y, w, h,
            valign: 'top',
            shrinkText: true,
            wrap: true,
          });
        } catch (e) {
          console.warn('PPTX 리스트 추가 실패:', e.message);
        }
      }
      return;
    }

    // 배경색이 있는 박스 (장식용 사각형)
    const bgFill = cssColorToHex(style.backgroundColor);
    const hasDirectText = Array.from(el.childNodes).some(
      n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
    );
    const hasChildElements = el.querySelector('img, table, ul, ol, svg') !== null;

    // 배경 도형 추가
    if (bgFill && bgFill !== 'FFFFFF' && !hasDirectText && !hasChildElements) {
      const borderRadius = parseInt(style.borderRadius) || 0;
      try {
        if (borderRadius > 20) {
          slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y, w, h,
            fill: { color: bgFill },
            rectRadius: pxToInchX(borderRadius),
          });
        } else {
          slide.addShape(pptx.shapes.RECTANGLE, {
            x, y, w, h,
            fill: { color: bgFill },
          });
        }
      } catch (e) {
        // shape 추가 실패 무시
      }
    }

    // 텍스트가 있는 요소 (자식에 텍스트 관련 요소만 있는 경우)
    const textContent = el.textContent.trim();
    if (textContent && !hasChildElements) {
      // 하위 모든 텍스트 요소 처리 완료 마킹
      const innerEls = el.querySelectorAll('*');
      const hasComplexChildren = Array.from(innerEls).some(
        child => ['IMG', 'TABLE', 'UL', 'OL', 'SVG'].includes(child.tagName)
      );

      if (!hasComplexChildren) {
        processedElements.add(el);
        innerEls.forEach(child => processedElements.add(child));

        const textRuns = extractTextRuns(el, style);
        if (textRuns.length > 0) {
          try {
            slide.addText(textRuns, {
              x, y, w, h,
              valign: 'top',
              align: mapAlign(style.textAlign),
              wrap: true,
              shrinkText: true,
              fill: bgFill && bgFill !== 'FFFFFF' ? { color: bgFill } : undefined,
            });
          } catch (e) {
            console.warn('PPTX 텍스트 추가 실패:', e.message);
          }
        }
        return;
      }
    }
  }

  // BFS로 요소 처리 (깊이 우선 순회)
  function walkDOM(el) {
    const children = Array.from(el.children || []);
    for (const child of children) {
      if (!processedElements.has(child)) {
        processElement(child);
        if (!processedElements.has(child)) {
          walkDOM(child);
        }
      }
    }
  }

  walkDOM(rootEl);

  // 정리
  document.body.removeChild(container);
}

export function usePptxExport() {
  const [pptxLoading, setPptxLoading] = useState(false);

  const exportSlidesToPptx = useCallback(async (slides, presentationName = 'presentation') => {
    if (!slides?.length || pptxLoading) return;
    setPptxLoading(true);

    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CUSTOM_16x9', width: PPTX_W, height: PPTX_H });
      pptx.layout = 'CUSTOM_16x9';

      for (let i = 0; i < slides.length; i++) {
        console.log(`[PPTX] 슬라이드 ${i + 1}/${slides.length} 변환 중...`);
        processSlideHtml(pptx, slides[i]);
      }

      const blob = await pptx.write({ outputType: 'blob' });
      downloadBlob(blob, `${presentationName}.pptx`);
    } catch (err) {
      console.error('PPTX export failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`PPTX 변환 실패: ${msg}`);
    } finally {
      setPptxLoading(false);
    }
  }, [pptxLoading]);

  return { exportSlidesToPptx, pptxLoading };
}
