/**
 * 게시-경계 정규화 (B안: 콘텐츠를 self-contained 로).
 *
 * 같은 HTML 이 gdoc-fixer 프리뷰 · tech-blog · community(aidev) · LinkedIn 등
 * 제각각의 렌더러로 흘러가면서 (Tailwind 유무 · <style> 제거 · 클래스 스트립 등)
 * 렌더 결과가 달라지는 문제를, 콘텐츠 자체를 완결형으로 만들어 해결한다.
 *
 * 동작:
 *   1) 오프스크린 iframe 에 HTML 을 넣고 Tailwind(CDN)를 적용시킨다.
 *   2) 모든 요소의 '계산된 시각 스타일'을 inline style="" 로 굽는다
 *      (Tailwind 클래스든 <style> 든 출처 무관 — 계산 결과만 인라인).
 *   3) <script>/<link>/<style>/class 를 제거 → 외부 의존 0.
 *   4) 차트/다이어그램 placeholder(<!--CHART:-->)를 인라인 SVG 로 렌더.
 * 결과: 어느 렌더러에서도 동일하게 보이는 자립형 HTML.
 *
 * 실패 시 원본 HTML 을 그대로 반환하여 게시를 절대 막지 않는다.
 */
import { renderChartPlaceholders } from './chartRenderer.js';

const RENDER_WIDTH = 820; // 문서 컨테이너 기준 렌더 폭(px)

// 인라인화할 시각 속성 화이트리스트 (레이아웃 + 박스 + 색 + 타이포 + 효과).
// 전체 계산 스타일을 다 굽지 않고 '보이는 것'만 골라 용량/부작용을 제한.
const INLINE_PROPS = [
  'display', 'box-sizing', 'flex-direction', 'flex-wrap', 'justify-content',
  'align-items', 'align-content', 'align-self', 'gap', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'flex-grow', 'flex-shrink', 'flex-basis', 'order',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'color', 'font-size', 'font-weight', 'font-style', 'font-family', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
  'white-space', 'vertical-align', 'list-style-type', 'list-style-position',
  'box-shadow', 'opacity', 'max-width', 'object-fit', 'overflow',
  'border-collapse', 'table-layout',
];

function waitFrame(win) {
  return new Promise((r) => win.requestAnimationFrame(() => r()));
}

// Tailwind Play CDN 은 비동기로 유틸을 주입한다. 프로브 요소로 적용 완료를 폴링.
async function waitForTailwind(iframe, timeoutMs = 4000) {
  const idoc = iframe.contentDocument;
  const win = iframe.contentWindow;
  const usesTailwind = /cdn\.tailwindcss\.com/.test(idoc.documentElement.outerHTML);
  const probe = idoc.createElement('div');
  probe.className = 'p-4';
  probe.style.cssText = 'position:absolute;left:-9999px;';
  idoc.body.appendChild(probe);
  const start = Date.now();
  // 최소 2프레임 + (Tailwind 사용 시) p-4 가 16px 로 해석될 때까지
  await waitFrame(win); await waitFrame(win);
  while (Date.now() - start < timeoutMs) {
    const pad = win.getComputedStyle(probe).paddingTop;
    if (!usesTailwind || pad === '16px') break;
    await new Promise((r) => setTimeout(r, 80));
  }
  probe.remove();
  await waitFrame(win);
}

// ── 테마 적응 판정 헬퍼 ──
function parseRgb(c) {
  const m = c && c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
function isTransparentColor(c) {
  if (!c || c === 'transparent') return true;
  const m = c.match(/rgba?\([^)]*,\s*([0-9.]+)\s*\)/);
  return !!(m && parseFloat(m[1]) === 0);
}
function isWhiteColor(c) {
  const rgb = parseRgb(c);
  return !!(rgb && rgb[0] >= 250 && rgb[1] >= 250 && rgb[2] >= 250);
}
// 유색 표면(카드/박스/코드블록/그라데이션) 여부 — self-contained 섬으로 취급.
function isPaintBg(bgColor, bgImage) {
  if (bgImage && bgImage !== 'none') return true;
  if (isTransparentColor(bgColor)) return false;
  if (isWhiteColor(bgColor)) return false;
  return true;
}
// 유채색(하이라이트: 파랑/초록/빨강 등)만 true. 판정은 채도(최대-최소 채널)로 한다.
// 하이라이트는 채도가 높고(>45), 본문 텍스트의 회색/슬레이트(near-black 포함)는
// 채널차가 작다(slate-900 =15,23,42 → 27). → 어두운/밝은 base 텍스트는 테마가 제어.
function isChromatic(c) {
  const rgb = parseRgb(c);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return (Math.max(r, g, b) - Math.min(r, g, b)) > 45;
}

