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
 *
 * 반환: { paragraphs: string[], paragraphXmls: string[] }
 *  - paragraphs[i]  : i 번째 단락의 텍스트
 *  - paragraphXmls[i]: i 번째 단락의 전체 <hp:p>…</hp:p> raw XML
 *    (applyParagraphsToHwpx 가 1:1 매핑으로 서식 보존에 사용)
 *
 * 하위호환: 반환된 배열에 `.xmls` 도 attach 해서, 기존에 `await ext...`
 * 결과를 그대로 array 처럼 쓰던 호출측도 동작하게 한다.
 */
export async function extractParagraphsFromHwpx(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  const xml = await sec.async('string');

  // apply 와 paragraph 정의를 통일해야 한다 — 이전 구현은 단순 regex 가
  // nested <hp:p> 의 첫 </hp:p> 에서 끊기는 바람에 표 안 셀 단락을
  // 제대로 못 세었다. 이제 시작 태그 위치 기반으로 같은 알고리즘 사용.
  const pStarts = [];
  const startTagRe = /<hp:p\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = startTagRe.exec(xml)) !== null) {
    if (m[2] === '/') continue; // self-closing 은 텍스트 없음 — 빈 단락 자리
    pStarts.push(m.index + m[0].length);
  }

  // header.xml 에서 charPr 별 italic / color 정보 추출 → 가이드 자동 판별.
  // 양식 관례: 가이드 문장은 italic + 회색/붉은색/파란색 텍스트.
  const headerFile = zip.file('Contents/header.xml');
  const charPrInfo = {}; // { id: { italic: bool, color: string | null } }
  if (headerFile) {
    const hxml = await headerFile.async('string');
    const cpRe = /<hh:charPr\s+id="(\d+)"[^>]*?textColor="([^"]*)"[^>]*>([\s\S]*?)<\/hh:charPr>/g;
    let cm;
    while ((cm = cpRe.exec(hxml)) !== null) {
      charPrInfo[cm[1]] = {
        italic: /<hh:italic\b/.test(cm[3]),
        color: cm[2],
      };
    }
  }

  const paragraphs = [];
  const widths = [];
  const isGuide = []; // paragraph 별 가이드 여부 (italic charPr 사용)
  for (let i = 0; i < pStarts.length; i++) {
    const startPos = pStarts[i];
    const endPos = i + 1 < pStarts.length ? pStarts[i + 1] : xml.length;
    const region = xml.slice(startPos, endPos);
    const tm = region.match(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/);
    paragraphs.push(tm ? decodeXmlEntities(tm[1]) : '');
    // 가이드 판정: italic + 검은색 아닌 색 (양식 관례상 회색/붉은/파란).
    // italic 만으로는 표 헤더 같은 강조 단락도 잡혀 광범위.
    const runM = region.match(/<hp:run\s+charPrIDRef="(\d+)"/);
    const cp = runM ? charPrInfo[runM[1]] : null;
    const colored = cp && cp.color && !/^#0{6}$/i.test(cp.color); // 검정색 제외
    isGuide.push(!!(cp && cp.italic && colored));
  }

  // 셀 width: <hp:tc> 의 자식 <hp:cellSz width="..."/> 가 실제 셀 폭.
  // 다만 XML 구조상 <hp:p> 가 <hp:cellSz> 보다 먼저 나옴:
  //   <hp:tc>
  //     <hp:subList>
  //       <hp:p>...</hp:p>        ← paragraph 먼저
  //     </hp:subList>
  //     <hp:cellSz width="..."/>  ← width 는 뒤
  //   </hp:tc>
  // → tc 안 paragraph 의 인덱스를 모아두고, tc 가 닫히면 그때 width 일괄 적용.
  const PAGE_W = 48000; // 표 밖 단락의 페이지 폭 (HWPUNIT)
  const tcStack = []; // [{width, paraIndices: []}]
  let pIdx = 0;
  const tokenRe = /<(\/?)(hp:tc|hp:p|hp:cellSz)\b([^>]*?)(\/?)>/g;
  let m2;
  while ((m2 = tokenRe.exec(xml)) !== null) {
    const close = m2[1] === '/';
    const tag = m2[2];
    const attrs = m2[3];
    const self = m2[4] === '/';
    if (tag === 'hp:tc') {
      if (close) {
        const top = tcStack.pop();
        if (top && top.width != null) {
          for (const pi of top.paraIndices) widths[pi] = top.width;
        }
      } else {
        tcStack.push({ width: null, paraIndices: [] });
      }
    } else if (tag === 'hp:cellSz') {
      const wm = attrs.match(/\bwidth="(\d+)"/);
      if (wm && tcStack.length > 0) {
        tcStack[tcStack.length - 1].width = parseInt(wm[1], 10);
      }
    } else if (tag === 'hp:p' && !close && !self) {
      if (tcStack.length > 0) {
        tcStack[tcStack.length - 1].paraIndices.push(pIdx);
      } else {
        widths[pIdx] = PAGE_W; // 표 밖 단락
      }
      pIdx++;
    }
  }

  paragraphs.xmls = [];
  paragraphs.widths = widths;
  paragraphs.isGuide = isGuide;
  return paragraphs;
}

