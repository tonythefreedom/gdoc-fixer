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

const SUB_AREA_TAGS = ['hp:header', 'hp:footer', 'hp:footNote', 'hp:endNote'];

/**
 * 머리말·꼬리말·각주 영역을 **같은 길이의 공백으로 덮는다.**
 *
 * 이 영역들 안에도 <hp:p> 와 <hp:tbl> 이 들어 있다. 본문과 함께 세면 단락 번호가
 * 밀리고(머리말 표가 본문 앞에 있으면 "[신청서]" 같은 칸이 통째로 밀려 사라진다),
 * 텍스트도 "머리말표[신청서]" 처럼 섞인다.
 *
 * 잘라내지 않고 덮는 이유는 위치 기반으로 교체하기 때문이다. 길이가 달라지면
 * 모든 인덱스가 어긋난다.
 */
function maskSubAreas(xml) {
  let out = xml;
  for (const tag of SUB_AREA_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`, 'g'), (m) => ' '.repeat(m.length));
  }
  return out;
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
  // 머리말·꼬리말 안의 단락은 본문이 아니다. 덮어두고 센다.
  const scan = maskSubAreas(xml);
  const pStarts = [];
  const startTagRe = /<hp:p\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = startTagRe.exec(scan)) !== null) {
    if (m[2] === '/') continue; // self-closing 은 텍스트 없음 — 빈 단락 자리
    pStarts.push(m.index + m[0].length);
  }

  // header.xml 에서 charPr 별 italic / color 정보 추출 → 가이드 자동 판별.
  // 양식 관례: 가이드 문장은 italic + 회색/붉은색/파란색 텍스트.
  const headerFile = zip.file('Contents/header.xml');
  const charPrInfo = {}; // { id: { italic: bool, color: string | null } }
  let plainCharPr = null; // 검정 + 기울임 없음 — 안내문 자리에 쓸 때 물려받을 서식
  if (headerFile) {
    const hxml = await headerFile.async('string');
    const cpRe = /<hh:charPr\s+id="(\d+)"[^>]*?textColor="([^"]*)"[^>]*>([\s\S]*?)<\/hh:charPr>/g;
    let cm;
    while ((cm = cpRe.exec(hxml)) !== null) {
      const italic = /<hh:italic\b/.test(cm[3]);
      charPrInfo[cm[1]] = { italic, color: cm[2] };
      // 굵기까지 보통인 것을 우선한다. 안내문을 지우고 쓴 본문이 파랗거나 기울어지면 안 된다.
      if (plainCharPr === null && !italic && /^#0{6}$/i.test(cm[2]) && !/<hh:bold\b/.test(cm[3])) {
        plainCharPr = cm[1];
      }
    }
  }

  const paragraphs = [];
  const widths = [];
  const isGuide = []; // paragraph 별 가이드 여부 (italic charPr 사용)
  const hasTable = []; // 표를 감싸는 구조용 단락인지
  for (let i = 0; i < pStarts.length; i++) {
    const startPos = pStarts[i];
    const endPos = i + 1 < pStarts.length ? pStarts[i + 1] : xml.length;
    const region = scan.slice(startPos, endPos); // 머리말 영역이 덮인 사본
    // 한 단락이 여러 런(<hp:run>)으로 쪼개져 있는 일이 흔하다. 예를 들어 체크박스 칸은
    // ["  ", "□ AI 반도체"] 처럼 나뉜다. 첫 런만 읽으면 "□ AI 반도체" 가 빈 칸으로 보여
    // "원본에 글자가 없다"고 오판하게 되므로, 런 전체를 이어붙여 단락의 실제 텍스트를 만든다.
    const texts = [...region.matchAll(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g)].map((m) =>
      decodeXmlEntities(m[1])
    );
    paragraphs.push(texts.join(''));
    // 표를 품은 단락인지. 여기에 글자를 넣으면 표 앞에 텍스트가 끼어 레이아웃이 깨진다.
    // "텍스트가 없다"와 "구조용이다"는 다른 얘기다 — 양식에는 채우라고 비워둔 빈 칸이 많다.
    // 머리말·꼬리말 컨트롤이 본문 표보다 앞에 있으면, 그 안의 표까지 이 단락의 것으로
    // 세어 엉뚱한 단락이 "구조용"이 된다. 그러면 apply 가 그 칸을 빈 문자열로 되돌려
    // "[신청서]" 같은 글자가 사라진다. 별도 영역은 빼고 판정한다.
    hasTable.push(/<hp:tbl\b/.test(region));
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
  // 표 위치 정보 — 어느 단락이 몇 번째 표의 몇 행 몇 열인지.
  // 외부 에이전트가 양식을 이해하려면 셀 폭만으로는 부족하다(같은 폭의 셀이 여러 행에 걸침).
  const cells = {}; // paraIndex -> { table, row, col }
  const tables = []; // [{ index, rows, cols, paragraphs: [] }]
  const tblStack = []; // 중첩 표 대응
  let rowIdx = -1;
  let colIdx = -1;

  const tokenRe = /<(\/?)(hp:tbl|hp:tr|hp:tc|hp:p|hp:cellSz)\b([^>]*?)(\/?)>/g;
  let m2;
  while ((m2 = tokenRe.exec(scan)) !== null) {
    const close = m2[1] === '/';
    const tag = m2[2];
    const attrs = m2[3];
    const self = m2[4] === '/';

    if (tag === 'hp:tbl') {
      if (close) {
        const t = tblStack.pop();
        if (t) {
          tables[t.index].rows = t.rowCount;
          tables[t.index].cols = t.maxCols;
        }
        rowIdx = tblStack.length ? tblStack[tblStack.length - 1].rowCount - 1 : -1;
      } else {
        const index = tables.length;
        tables.push({ index, rows: 0, cols: 0, paragraphs: [] });
        tblStack.push({ index, rowCount: 0, maxCols: 0 });
      }
    } else if (tag === 'hp:tr' && !close && !self) {
      const t = tblStack[tblStack.length - 1];
      if (t) {
        rowIdx = t.rowCount;
        t.rowCount++;
        colIdx = -1;
      }
    } else if (tag === 'hp:tc') {
      if (close) {
        const top = tcStack.pop();
        if (top && top.width != null) {
          for (const pi of top.paraIndices) widths[pi] = top.width;
        }
      } else {
        const t = tblStack[tblStack.length - 1];
        if (t) {
          colIdx++;
          if (colIdx + 1 > t.maxCols) t.maxCols = colIdx + 1;
        }
        tcStack.push({ width: null, paraIndices: [], table: t ? t.index : null, row: rowIdx, col: colIdx });
      }
    } else if (tag === 'hp:cellSz') {
      const wm = attrs.match(/\bwidth="(\d+)"/);
      if (wm && tcStack.length > 0) {
        tcStack[tcStack.length - 1].width = parseInt(wm[1], 10);
      }
    } else if (tag === 'hp:p' && !close && !self) {
      if (tcStack.length > 0) {
        const tc = tcStack[tcStack.length - 1];
        tc.paraIndices.push(pIdx);
        if (tc.table != null) {
          cells[pIdx] = { table: tc.table, row: tc.row, col: tc.col };
          tables[tc.table].paragraphs.push(pIdx);
        }
      } else {
        widths[pIdx] = PAGE_W; // 표 밖 단락
      }
      pIdx++;
    }
  }

  paragraphs.xmls = [];
  paragraphs.widths = widths;
  paragraphs.isGuide = isGuide;
  paragraphs.hasTable = hasTable; // 표를 품은 구조용 단락
  paragraphs.plainCharPr = plainCharPr; // 검정·보통 charPr id (안내문 자리에 쓸 서식)
  paragraphs.cells = cells;   // paraIndex -> { table, row, col }
  paragraphs.tables = tables; // [{ index, rows, cols, paragraphs }]
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
/** 체크 기호 한 글자만 달라졌는지 본다. 그렇다면 그 글자만 바꾸는 편이 서식에 안전하다. */
const CHECK_MARKS = ['□', '☑', '■', '▣', '☐', '✓', '✔', '○', '●'];
function detectCheckboxToggle(before, after) {
  if (!before || !after) return null;
  if (before.length !== after.length) return null;
  let diff = null;
  for (let k = 0; k < before.length; k++) {
    if (before[k] === after[k]) continue;
    if (diff) return null; // 두 글자 이상 다르면 일반 교체
    if (!CHECK_MARKS.includes(before[k]) || !CHECK_MARKS.includes(after[k])) return null;
    diff = { from: before[k], to: after[k] };
  }
  return diff;
}

/**
 * 셀 폭(HWPUNIT)으로 한 줄에 들어갈지 가늠한다.
 * 한글 한 글자를 약 1000 HWPUNIT(10pt 기준)으로 보고 여유를 둔다.
 * 폭을 모르면 판단하지 않는다(null) — 멀쩡한 칸을 건드리지 않기 위해.
 */
function fitsOneLine(text, width) {
  if (!width || !Number.isFinite(width)) return null;
  const perChar = 1000;
  const capacity = Math.floor((width * 0.92) / perChar);
  return text.length <= capacity;
}

export async function applyParagraphsToHwpx(bytes, paragraphs, originalXmls = []) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    throw new Error('paragraphs 가 비어 있습니다.');
  }
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  const xml = await sec.async('string');
  // extract 와 같은 기준으로 세야 단락 번호가 맞는다.
  const scanXml = maskSubAreas(xml);

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
  while ((m = startTagRe.exec(scanXml)) !== null) {
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

  // 문서에서 가장 흔한 charPrIDRef — 런을 새로 만들어야 할 때 서식 기준으로 쓴다.
  const charPrCounts = {};
  for (const m of xml.matchAll(/<hp:run\s+charPrIDRef="(\d+)"/g)) {
    charPrCounts[m[1]] = (charPrCounts[m[1]] || 0) + 1;
  }
  const commonCharPr =
    Object.entries(charPrCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '0';

  // 셀 폭·안내문 여부·검정 서식은 추출 쪽 계산을 그대로 쓴다(판정 기준을 한 곳에 둔다).
  const meta = await extractParagraphsFromHwpx(bytes);
  const widths = meta.widths || [];
  const plainCharPr = meta.plainCharPr || null;
  const isGuideAt = (idx) => !!meta.isGuide?.[idx];

  // 뒤에서부터 처리 — 앞쪽 슬라이스 인덱스가 무너지지 않게.
  // paraPrIDRef 는 건드리지 않는다(원본 단락 서식 유지).
  let result = xml;
  const needsWrap = []; // 줄바꿈을 허용해야 하는 단락의 시작 위치
  for (let i = pStarts.length - 1; i >= 0; i--) {
    const startPos = pStarts[i];
    const endPos = i + 1 < pStarts.length ? pStarts[i + 1] : result.length;
    const region = result.slice(startPos, endPos);
    const text = paragraphs[i];

    // 머리말 영역을 덮은 사본에서 런을 찾는다(인덱스는 원본과 같다).
    // 그래야 머리말 안의 <hp:t> 를 이 단락의 첫 런으로 오인하지 않는다.
    const runs = [...maskSubAreas(region).matchAll(/(<hp:t\b[^>]*>)([\s\S]*?)(<\/hp:t>)/g)];
    const current = runs.map((m) => decodeXmlEntities(m[2])).join('');

    // 앞뒤 공백만 다른 경우는 건드리지 않는다. 다시 쓰면 서식·줄정보만 흔들리고
    // 바뀐 게 없는데 "변경됨"으로 집계된다.
    if (current.trim() === text.trim()) continue;

    let replaced = null;

    // ── 체크박스는 기호 한 글자만 바꾼다 ──
    // 양식의 체크 칸은 보통 "□"(굵게)와 항목명(보통)이 다른 런으로 나뉘어 있다.
    // 전체를 첫 런에 합치면 항목명까지 굵어지므로, 기호만 제자리에서 교체한다.
    const boxChange = detectCheckboxToggle(current, text);
    if (boxChange && runs.length > 0) {
      let seen = 0;
      let out = '';
      let cursor = 0;
      for (const m of runs) {
        const runText = decodeXmlEntities(m[2]);
        const idx = runText.indexOf(boxChange.from);
        out += region.slice(cursor, m.index);
        if (idx !== -1 && seen === 0) {
          seen = 1;
          const swapped = runText.slice(0, idx) + boxChange.to + runText.slice(idx + boxChange.from.length);
          out += m[1] + escapeXml(swapped) + m[3];
        } else {
          out += m[0];
        }
        cursor = m.index + m[0].length;
      }
      out += region.slice(cursor);
      if (seen) replaced = out;
    }

    if (replaced === null) {
      if (runs.length > 0) {
        // 여러 런으로 쪼개진 경우 첫 런에 쓰고 나머지는 비운다. 첫 런만 바꾸고 두면
        // 옛 글자가 뒤에 남는다("☑ AI 반도체□ AI 반도체").
        let out = '';
        let cursor = 0;
        runs.forEach((m, k) => {
          out += region.slice(cursor, m.index);
          out += m[1] + (k === 0 ? escapeXml(text) : '') + m[3];
          cursor = m.index + m[0].length;
        });
        out += region.slice(cursor);
        replaced = out;
      } else if (text) {
        // 런이 없는 빈 칸 — 쓸 자리를 만든다.
        const nearby = region.match(/<hp:run\s+charPrIDRef="(\d+)"/);
        const charPr = nearby ? nearby[1] : commonCharPr;
        replaced = `<hp:run charPrIDRef="${charPr}"><hp:t>${escapeXml(text)}</hp:t></hp:run>` + region;
      } else {
        continue;
      }

      // ── 안내문 자리에 쓴 글이 파란색·기울임을 물려받지 않게 ──
      if (plainCharPr && isGuideAt(i) && text) {
        replaced = replaced.replace(/<hp:run\s+charPrIDRef="\d+"/, `<hp:run charPrIDRef="${plainCharPr}"`);
      }
    }

    // ── 글이 바뀐 단락의 줄 정보는 지운다 ──
    // linesegarray 는 "몇 번째 글자에서 줄이 바뀐다"는 계산 결과다. 내용이 달라졌는데
    // 남겨두면 한글이 옛 줄 나눔대로 그리려다 겹쳐 보인다. 지우면 다시 계산한다.
    replaced = replaced.replace(/<hp:linesegarray\b[\s\S]*?<\/hp:linesegarray>/g, '');

    // 한 줄 고정(SQUEEZE) 칸에 긴 글이 들어가면 줄바꿈을 허용해야 한다. 다만 그 설정은
    // <hp:subList> 에 있고 이 태그는 <hp:p> 보다 **앞**에 있어 지금 영역에 없다.
    // 위치만 모아두고 본문 교체가 끝난 뒤 따로 처리한다.
    if (text && fitsOneLine(text, widths[i]) === false) needsWrap.push(startPos);

    if (replaced !== region) {
      result = result.slice(0, startPos) + replaced + result.slice(endPos);
    }
  }

  // ── 줄바꿈 허용 ──
  // 단락을 감싸는 subList 를 거슬러 찾아 SQUEEZE 를 BREAK 로 바꾼다. 앞쪽을 고치는
  // 작업이라 본문 교체가 모두 끝난 뒤, 뒤에서부터 적용해 인덱스가 밀리지 않게 한다.
  for (const pos of [...needsWrap].sort((a, b) => b - a)) {
    const before = result.slice(0, pos);
    const open = before.lastIndexOf('<hp:subList');
    const close = before.lastIndexOf('</hp:subList>');
    if (open === -1 || open < close) continue; // 이 단락을 감싸는 subList 가 아니다
    const tagEnd = result.indexOf('>', open);
    if (tagEnd === -1) continue;
    const tag = result.slice(open, tagEnd + 1);
    if (!/lineWrap="SQUEEZE"/.test(tag)) continue;
    result =
      result.slice(0, open) +
      tag.replace('lineWrap="SQUEEZE"', 'lineWrap="BREAK"') +
      result.slice(tagEnd + 1);
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

/**
 * 태그의 여는/닫는 짝을 세어 영역의 끝을 찾는다. 중첩된 표/행을 건너뛰기 위해 필요하다.
 * @returns 닫는 태그 바로 뒤 인덱스
 */
function findMatchingEnd(xml, tag, startIdx) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g');
  re.lastIndex = startIdx;
  let depth = 0;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[2] === '/') continue; // self-closing
    depth += m[1] === '/' ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return -1;
}

/** 한 표(<hp:tbl>…</hp:tbl>) 안의 **직계** <hp:tr> 영역들을 찾는다. */
function findDirectRows(tableXml) {
  const rows = [];
  const openRe = /<hp:tr\b[^>]*?>/g;
  let m;
  while ((m = openRe.exec(tableXml)) !== null) {
    // 이 tr 이 중첩 표 안에 있으면 건너뛴다.
    // tableXml 은 이 표의 여는 태그로 시작하므로, 직계 행은 열린 표가 정확히 1개인 지점에 있다.
    const before = tableXml.slice(0, m.index);
    const opens = (before.match(/<hp:tbl\b[^>]*?[^/]>/g) || []).length;
    const closes = (before.match(/<\/hp:tbl>/g) || []).length;
    if (opens - closes !== 1) continue; // 중첩 표 내부
    const end = findMatchingEnd(tableXml, 'hp:tr', m.index);
    if (end === -1) continue;
    rows.push({ start: m.index, end, xml: tableXml.slice(m.index, end) });
    openRe.lastIndex = end;
  }
  return rows;
}

/**
 * 양식 표의 행을 복제해 늘린다.
 *
 * 양식은 데이터 행이 2~3개로 고정돼 있는데 채울 항목은 그보다 많은 경우가 흔하다.
 * 행을 복제해 두면 이후 applyParagraphsToHwpx 로 각 칸을 채울 수 있다.
 *
 * 복제본은 서식·셀 폭·테두리를 원본 행에서 그대로 물려받는다. 복제 후에는 표 전체의
 * cellAddr/rowAddr 을 0부터 다시 매기고 rowCnt 를 갱신한다 — 이 값이 어긋나면 한컴이
 * 표를 깨진 것으로 본다.
 *
 * @param {Uint8Array|Buffer} bytes 원본 HWPX
 * @param {Array<{table:number,row:number,count:number}>} expansions
 *        table/row 는 extractParagraphsFromHwpx 가 준 인덱스. count 는 **추가할** 행 수.
 * @returns {Promise<Uint8Array>} 행이 늘어난 HWPX
 */
export async function duplicateTableRows(bytes, expansions) {
  if (!Array.isArray(expansions) || expansions.length === 0) {
    throw new Error('expansions 가 비어 있습니다.');
  }
  const zip = await JSZip.loadAsync(bytes);
  const sec = zip.file(SECTION_PATH);
  if (!sec) throw new Error('HWPX section0.xml 을 찾을 수 없습니다.');
  let xml = await sec.async('string');

  // 표 영역 수집 (문서 순서 = extract 의 table index 와 동일)
  const tables = [];
  const tblOpenRe = /<hp:tbl\b[^>]*?>/g;
  let tm;
  while ((tm = tblOpenRe.exec(xml)) !== null) {
    const before = xml.slice(0, tm.index);
    const opens = (before.match(/<hp:tbl\b[^>]*?[^/]>/g) || []).length;
    const closes = (before.match(/<\/hp:tbl>/g) || []).length;
    if (opens !== closes) continue; // 중첩 표는 별도 index 를 받지만 여기선 최상위만 처리
    const end = findMatchingEnd(xml, 'hp:tbl', tm.index);
    if (end === -1) continue;
    tables.push({ start: tm.index, end });
    tblOpenRe.lastIndex = end;
  }

  // 인덱스가 밀리지 않도록 뒤에서부터 적용
  const sorted = [...expansions].sort((a, b) => (b.table ?? 0) - (a.table ?? 0));
  const applied = [];

  for (const exp of sorted) {
    const tIdx = exp.table ?? 0;
    const count = Math.max(0, parseInt(exp.count, 10) || 0);
    if (count === 0) continue;
    const t = tables[tIdx];
    if (!t) throw new Error(`표 ${tIdx} 를 찾을 수 없습니다 (문서에 표 ${tables.length}개).`);

    let tableXml = xml.slice(t.start, t.end);
    const rows = findDirectRows(tableXml);
    if (rows.length === 0) throw new Error(`표 ${tIdx} 에 행이 없습니다.`);

    const rIdx = exp.row != null ? exp.row : rows.length - 1;
    if (rIdx < 0 || rIdx >= rows.length) {
      throw new Error(`표 ${tIdx} 의 행 ${rIdx} 를 찾을 수 없습니다 (행 ${rows.length}개).`);
    }

    // 행 XML 배열을 만들어 복제본을 끼워 넣는다
    const rowXmls = rows.map((r) => r.xml);
    const template = rowXmls[rIdx];
    rowXmls.splice(rIdx + 1, 0, ...Array.from({ length: count }, () => template));

    // rowAddr 을 0부터 다시 매긴다 (복제로 어긋난 주소를 일괄 정정)
    const renumbered = rowXmls.map((rx, i) =>
      rx.replace(/(<hp:cellAddr\b[^>]*?\browAddr=")\d+(")/g, `$1${i}$2`)
    );

    // 표 XML 재조립: 첫 행 앞 + 행들 + 마지막 행 뒤
    const head = tableXml.slice(0, rows[0].start);
    const tail = tableXml.slice(rows[rows.length - 1].end);
    tableXml = head + renumbered.join('\n      ') + tail;

    // rowCnt 갱신 — 없으면 추가하지 않는다(양식이 안 쓰는 경우도 있다)
    tableXml = tableXml.replace(
      /(<hp:tbl\b[^>]*?\browCnt=")(\d+)(")/,
      (_m, a, _n, c) => `${a}${renumbered.length}${c}`
    );

    xml = xml.slice(0, t.start) + tableXml + xml.slice(t.end);
    applied.push({ table: tIdx, row: rIdx, added: count, rows: renumbered.length });
  }

  const out = await rebuildHwpxZip(zip, { [SECTION_PATH]: xml });
  out.expansions = applied;
  return out;
}

/**
 * HWPX ZIP 을 규칙에 맞게 다시 만든다.
 *
 * HWPX 는 OPC 표준이라 mimetype 이 **첫 entry + 비압축(STORE)** 이어야 한컴이 인식한다.
 * JSZip 기본 generateAsync 는 전부 같은 압축으로 묶고 디렉터리 entry 도 자동 추가해
 * 표준을 위반하므로, 순서·압축·디렉터리를 직접 통제한다.
 *
 * @param {JSZip} zip 원본 zip
 * @param {Record<string,string>} replacements 경로 → 새 내용
 */
async function rebuildHwpxZip(zip, replacements = {}) {
  const out = new JSZip();
  const mimeFile = zip.file('mimetype');
  if (!mimeFile) throw new Error('HWPX mimetype entry 가 없습니다.');
  out.file('mimetype', await mimeFile.async('uint8array'), {
    compression: 'STORE',
    createFolders: false,
  });
  for (const [name, file] of Object.entries(zip.files)) {
    if (name === 'mimetype' || file.dir) continue;
    const data =
      replacements[name] != null ? replacements[name] : await file.async('uint8array');
    out.file(name, data, { compression: 'DEFLATE', createFolders: false });
  }
  return out.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