function buildDefaultsGetter(idoc, win) {
  const cache = {};
  return (tag) => {
    if (cache[tag]) return cache[tag];
    const el = idoc.createElement(tag);
    idoc.body.appendChild(el);
    const cs = win.getComputedStyle(el);
    const d = {};
    for (const p of INLINE_PROPS) d[p] = cs.getPropertyValue(p);
    d.__width = cs.getPropertyValue('width');
    el.remove();
    cache[tag] = d;
    return d;
  };
}

function inlineComputedStyles(root, win, idoc) {
  const getDefaults = buildDefaultsGetter(idoc, win);

  // insidePaint: 조상 중 유색 표면(카드/박스)이 있는지 — 그 안의 텍스트는
  // 자기 섬 색을 상속해야 하므로 color 를 함께 굽는다.
  const walk = (el, insidePaint) => {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'noscript') return;
    const cs = win.getComputedStyle(el);
    const defs = getDefaults(tag);
    const prev = el.getAttribute('style') || '';
    const parts = [];

    const bgColor = cs.getPropertyValue('background-color');
    const bgImage = cs.getPropertyValue('background-image');
    const elPaint = isPaintBg(bgColor, bgImage);
    const paintCtx = insidePaint || elPaint;

    for (const p of INLINE_PROPS) {
      const v = cs.getPropertyValue(p);
      if (!v || v === defs[p]) continue;
      // 테마 적응: 흰/투명 배경과 기본 텍스트 색은 굽지 않아 각 사이트 테마가 제어.
      // 유색 표면(섬)·그 내부 텍스트·유채색 하이라이트만 self-contained 로 굽는다.
      if (p === 'background-color') {
        if (!elPaint || isTransparentColor(v) || isWhiteColor(v)) continue;
      } else if (p === 'background-image') {
        if (v === 'none') continue;
      } else if (p === 'color') {
        if (!(paintCtx || isChromatic(v))) continue;
      }
      parts.push(`${p}:${v}`);
    }

    // 명시적 px width 는 인라인하지 않는다(flex/grid+padding 자연 사이징).
    // 단, 부모 콘텐츠 폭을 꽉 채우는 블록(w-full 표/컨테이너)만 width:100% 복원.
    if (cs.display !== 'inline' && el.parentElement) {
      const pcs = win.getComputedStyle(el.parentElement);
      const parentContent = el.parentElement.clientWidth - parseFloat(pcs.paddingLeft || 0) - parseFloat(pcs.paddingRight || 0);
      const elW = el.getBoundingClientRect().width;
      if (parentContent > 0 && Math.abs(elW - parentContent) <= 1.5) parts.push('width:100%');
    }
    if (tag === 'img') {
      parts.push('max-width:100%', 'height:auto');
    }

    if (parts.length) {
      if (!parts.some((p) => p.startsWith('box-sizing')) && cs.getPropertyValue('box-sizing') === 'border-box') {
        parts.unshift('box-sizing:border-box');
      }
      const merged = prev ? prev.replace(/;\s*$/, '') + ';' + parts.join(';') : parts.join(';');
      el.setAttribute('style', merged);
    }

    for (const c of Array.from(el.children)) walk(c, paintCtx);
  };

  for (const c of Array.from(root.children)) walk(c, false);
}

/**
 * @param {string} html 게시할 원본 HTML (Tailwind 클래스/스타일 포함 가능)
 * @returns {Promise<string>} 자립형(inline-only) HTML. 실패 시 원본.
 */
export async function normalizeForPublish(html) {
  if (!html || typeof html !== 'string') return html;
  let iframe;
  try {
    iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-99999px;top:0;width:${RENDER_WIDTH}px;height:1400px;border:0;visibility:hidden;`;
    document.body.appendChild(iframe);

    // Tailwind CDN 이 없으면 주입해 클래스가 해석되도록.
    let src = html;
    if (!/cdn\.tailwindcss\.com/.test(src)) {
      const cdn = '<script src="https://cdn.tailwindcss.com"></script>';
      if (/<head[^>]*>/i.test(src)) src = src.replace(/<head[^>]*>/i, (m) => m + cdn);
      else src = `<!DOCTYPE html><html><head><meta charset="utf-8">${cdn}</head><body>${src}</body></html>`;
    }

    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(src);
    idoc.close();

    await waitForTailwind(iframe);

    const win = iframe.contentWindow;
    inlineComputedStyles(idoc.body, win, idoc);

    // 외부 의존 제거: script/link/style/class + tailwind 잔재
    idoc.body.querySelectorAll('script, link, style, noscript').forEach((n) => n.remove());
    idoc.body.querySelectorAll('[class]').forEach((n) => n.removeAttribute('class'));
    idoc.body.querySelectorAll('[srcset]').forEach((n) => n.removeAttribute('srcset'));

    let out = idoc.body.innerHTML;

    // 차트/다이어그램 placeholder → 인라인 SVG (있을 때만 동작)
    out = await renderChartPlaceholders(out);

    return out;
  } catch (e) {
    console.warn('[normalizeForPublish] 정규화 실패 — 원본 유지:', e);
    return html;
  } finally {
    if (iframe) iframe.remove();
  }
}
