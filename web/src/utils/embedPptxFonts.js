/**
 * PPTX 폰트 임베드 후처리 (브라우저).
 *
 * PptxGenJS 는 fontFace 이름만 넣고 실제 폰트를 임베드하지 않아, 해당 폰트가 없는
 * PC 에서 세리프 등으로 폴백된다. 이 유틸은 PptxGenJS 가 만든 .pptx blob 을 받아:
 *   1) 슬라이드 XML 에서 사용된 typeface + 글자(코드포인트) 수집
 *   2) Pretendard(TTF) 를 CDN 에서 받아 '사용된 글자만' 서브셋(subset-font)
 *   3) ppt/fonts/*.fntdata 로 임베드하고 presentation.xml / rels / [Content_Types] 갱신
 * 결과: 어느 PC 에서든 동일 렌더 + 텍스트 편집 유지 + 경량(서브셋).
 *
 * 주의:
 * - 임베드 폰트는 MS PowerPoint(Win/Mac)에서만 적용된다. Keynote/Google Slides 는 무시.
 * - 지금은 sans 계열(→ Pretendard)만 임베드한다. 한글 serif(Noto Serif KR 등)는 CJK 풀셋이
 *   수십 MB 라 런타임 fetch 에 부적합해 스킵한다(콘솔 경고).
 * - 실패해도 원본 blob 을 그대로 반환하여 export 자체는 절대 막지 않는다.
 */

// Pretendard 로 흡수(표준화)할 sans/한글-sans/제네릭 typeface.
const PRETENDARD_ALIASES = new Set([
  'pretendard', 'pretendard variable', 'noto sans kr', 'notosanskr',
  'malgun gothic', 'apple sd gothic neo', 'applesdgothicneo', 'nanumgothic',
  'nanum gothic', 'spoqa han sans neo', 'sans-serif', 'system-ui',
  'arial', 'helvetica', 'helvetica neue', 'inter', 'roboto', 'pretendard std',
]);

// 버전 핀 CDN (TrueType/alternative — glyf 기반이라 PPTX 임베드에 안전)
const PRETENDARD_URLS = {
  regular: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/alternative/Pretendard-Regular.ttf',
  bold: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/alternative/Pretendard-Bold.ttf',
};

const REL_FONT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';

