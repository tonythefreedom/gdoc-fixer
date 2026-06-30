import { useState, useCallback } from 'react';
import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';

const SLIDE_W = 1280;
const SLIDE_H = 720;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 슬라이드 HTML 에서 "문서 뷰포트 레이어" 만 추출한다.
 *
 * 슬라이드의 표준 구조는 `<div style="width:1280px;height:720px;...">` 단일
 * viewport. 하지만 디자인 시스템 (특히 Dark Tech / Burgundy / FT pink 등)
 * 의 promptHint 를 따르면서 Gemini 가 root div 바깥에
 *   <style>body{background:#1a0b10; padding:60px;}</style>
 *   <body class="page-bg">
 *     <div style="width:1280px;height:720px;...">…</div>
 *   </body>
 * 형태로 "배경 레이어 + viewport 레이어" 2 단 구조를 만들어내는 경우가 있다.
 *
 * 이 함수는 1280×720 viewport div 를 찾아 그것을 최외곽으로 사용한다.
 * head 의 <style>/<link> 도 같이 모아서 폰트·내부 셀렉터가 살아남게 한다.
 */
function extractSlideViewport(html) {
  let doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return { viewportHtml: html, styles: '' };
  }

  // 1) 1280×720 인라인 사이즈를 가진 첫 번째 element
  const sized = doc.querySelectorAll('div, section, article, main');
  let viewport = null;
  for (const el of sized) {
    const style = (el.getAttribute('style') || '').replace(/\s+/g, '');
    if (/width:1280px/i.test(style) && /height:720px/i.test(style)) {
      viewport = el;
      break;
    }
  }

  // 2) 폴백: body 의 첫 직접 자식 (= 가장 외곽 컨테이너)
  if (!viewport && doc.body) {
    const firstChild = Array.from(doc.body.children).find(
      (c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE' && c.tagName !== 'LINK'
    );
    viewport = firstChild || doc.body;
  }

  // head 의 스타일/링크/스크립트(폰트 import 등) 보존. 단,
  // 메인 document 의 body 셀렉터에 영향을 주는 글로벌 `body{...}` 룰은
  // viewport 캡처에 무의미하므로 제거한다.
  const headEls = doc.head
    ? Array.from(doc.head.querySelectorAll('style, link[rel="stylesheet"]'))
    : [];
  const styleHtml = headEls
    .map((el) => {
      if (el.tagName === 'STYLE') {
        // `body { ... }` 룰을 `.slide-viewport-root { ... }` 로 대체.
        const css = el.textContent || '';
        const rewritten = css.replace(/(^|[}\s])body(\s*[{,])/g, '$1.slide-viewport-root$2');
        return `<style>${rewritten}</style>`;
      }
      return el.outerHTML;
    })
    .join('\n');

  return {
    viewportHtml: viewport ? viewport.outerHTML : html,
    styles: styleHtml,
  };
}

/**
 * 전체 슬라이드 deck 에서 사용된 GCS 이미지 URL 들을 한 번씩만 fetch 해
 * URL → dataURI Map 반환. 같은 이미지가 여러 슬라이드에 있어도 1 회 fetch.
 */
async function prefetchImageMap(slides) {
  const urlRegex = /https:\/\/storage\.googleapis\.com\/[^\s"')]+/g;
  const all = new Set();
  for (const s of slides) {
    const m = s.match(urlRegex);
    if (m) for (const u of m) all.add(u);
  }
  const map = new Map();
  await Promise.all(
    [...all].map(async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const dataUri = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        map.set(url, dataUri);
      } catch (err) {
        console.warn('Failed to inline image for PDF:', url, err);
      }
    })
  );
  return map;
}

function applyImageMap(html, map) {
  if (!map.size) return html;
  let result = html;
  for (const [url, dataUri] of map) {
    result = result.replaceAll(url, dataUri);
  }
  return result;
}

// (deprecated) 슬라이드 1 개 단위 인라인 — 호출 안 함. 호환 위해 남김.
async function inlineExternalImages(html) { // eslint-disable-line no-unused-vars
  const urlRegex = /https:\/\/storage\.googleapis\.com\/[^\s"')]+/g;
  const urls = [...new Set(html.match(urlRegex) || [])];
  if (urls.length === 0) return html;
  let result = html;
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      result = result.replaceAll(url, dataUri);
    } catch (err) {
      console.warn('Failed to inline image for PDF:', url, err);
    }
  }));
  return result;
}

