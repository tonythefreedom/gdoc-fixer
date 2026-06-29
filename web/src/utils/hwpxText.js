import JSZip from 'jszip';

// HWPX 의 본문은 Contents/section0.xml ~ sectionN.xml 에 있다.
// <hp:p> = 단락, <hp:run> = 동일 서식의 run, <hp:t> = 텍스트 노드.
const SECTION_PATH = 'Contents/section0.xml';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * HWPX bytes 에서 본문 단락의 plain text 배열을 추출.
 * 한 <hp:p> 내부의 모든 <hp:t> 텍스트를 join 해 한 단락으로.
 */
export async function extractParagraphsFromHwpx(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  const xml = await sec.async('string');

  const paragraphs = [];
  const pRe = /<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g;
  const tRe = /<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g;
  let pm;
  while ((pm = pRe.exec(xml)) !== null) {
    const inner = pm[1];
    const parts = [];
    let tm;
    while ((tm = tRe.exec(inner)) !== null) {
      parts.push(decodeXmlEntities(tm[1]));
    }
    paragraphs.push(parts.join(''));
  }
  return paragraphs;
}

/**
 * 기존 HWPX bytes 의 첫 <hp:p> 를 template 로 사용해, 새 paragraph 배열로
 * 본문 단락을 교체한 새 HWPX bytes 를 반환.
 *
 * 전략:
 * - 첫 <hp:p>...</hp:p> 전체를 template 로 캡처
 * - template 안의 첫 <hp:t> 안 텍스트만 paragraph 텍스트로 교체,
 *   나머지 <hp:t> 들은 빈 문자열로 (run 마다 글자 쪼개진 경우 합치는 효과)
 * - 모든 기존 <hp:p> 영역을 새 단락 N 개로 대체
 *
 * 서식은 첫 단락의 서식을 모든 단락이 상속. 그 외 header/footer/page settings/
 * 글꼴 정의 등은 base 그대로 유지.
 */
export async function applyParagraphsToHwpx(bytes, paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    throw new Error('paragraphs 가 비어 있습니다.');
  }
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  let xml = await sec.async('string');

  // 첫 <hp:p>...</hp:p> 찾기
  const firstPStart = xml.search(/<hp:p\b/);
  if (firstPStart < 0) throw new Error('단락(<hp:p>) 를 찾을 수 없습니다.');
  const firstPCloseIdx = xml.indexOf('</hp:p>', firstPStart);
  if (firstPCloseIdx < 0) throw new Error('단락 종료 태그를 찾을 수 없습니다.');
  const firstPEnd = firstPCloseIdx + '</hp:p>'.length;
  const template = xml.slice(firstPStart, firstPEnd);

  // 마지막 </hp:p> 위치 — 전체 단락 영역 끝
  const lastPClose = xml.lastIndexOf('</hp:p>');
  const lastPEnd = lastPClose + '</hp:p>'.length;

  // 새 단락 빌드: template 의 첫 <hp:t> 만 text 로 교체, 나머지 <hp:t> 는 비움
  const buildParagraphXml = (text) => {
    let first = true;
    return template.replace(/<hp:t\b([^>]*)>([\s\S]*?)<\/hp:t>/g, (_, attrs) => {
      if (first) {
        first = false;
        return `<hp:t${attrs}>${escapeXml(text)}</hp:t>`;
      }
      return `<hp:t${attrs}></hp:t>`;
    });
  };

  const newParagraphsXml = paragraphs.map(buildParagraphXml).join('\n');

  const before = xml.slice(0, firstPStart);
  const after = xml.slice(lastPEnd);
  const newXml = before + newParagraphsXml + after;

  zip.file(SECTION_PATH, newXml);
  // HWPX 의 OPC mimetype 파일은 압축 없이 저장되어야 하지만 JSZip 의 기본
  // generateAsync 는 통과한다. 필요 시 옵션 추가.
  const out = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return out;
}