const _fontCache = {};
async function fetchFontBuffer(url) {
  if (_fontCache[url]) return _fontCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`폰트 다운로드 실패 (${res.status}) ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  _fontCache[url] = buf;
  return buf;
}

function decodeXmlText(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function wantsPretendard(typeface) {
  return PRETENDARD_ALIASES.has(typeface.trim().toLowerCase());
}

/**
 * @param {Blob} blob PptxGenJS 가 생성한 .pptx blob
 * @returns {Promise<Blob>} 폰트가 임베드된 새 blob (실패 시 원본)
 */
export async function embedPptxFonts(blob) {
  try {
    const [{ default: JSZip }, { default: subsetFont }] = await Promise.all([
      import('jszip'),
      import('subset-font'),
    ]);

    const zip = await JSZip.loadAsync(blob);

    // 1) typeface + 사용 글자 수집
    const xmlNames = Object.keys(zip.files).filter((n) =>
      /^ppt\/(slides|slideLayouts|slideMasters)\/[^/]+\.xml$/.test(n)
    );
    const typefaces = new Set();
    let chars = '';
    for (const name of xmlNames) {
      const xml = await zip.file(name).async('string');
      for (const m of xml.matchAll(/typeface="([^"]+)"/g)) {
        if (m[1] && !m[1].startsWith('+')) typefaces.add(m[1]);
      }
      for (const m of xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)) chars += decodeXmlText(m[1]);
    }

    const embedNames = [...typefaces].filter(wantsPretendard);
    const skipped = [...typefaces].filter((t) => !wantsPretendard(t));
    if (embedNames.length === 0) {
      if (skipped.length) console.info('[pptxFont] Pretendard 로 흡수할 typeface 없음. 스킵:', skipped);
      return blob;
    }

    // 편집 여유로 기본 ASCII 포함
    let text = chars;
    for (let c = 0x20; c < 0x7f; c++) text += String.fromCharCode(c);

    // 2) Pretendard reg/bold 서브셋 (sfnt = TTF/OTF 바이너리)
    const [regBuf, boldBuf] = await Promise.all([
      fetchFontBuffer(PRETENDARD_URLS.regular),
      fetchFontBuffer(PRETENDARD_URLS.bold),
    ]);
    const B = (u8) => (typeof Buffer !== 'undefined' ? Buffer.from(u8) : u8);
    const [regSub, boldSub] = await Promise.all([
      subsetFont(B(regBuf), text, { targetFormat: 'sfnt' }),
      subsetFont(B(boldBuf), text, { targetFormat: 'sfnt' }),
    ]);

    // 3) 폰트 파트 2개 추가 (모든 typeface 가 공유 → 중복 제거)
    zip.file('ppt/fonts/font1.fntdata', regSub);
    zip.file('ppt/fonts/font2.fntdata', boldSub);

    // 3a) presentation.xml.rels: 폰트 관계 2개
    const relsPath = 'ppt/_rels/presentation.xml.rels';
    let rels = await zip.file(relsPath).async('string');
    const usedIds = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
    let nextId = (usedIds.length ? Math.max(...usedIds) : 0) + 1;
    const regRid = `rId${nextId++}`;
    const boldRid = `rId${nextId++}`;
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${regRid}" Type="${REL_FONT}" Target="fonts/font1.fntdata"/>` +
      `<Relationship Id="${boldRid}" Type="${REL_FONT}" Target="fonts/font2.fntdata"/>` +
      '</Relationships>'
    );
    zip.file(relsPath, rels);

    // 3b) presentation.xml: embedTrueTypeFonts + embeddedFontLst
    const presPath = 'ppt/presentation.xml';
    let pres = await zip.file(presPath).async('string');
    let attrs = '';
    if (!pres.includes('embedTrueTypeFonts')) attrs += ' embedTrueTypeFonts="1"';
    if (!pres.includes('saveSubsetFonts')) attrs += ' saveSubsetFonts="1"';
    if (attrs) pres = pres.replace(/(<p:presentation\b[^>]*?)>/, `$1${attrs}>`);

    const fontList = embedNames
      .map((tf) => {
        const esc = tf.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        return `<p:embeddedFont><p:font typeface="${esc}"/><p:regular r:id="${regRid}"/><p:bold r:id="${boldRid}"/></p:embeddedFont>`;
      })
      .join('');
    const block = `<p:embeddedFontLst>${fontList}</p:embeddedFontLst>`;
    // 스키마 순서: notesSz 뒤 (없으면 sldIdLst 뒤)
    if (/<p:notesSz\b[^>]*\/>/.test(pres)) {
      pres = pres.replace(/(<p:notesSz\b[^>]*\/>)/, `$1${block}`);
    } else if (pres.includes('</p:sldIdLst>')) {
      pres = pres.replace('</p:sldIdLst>', `</p:sldIdLst>${block}`);
    } else {
      pres = pres.replace('</p:presentation>', `${block}</p:presentation>`);
    }
    zip.file(presPath, pres);

    // 3c) [Content_Types].xml: fntdata Default
    const ctPath = '[Content_Types].xml';
    let ct = await zip.file(ctPath).async('string');
    if (!ct.includes('Extension="fntdata"')) {
      ct = ct.replace('</Types>', '<Default Extension="fntdata" ContentType="application/x-fontdata"/></Types>');
      zip.file(ctPath, ct);
    }

    console.info(
      `[pptxFont] Pretendard 임베드 완료 — typeface [${embedNames.join(', ')}], 글자 ${chars.length}, ` +
      `폰트 ${((regSub.length + boldSub.length) / 1024).toFixed(0)}KB` +
      (skipped.length ? ` (스킵: ${skipped.join(', ')})` : '')
    );

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      compression: 'DEFLATE',
    });
  } catch (e) {
    console.warn('[pptxFont] 폰트 임베드 실패 — 원본 PPTX 유지:', e);
    return blob;
  }
}
