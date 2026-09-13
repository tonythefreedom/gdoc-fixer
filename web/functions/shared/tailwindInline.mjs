/**
 * 게시-경계 정규화의 **서버 버전** — 프론트 web/src/utils/normalizeForPublish.js 대응.
 *
 * 왜 필요한가:
 *   기획안 조립 프롬프트는 Tailwind Play CDN 을 쓰는 자기완결 HTML 을 만든다.
 *   그런데 tech-blog(publishToTechBlog 의 normalizeHtmlDeterministic)와 커뮤니티
 *   (aidev-home 의 sanitize)는 class 와 <style> 을 통째로 제거하고 인라인 style="" 만
 *   살린다. 따라서 게시 전에 "클래스로 준 스타일"을 인라인으로 구워두지 않으면
 *   여백·색·타이포가 전부 소실된다.
 *
 *   프론트는 이 굽기를 오프스크린 iframe + Tailwind CDN + getComputedStyle 로 한다.
 *   서버에는 브라우저가 없으므로 같은 일을 Tailwind 의 JIT 컴파일러(Node)로
 *   CSS 를 만들고 juice 로 인라인화해서 수행한다.
 *
 * 프론트와의 동등성:
 *   · preflight 제외 — 프론트도 iframe 기본값(=preflight 적용 상태)과 "다른 값"만
 *     인라인화하므로 preflight 자체는 구워지지 않는다. corePlugins.preflight=false 가
 *     그 동작과 일치한다.
 *   · 미디어쿼리(sm:/md:/lg:)는 인라인 불가라 버려진다. 프론트도 고정 폭(820px)
 *     기준의 계산값만 굽기 때문에 결과가 같다.
 *
 * 실패해도 절대 게시를 막지 않는다 — 원본 HTML 을 그대로 돌려준다.
 */
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import juice from 'juice';

/** Tailwind Play CDN 로더와 설정 스크립트, 폰트 link 는 인라인화 후 쓸모가 없다. */
function stripTailwindLoaders(html) {
  return html
    .replace(/<script\b[^>]*src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*>\s*tailwind\.config\s*=[\s\S]*?<\/script>/gi, '');
}

/**
 * HTML 안에서 실제로 쓰인 Tailwind 클래스에 대한 CSS 를 생성한다.
 * content 에 raw HTML 을 그대로 물려 JIT 가 필요한 유틸만 뽑게 한다.
 */
async function buildTailwindCss(html) {
  const result = await postcss([
    tailwindcss({
      content: [{ raw: html, extension: 'html' }],
      corePlugins: { preflight: false },
      // 다크모드 변형은 인라인화할 수 없으므로 생성하지 않는다.
      darkMode: 'class',
    }),
  ]).process('@tailwind components;\n@tailwind utilities;', { from: undefined });
  return result.css;
}

/**
 * Tailwind 클래스와 <style> 블록을 인라인 style="" 로 굽는다.
 * @param {string} html 기획안 조립 결과 HTML (전체 문서 또는 조각)
 * @returns {Promise<string>} 인라인 스타일만으로 자립하는 HTML
 */
export async function inlineTailwind(html) {
  if (!html || typeof html !== 'string') return html;

  const startedAt = Date.now();
  try {
    const css = await buildTailwindCss(html);
    // juice.inlineContent 는 인자로 준 CSS 만 적용한다. 문서 안에 남아 있는
    // <style> 블록까지 함께 굽기 위해 juice(html, {extraCss}) 형태를 쓴다.
    const inlined = juice(html, {
      extraCss: css,
      // 코드블록 규칙이 font-family:...!important 에 의존한다 (tech-blog 가
      // font-family: inherit !important 로 덮어쓰기 때문). 반드시 보존.
      preserveImportant: true,
      // 문서에 남아 있는 <style> 블록도 함께 인라인화하고 태그는 제거한다.
      applyStyleTags: true,
      removeStyleTags: true,
      // @media 규칙은 인라인 대상이 아니다. 남겨봐야 downstream 이 <style> 을
      // 지우므로 그대로 버린다(프론트 고정폭 굽기와 동일한 결과).
      preserveMediaQueries: false,
      inlinePseudoElements: false,
    });

    const out = stripTailwindLoaders(inlined);
    console.log(
      `[tailwindInline] ${(html.length / 1024).toFixed(0)}KB → ${(out.length / 1024).toFixed(0)}KB in ${((Date.now() - startedAt) / 1000).toFixed(1)}s (css ${(css.length / 1024).toFixed(0)}KB)`
    );
    return out;
  } catch (err) {
    console.warn(`[tailwindInline] 인라인화 실패 — 원본 게시로 진행: ${err.message}`);
    return html;
  }
}