// Preload Google Font for slide rendering
function injectFont(container) {
  const style = document.createElement('style');
  style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap');`;
  container.prepend(style);
}

// Wait for fonts to be available
async function waitForFonts() {
  try {
    await document.fonts.ready;
    await document.fonts.load('400 16px "Noto Sans KR"');
    await document.fonts.load('700 16px "Noto Sans KR"');
  } catch {
    await delay(1000);
  }
}

export function usePdfExport() {
  const [pdfLoading, setPdfLoading] = useState(false);

  const exportSlidesToPdf = useCallback(async (slides) => {
    if (!slides?.length || pdfLoading) return;
    setPdfLoading(true);

    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:0;top:0;z-index:-9999;opacity:0;pointer-events:none;`;
    document.body.appendChild(container);

    try {
      injectFont(container);
      await waitForFonts();

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [SLIDE_W, SLIDE_H],
        hotfixes: ['px_scaling'],
      });

      // 전 슬라이드의 GCS 이미지를 한 번씩만 fetch (병렬). 같은 이미지가
      // 여러 슬라이드에 있어도 1 회만 네트워크 호출.
      console.time('[PDF] prefetchImages');
      const imageMap = await prefetchImageMap(slides);
      console.timeEnd('[PDF] prefetchImages');

      for (let i = 0; i < slides.length; i++) {
        const inlinedHtml = applyImageMap(slides[i], imageMap);

        // 슬라이드 HTML 에서 1280×720 viewport 만 추출 → PDF 의 최외곽으로 사용
        const { viewportHtml, styles } = extractSlideViewport(inlinedHtml);

        const slideEl = document.createElement('div');
        // 이 컨테이너 자체가 PDF 의 1280×720 페이지 박스다. overflow:hidden
        // 으로 viewport 바깥 잔여 픽셀을 차단.
        slideEl.style.cssText = `position:relative;width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:#fff;`;
        slideEl.innerHTML = styles + viewportHtml;

        // 추출한 viewport 를 좌상단(0,0) 에 강제로 고정. 외곽 wrapper/배경
        // 레이어가 있어도 캡처는 viewport 안만 보게 된다.
        const innerViewport =
          slideEl.querySelector('[style*="width:1280px"]') ||
          slideEl.firstElementChild;
        if (innerViewport && innerViewport instanceof HTMLElement) {
          innerViewport.classList.add('slide-viewport-root');
          innerViewport.style.position = 'absolute';
          innerViewport.style.left = '0';
          innerViewport.style.top = '0';
          innerViewport.style.width = `${SLIDE_W}px`;
          innerViewport.style.height = `${SLIDE_H}px`;
          innerViewport.style.margin = '0';
          innerViewport.style.transform = 'none';
        }

        container.appendChild(slideEl);

        // 폰트/이미지 이미 로드됨 — 짧은 한 frame 대기로 layout flush 만.
        await delay(30);

        const canvas = await toCanvas(slideEl, {
          width: SLIDE_W,
          height: SLIDE_H,
          // 2배는 PDF 출력 quality 충분 + canvas 픽셀 4 배 감소 (3 → 2)
          pixelRatio: 2,
          cacheBust: false,
          imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });

        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.85),
          'JPEG',
          0, 0, SLIDE_W, SLIDE_H,
          undefined,
          'FAST'
        );

        container.removeChild(slideEl);
        console.log(`[PDF] ${i + 1}/${slides.length}`);
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      // export 성공 후 코인 차감 (실패해도 export 결과는 이미 사용자 손에)
      try {
        const [{ chargeCoin }, { default: useSlideStore }] = await Promise.all([
          import('../utils/coin'),
          import('../store/useSlideStore'),
        ]);
        await chargeCoin(useSlideStore.getState().uid, 'exportDoc');
      } catch (err) {
        alert(err.message);
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`PDF 변환 실패: ${msg}`);
    } finally {
      document.body.removeChild(container);
      setPdfLoading(false);
    }
  }, [pdfLoading]);

  return { exportSlidesToPdf, pdfLoading };
}
