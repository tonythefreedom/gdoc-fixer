import { forwardRef, useEffect, useRef } from 'react';
import { patchYoutubeThumbnails } from '../../utils/youtubeThumbnail.js';
import { injectMathJax, htmlHasLatex } from '../../utils/injectMathJax.js';

const PreviewIframe = forwardRef(function PreviewIframe(
  { htmlContent, viewportWidth, viewportHeight },
  ref
) {
  // 모든 미리보기 경로(LLM 응답·Firestore 로드·기존 저장본·사용자 편집)의 HTML 이
  // 이 iframe 을 통과하므로, srcDoc 직전에 maxresdefault → hqdefault fallback 과
  // LaTeX 수식이 있을 때 MathJax 로더를 함께 주입한다.
  const patchedHtml = injectMathJax(patchYoutubeThumbnails(htmlContent));
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