/**
 * 기존 HWPX bytes 의 단락별 raw XML 을 template 로 사용해, 새 paragraph 배열로
 * 본문 단락을 교체한 새 HWPX bytes 를 반환.
 *
 * 핵심: **원본 단락별 1:1 서식 보존**.
 *  - 첫 단락만 template 로 쓰면 첫 단락이 제목/큰글자/페이지마진 스타일일 때
 *    모든 단락이 그 서식을 받아 한 페이지에 한 줄씩 출력되는 문제 발생.
 *  - 원본의 i 번째 단락 XML 을 i 번째 새 단락의 template 로 사용해
 *    원본 단락별 서식 (paraPrIDRef, styleIDRef 등) 을 그대로 유지.
 *
 * originalXmls 가 비어있거나 누락된 인덱스가 있으면 마지막 원본 단락 또는
 * 가장 짧은 단순한 단락 template 으로 fallback.
 *
 * 단락 수가 늘어난 경우 (M > N): 추가 단락은 본문성 단락 중 가장 흔한 짧은
 * template (보통 본문 단락) 으로 채움.
 */
export async function applyParagraphsToHwpx(bytes, paragraphs, originalXmls = []) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    throw new Error('paragraphs 가 비어 있습니다.');
  }
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  const xml = await sec.async('string');

  // HWPX paragraph 구조는 nested — <hp:p> 안에 <hp:tbl><hp:tr><hp:tc><hp:subList>
  // <hp:p> 가 들어있다. 이전 구현은 모든 <hp:p>...</hp:p> 영역을 새 단락 XML
  // 로 **대체** 했는데, 그 과정에서 <hp:tc>, <hp:subList> 같은 표 구조 자체가
  // 사라져 XML 이 깨졌고 한컴이 손상된 파일로 인식.
  //
  // 새 전략: **구조는 그대로 두고 텍스트만 in-place 교체**.
  //   - 모든 <hp:p ...> 시작 태그 위치 수집 (nested 도 별도 paragraph 로 카운트
  //     — extract 와 일관)
  //   - paragraph i 의 영역 = i 번째 <hp:p> 시작 ~ i+1 번째 <hp:p> 시작 직전
  //   - 그 영역의 첫 <hp:t>...</hp:t> 텍스트만 paragraphs[i] 로 교체
  //   - <hp:tbl>, <hp:linesegarray>, <hp:run> 등 모든 구조 보존
  const pStarts = [];
  const startTagRe = /<hp:p\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = startTagRe.exec(xml)) !== null) {
    if (m[2] === '/') continue; // self-closing <hp:p .../> 은 텍스트 자리 없음
    pStarts.push(m.index + m[0].length);
  }

  if (pStarts.length === 0) {
    throw new Error('단락(<hp:p>) 를 찾을 수 없습니다.');
  }
  if (pStarts.length !== paragraphs.length) {
    throw new Error(
      `paragraph count mismatch: HWPX 에 ${pStarts.length}개, 새 paragraphs ${paragraphs.length}개. ` +
      `LLM 응답 길이를 ${pStarts.length}개로 맞춰 주세요.`
    );
  }

  // 뒤에서부터 처리 — 앞쪽 슬라이스 인덱스가 무너지지 않게.
  // 첫 <hp:t> 텍스트만 in-place 교체. paraPrIDRef 는 원본 그대로 유지
  // (원본의 "첫 줄 = 보통" 서식 유지).
  let result = xml;
  for (let i = pStarts.length - 1; i >= 0; i--) {
    const startPos = pStarts[i];
    const endPos = i + 1 < pStarts.length ? pStarts[i + 1] : result.length;
    const region = result.slice(startPos, endPos);
    const replaced = region.replace(
      /(<hp:t\b[^>]*>)([\s\S]*?)(<\/hp:t>)/,
      (_full, open, _txt, close) => open + escapeXml(paragraphs[i]) + close
    );
    if (replaced !== region) {
      result = result.slice(0, startPos) + replaced + result.slice(endPos);
    }
  }

  const newXml = result;

  // header.xml 처리:
  //  1) <hh:italic/> 제거 — 양식의 가이드 안내문이 italic charPr 를 쓰는데,
  //     in-place 교체 시 charPrIDRef 가 유지되어 새 본문도 italic 으로 표시됨.
  //     가이드 안내문 자체가 사용자 본문으로 대체되니 italic 손실은 영향 없음.
  //  2) (별도 단계) paraPr 의 hanging indent 적용은 paragraph 의 paraPrIDRef
  //     변경이 필요 — 다음 fix 에서 처리.
  let headerXml = null;
  const headerFile = zip.file('Contents/header.xml');
  if (headerFile) {
    headerXml = await headerFile.async('string');
    headerXml = headerXml.replace(/<hh:italic\s*\/>/g, '');
  }

  // HWPX 는 OPC 표준 — mimetype 파일이 **첫 entry + 비압축 (STORE)** 이어야
  // 한컴/한글 reader 가 인식한다. JSZip 의 기본 generateAsync 는 모든 파일을
  // 같은 compression 으로 묶고 디렉터리 entry 도 자동 추가 → 출력이 표준 위반
  // 되어 손상된 것으로 인식. 새 ZIP 을 직접 빌드해 순서/압축/디렉터리를 통제.
  const JSZipCtor = JSZip;
  const out = new JSZipCtor();
  // 1) mimetype 먼저 + STORE 압축
  const mimeFile = zip.file('mimetype');
  if (!mimeFile) throw new Error('HWPX mimetype entry 가 없습니다.');
  const mimeData = await mimeFile.async('uint8array');
  out.file('mimetype', mimeData, { compression: 'STORE', createFolders: false });
  // 2) 나머지 파일들 (디렉터리 entry 제외, mimetype 제외) DEFLATE.
  //    createFolders: false — JSZip 가 'Contents/', 'META-INF/' 같은 빈
  //    디렉터리 entry 를 자동 추가하는 걸 막는다 (원본 HWPX 에 없음).
  for (const [name, file] of Object.entries(zip.files)) {
    if (name === 'mimetype') continue;
    if (file.dir) continue;
    let data;
    if (name === SECTION_PATH) data = newXml;
    else if (name === 'Contents/header.xml' && headerXml != null) data = headerXml;
    else data = await file.async('uint8array');
    out.file(name, data, {
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      createFolders: false,
    });
  }
  return await out.generateAsync({ type: 'uint8array' });
}
