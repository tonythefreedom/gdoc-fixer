import { forwardRef, useEffect, useRef } from 'react';
import useAppStore from '../../store/useAppStore';
import { patchYoutubeThumbnails } from '../../utils/youtubeThumbnail.js';
import { injectMathJax, htmlHasLatex } from '../../utils/injectMathJax.js';

// AI 가 다이어그램과 함께 관습적으로 붙이는 mermaid CDN/초기화 스크립트를 제거한다.
// mermaid 는 다운스트림·프리뷰에서 파싱 에러("Syntax error in text, mermaid version …")를
// 내므로 사용하지 않으며, 다이어그램은 인라인 스타일 HTML 로 생성된다.
// 이 프리뷰 iframe 은 sandbox=allow-scripts 라 콘텐츠의 <script> 가 실행되므로 방어적으로 제거.
function stripMermaidScripts(html) {
  if (!html || html.indexOf('mermaid') === -1) return html;
  return html
    .replace(/<script\b[^>]*\bsrc=["'][^"']*mermaid[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?mermaid\s*\.\s*(?:initialize|run|contentLoaded|init)[\s\S]*?<\/script>/gi, '');
}

const PreviewIframe = forwardRef(function PreviewIframe(
  { htmlContent, viewportWidth, viewportHeight },
  ref
) {
  // 모든 미리보기 경로(LLM 응답·Firestore 로드·기존 저장본·사용자 편집)의 HTML 이
  // 이 iframe 을 통과하므로, srcDoc 직전에 maxresdefault → hqdefault fallback 과
  // LaTeX 수식이 있을 때 MathJax 로더를 함께 주입한다.
  const patchedHtml = injectMathJax(patchYoutubeThumbnails(stripMermaidScripts(htmlContent)));
  const localRef = useRef(null);

  // Fallback: srcDoc 단계에서 MathJax 주입이 누락된 경우(빌드 캐시·React
  // 렌더 사이클 등 어떤 이유로든), iframe load 후 contentDocument 를
  // 직접 검사해 MathJax 가 없고 LaTeX 가 있으면 강제 inject 한다.
  useEffect(() => {
    const iframe = localRef.current;
    if (!iframe) return;
    const setup = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const docHtml = doc.documentElement?.outerHTML || '';
        if (!htmlHasLatex(docHtml)) return;
        if (doc.querySelector('script[src*="mathjax"], script[src*="tex-svg"]')) return;
        const style = doc.createElement('style');
        style.textContent = `mjx-container{display:inline-block !important;vertical-align:middle;line-height:normal}mjx-container[display="true"]{display:block !important;margin:1em 0 !important;text-align:center}mjx-container svg{display:inline-block;vertical-align:middle}`;
        doc.head.appendChild(style);
        const cfg = doc.createElement('script');
        cfg.textContent = `window.MathJax = { tex: { inlineMath: [['$','$'],['\\\\(','\\\\)']], displayMath: [['$$','$$'],['\\\\[','\\\\]']], processEscapes: true, packages: {'[+]': ['base','ams','noerrors','noundefined']} }, svg: { fontCache: 'global' }, options: { renderActions: { addMenu: [] } } };`;
        doc.head.appendChild(cfg);
        const s = doc.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        s.async = true;
        doc.head.appendChild(s);
      } catch (err) {
        console.warn('[PreviewIframe] MathJax fallback inject failed:', err);
      }
    };
    iframe.addEventListener('load', setup);
    if (iframe.contentDocument?.readyState === 'complete') setup();
    return () => iframe.removeEventListener('load', setup);
  }, [patchedHtml]);

  return (
    <iframe
      ref={(el) => {
        localRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      srcDoc={patchedHtml}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      onLoad={(e) => {
        // about:blank 첫 onLoad 무시 — iframe srcDoc 적용 전 빈 doc 의 load.
        const doc = e.target?.contentDocument;
        const html = doc?.documentElement?.outerHTML || '';
        if (html.length < 200) return;
        // onLoad = HTML 파싱 완료. tailwindcss CDN 같은 외부 script 의 JIT
        // 적용 + 큰 HTML (수백KB) paint 가 그 후에도 진행되므로 500ms 더 여유.
        setTimeout(() => {
          useAppStore.getState().dismissEditorTransition();
        }, 500);
      }}
      style={{
        width: `${viewportWidth}px`,
        height: `${viewportHeight}px`,
        border: 'none',
        display: 'block',
        background: '#ffffff',
      }}
      title="HTML Preview"
    />
  );
});

export default PreviewIframe;
