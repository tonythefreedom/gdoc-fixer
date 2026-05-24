// LaTeX 수식이 포함된 HTML 에 MathJax 로더를 자동 주입한다.
// preview / share / slide 모든 iframe srcdoc 경로에서 사용.

const MATHJAX_SNIPPET = `
<style>
  /* 인라인 수식이 한 줄에 자연스럽게 흐르도록 강제 (Tailwind preflight 보정) */
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

const LATEX_PATTERNS = [
  /\$\$[\s\S]+?\$\$/,
  /\\\([\s\S]+?\\\)/,
  /\\\[[\s\S]+?\\\]/,
];

export function htmlHasLatex(html) {
  if (!html || typeof html !== 'string') return false;
  return LATEX_PATTERNS.some((p) => p.test(html));
}

function hasMathJaxAlready(html) {
  return /mathjax|tex-svg\.js|tex-chtml\.js|tex-mml/i.test(html);
}

// LLM 이 출력한 HTML 안의 LaTeX 식에는 백슬래시가 이중(\\beta, \\frac)
// 으로 들어오는 경우가 흔하다. MathJax 는 단일 백슬래시(\beta)를 기대하므로
// 수식 영역 안에서만 \\ → \ 로 정규화한다.
// false positive 방지: $...$ 인라인은 LaTeX 명령어(\\[a-zA-Z]+)가
// 포함된 경우에만 처리해서 \"$5\" 같은 일반 텍스트는 건드리지 않는다.
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

export function injectMathJax(html) {
  if (!htmlHasLatex(html)) return html;
  let out = normalizeLatexEscapes(html);
  if (hasMathJaxAlready(out)) return out;
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
