/**
 * DOCX 파일을 HTML로 변환 (docx-preview 기반)
 *
 * docx-preview로 높은 충실도 렌더링 후,
 * computed style을 인라인으로 적용하여 독립 실행 가능한 HTML 생성.
 *
 * EMF/WMF 이미지는 브라우저에서 표시 불가 → DOCX zip에서 래스터 대체 이미지 추출.
 */

// computed style을 인라인으로 적용
const STYLE_PROPS = [
  'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontStyle',
  'fontFamily', 'textAlign', 'textDecoration', 'lineHeight', 'letterSpacing',
  'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'borderTopStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderRightStyle',
  'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
  'width', 'minWidth', 'maxWidth', 'verticalAlign', 'textIndent',
];

const SKIP_VALUES = new Set([
  'rgba(0, 0, 0, 0)', 'transparent', 'none', 'normal', 'start',
  '0px', 'auto', 'medium',
]);

function toKebab(prop) {
  return prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
}

function applyInlineStyles(el, win) {
  if (el.nodeType !== 1) return;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'br') return;

  // 코멘트 팝업 요소는 이미 인라인 스타일이 설정됨 → 건드리지 않음
  if (el.hasAttribute('data-comment-idx') || el.hasAttribute('data-comment-popup') || el.hasAttribute('data-comment-wrapper')) return;

  // <img>: src 보존, 크기만 보존
  if (tag === 'img') {
    const cs = win.getComputedStyle(el);
    const w = parseInt(cs.width);
    const h = parseInt(cs.height);
    const existingStyle = el.getAttribute('style') || '';
    // computed width/height가 유효하면 인라인에 추가, 아니면 원래 스타일 유지
    if (w > 0 && h > 0) {
      el.setAttribute('style', `width: ${w}px; height: ${h}px; max-width: 100%;`);
    } else if (!existingStyle) {
      el.setAttribute('style', 'max-width: 100%; height: auto;');
    }
    el.removeAttribute('class');
    return;
  }

  try {
    const cs = win.getComputedStyle(el);
    const parts = [];

    for (const prop of STYLE_PROPS) {
      const val = cs[prop];
      if (!val || SKIP_VALUES.has(val)) continue;
      if (prop === 'color' && val === 'rgb(0, 0, 0)') continue;
      if (prop === 'fontSize' && val === '16px') continue;
      if (prop === 'fontWeight' && (val === '400' || val === 'normal')) continue;
      if (prop === 'lineHeight' && val === 'normal') continue;
      parts.push(`${toKebab(prop)}: ${val}`);
    }

    // display 속성도 포함 (block/inline-block 차이가 중요)
    const display = cs.display;
    if (display && display !== 'block' && display !== 'inline') {
      parts.push(`display: ${display}`);
    }

    if (parts.length > 0) {
      el.setAttribute('style', parts.join('; '));
    }
  } catch {
    // skip
  }

  el.removeAttribute('class');

  for (const child of el.children) {
    applyInlineStyles(child, win);
  }
}

/**
 * EMF 바이너리에서 이미지 추출.
 *
 * 1단계: PNG/JPEG 시그니처 스캔 (임베딩된 래스터)
 * 2단계: EMR_STRETCHDIBITS/EMR_BITBLT 레코드에서 DIB 비트맵 추출 → BMP 변환
 * 3단계: DIB 비트맵 → Canvas → PNG 변환 (BMP보다 호환성 좋음)
 */
function extractRasterFromEmf(buf) {
  const bytes = new Uint8Array(buf);

  // 1단계: PNG 시그니처 스캔
  for (let i = 0; i < bytes.length - 8; i++) {
    if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4E && bytes[i + 3] === 0x47 &&
        bytes[i + 4] === 0x0D && bytes[i + 5] === 0x0A && bytes[i + 6] === 0x1A && bytes[i + 7] === 0x0A) {
      for (let j = i + 8; j < bytes.length - 7; j++) {
        if (bytes[j] === 0x49 && bytes[j + 1] === 0x45 && bytes[j + 2] === 0x4E && bytes[j + 3] === 0x44) {
          const pngData = bytes.slice(i, Math.min(j + 8, bytes.length));
          return `data:image/png;base64,${uint8ToBase64(pngData)}`;
        }
      }
    }
  }

  // JPEG 시그니처 스캔
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
      for (let j = i + 3; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          return `data:image/jpeg;base64,${uint8ToBase64(bytes.slice(i, j + 2))}`;
        }
      }
    }
  }

  // 2단계: EMR 레코드 파싱 → DIB 비트맵 추출
  const view = new DataView(buf);
  let offset = 0;

  while (offset < buf.byteLength - 8) {
    const recType = view.getUint32(offset, true);
    const recSize = view.getUint32(offset + 4, true);
    if (recSize < 8 || offset + recSize > buf.byteLength) break;
    if (recType === 0x0E) break; // EMR_EOF

    let offBmi = 0, cbBmi = 0, offBits = 0, cbBits = 0;

    if (recType === 0x51 && recSize > 80) {
      // EMR_STRETCHDIBITS
      offBmi = view.getUint32(offset + 48, true);
      cbBmi = view.getUint32(offset + 52, true);
      offBits = view.getUint32(offset + 56, true);
      cbBits = view.getUint32(offset + 60, true);
    } else if (recType === 0x4C && recSize > 100) {
      // EMR_BITBLT
      offBmi = view.getUint32(offset + 84, true);
      cbBmi = view.getUint32(offset + 88, true);
      offBits = view.getUint32(offset + 92, true);
      cbBits = view.getUint32(offset + 96, true);
    }

    if (cbBmi > 0 && cbBits > 0) {
      const bmiStart = offset + offBmi;
      const bitsStart = offset + offBits;

      if (bmiStart + cbBmi <= buf.byteLength && bitsStart + cbBits <= buf.byteLength) {
        // 비트맵 데이터 내부에 PNG/JPEG가 있는지 확인
        if (bytes[bitsStart] === 0x89 && bytes[bitsStart + 1] === 0x50) {
          return `data:image/png;base64,${uint8ToBase64(bytes.slice(bitsStart, bitsStart + cbBits))}`;
        }
        if (bytes[bitsStart] === 0xFF && bytes[bitsStart + 1] === 0xD8) {
          return `data:image/jpeg;base64,${uint8ToBase64(bytes.slice(bitsStart, bitsStart + cbBits))}`;
        }

        // 원시 DIB → BMP 파일로 변환 (브라우저에서 표시 가능)
        const bmiData = new Uint8Array(buf, bmiStart, cbBmi);
        const bitsData = new Uint8Array(buf, bitsStart, cbBits);
        const fileSize = 14 + cbBmi + cbBits;
        const bmp = new Uint8Array(fileSize);

        // BMP 파일 헤더 (14 bytes)
        bmp[0] = 0x42; bmp[1] = 0x4D; // "BM"
        const bmpView = new DataView(bmp.buffer);
        bmpView.setUint32(2, fileSize, true); // file size
        bmpView.setUint32(10, 14 + cbBmi, true); // pixel data offset

        bmp.set(bmiData, 14);
        bmp.set(bitsData, 14 + cbBmi);

        console.log(`[DOCX Import] EMF에서 DIB 비트맵 추출 (${cbBmi}+${cbBits} bytes)`);
        return dibToPngDataUrl(bmp);
      }
    }

    offset += recSize;
  }

  return null;
}

/**
 * BMP 데이터를 Canvas를 통해 PNG data URL로 변환.
 * BMP를 직접 img로 로드하고 canvas에 그려서 PNG로 export.
 */
function dibToPngDataUrl(bmpUint8) {
  const b64 = uint8ToBase64(bmpUint8);
  const bmpUrl = `data:image/bmp;base64,${b64}`;

  // 동기적으로 반환할 수 없으므로 BMP data URL을 그대로 반환
  // (브라우저가 BMP를 지원하므로 표시 가능)
  return bmpUrl;
}

function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}

/**
 * DOCX zip에서 이미지 추출.
 * 1) 래스터 이미지 (PNG/JPEG/GIF) 직접 사용
 * 2) EMF/WMF → 내부에서 래스터 추출 시도
 * 3) 같은 base name의 래스터 대체 이미지 우선
 */
async function extractRasterImages(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // word/media/ 내의 모든 파일 수집
    const mediaByBase = new Map();
    for (const [path, entry] of Object.entries(zip.files)) {
      if (!path.startsWith('word/media/') || entry.dir) continue;
      const ext = path.split('.').pop().toLowerCase();
      const baseName = path.replace(/\.[^.]+$/, '');
      if (!mediaByBase.has(baseName)) mediaByBase.set(baseName, {});
      mediaByBase.get(baseName)[ext] = path;
    }

    console.log('[DOCX Import] media 파일:', [...mediaByBase.entries()].map(([k, v]) => `${k}: ${Object.keys(v).join(',')}`));

    // zip 전체 파일 목록 (디버깅용)
    const allFiles = Object.keys(zip.files).filter(f => !zip.files[f].dir);
    console.log('[DOCX Import] zip 전체 파일:', allFiles.filter(f =>
      f.startsWith('word/media/') || f.startsWith('word/charts/') ||
      f.startsWith('word/embeddings/') || f.includes('image') || f.includes('chart')
    ));

    const results = [];
    for (const [baseName, formats] of mediaByBase) {
      const hasVector = formats.emf || formats.wmf;
      const rasterExt = formats.png ? 'png' : formats.jpg ? 'jpg' : formats.jpeg ? 'jpeg' : formats.gif ? 'gif' : null;

      if (rasterExt) {
        // 래스터 이미지 직접 사용
        const rasterPath = formats[rasterExt];
        const data = await zip.file(rasterPath).async('base64');
        const mime = rasterExt === 'jpg' ? 'image/jpeg' : `image/${rasterExt}`;
        results.push(`data:${mime};base64,${data}`);
      } else if (hasVector) {
        // EMF/WMF만 있음 → 바이너리에서 래스터 추출 시도
        const vectorPath = formats.emf || formats.wmf;
        const buf = await zip.file(vectorPath).async('arraybuffer');
        const extracted = extractRasterFromEmf(buf);
        if (extracted) {
          console.log(`[DOCX Import] ${vectorPath}에서 래스터 추출 성공`);
          results.push(extracted);
        } else {
          console.warn(`[DOCX Import] ${vectorPath}에서 래스터 추출 실패 (순수 벡터)`);
        }
      }
    }

    return results;
  } catch (e) {
    console.warn('[DOCX Import] zip 이미지 추출 실패:', e);
    return [];
  }
}

// ── OOXML 차트 XML 파싱 ──

const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

const CHART_TYPES = [
  'barChart', 'bar3DChart', 'lineChart', 'line3DChart',
  'pieChart', 'pie3DChart', 'areaChart', 'area3DChart',
  'scatterChart', 'doughnutChart', 'radarChart',
];

/**
 * DOCX zip에서 차트 XML 추출 후 구조화된 데이터로 파싱.
 * document.xml 내 단락 순서에서 차트 위치(paragraphIndex)도 반환.
 */
async function extractCharts(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);

    const chartFiles = Object.keys(zip.files)
      .filter(f => /^word\/charts\/chart\d+\.xml$/i.test(f))
      .sort();

    if (!chartFiles.length) return [];

    console.log(`[DOCX Import] 차트 ${chartFiles.length}개 발견:`, chartFiles);

    // document.xml.rels에서 rId → 차트 경로 매핑
    const relsPath = 'word/_rels/document.xml.rels';
    const rIdToChart = new Map();
    if (zip.files[relsPath]) {
      const relsXml = await zip.file(relsPath).async('text');
      const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');
      const rels = relsDoc.getElementsByTagName('Relationship');
      for (const rel of rels) {
        const target = rel.getAttribute('Target') || '';
        if (target.includes('charts/chart')) {
          const fullPath = target.startsWith('word/') ? target : `word/${target}`;
          rIdToChart.set(rel.getAttribute('Id'), fullPath);
        }
      }
    }

    // document.xml에서 단락별 차트 참조 위치 찾기
    const chartPositions = new Map(); // chartPath → paragraphIndex
    const docPath = 'word/document.xml';
    if (zip.files[docPath]) {
      const docXml = await zip.file(docPath).async('text');
      const docDoc = new DOMParser().parseFromString(docXml, 'text/xml');
      const bodyNs = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      const body = docDoc.getElementsByTagNameNS(bodyNs, 'body')[0];
      if (body) {
        // body의 직접 자식 요소를 순회 (단락, 테이블 등)
        let childIdx = 0;
        for (const child of body.children) {
          // 차트 참조는 c:chart 요소의 r:id 속성에 있음
          const chartRefs = child.getElementsByTagNameNS(CHART_NS, 'chart');
          for (const ref of chartRefs) {
            const rId = ref.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
              || ref.getAttribute('r:id');
            if (rId && rIdToChart.has(rId)) {
              chartPositions.set(rIdToChart.get(rId), childIdx);
              console.log(`[DOCX Import] 차트 위치: ${rIdToChart.get(rId)} → 단락 ${childIdx}`);
            }
          }
          childIdx++;
        }
      }
    }

    const charts = [];
    for (const path of chartFiles) {
      const xml = await zip.file(path).async('text');
      const parsed = parseChartXml(xml);
      if (parsed) {
        parsed.paragraphIndex = chartPositions.get(path) ?? -1;
        charts.push(parsed);
      }
    }

    // 단락 순서대로 정렬
    charts.sort((a, b) => a.paragraphIndex - b.paragraphIndex);

    return charts;
  } catch (e) {
    console.warn('[DOCX Import] 차트 추출 실패:', e);
    return [];
  }
}

function getTextContent(el, ns, ...tagPath) {
  let cur = el;
  for (const tag of tagPath) {
    const next = cur.getElementsByTagNameNS(ns, tag)[0];
    if (!next) return null;
    cur = next;
  }
  return cur.textContent?.trim() || null;
}

function parseChartXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const chartSpace = doc.getElementsByTagNameNS(CHART_NS, 'chartSpace')[0];
  if (!chartSpace) return null;

  const chartEl = chartSpace.getElementsByTagNameNS(CHART_NS, 'chart')[0];
  if (!chartEl) return null;

  // 차트 제목 추출
  let title = '';
  const titleEl = chartEl.getElementsByTagNameNS(CHART_NS, 'title')[0];
  if (titleEl) {
    // rich text 방식: c:tx > c:rich > a:p > a:r > a:t
    const richTexts = titleEl.getElementsByTagNameNS(DRAWING_NS, 't');
    if (richTexts.length) {
      title = Array.from(richTexts).map(t => t.textContent).join('');
    }
    // strRef 방식
    if (!title) {
      title = getTextContent(titleEl, CHART_NS, 'tx', 'strRef', 'strCache', 'pt', 'v') || '';
    }
  }

  // plotArea에서 차트 타입 찾기
  const plotArea = chartEl.getElementsByTagNameNS(CHART_NS, 'plotArea')[0];
  if (!plotArea) return null;

  let chartType = null;
  let chartTypeEl = null;
  for (const type of CHART_TYPES) {
    const el = plotArea.getElementsByTagNameNS(CHART_NS, type)[0];
    if (el) {
      chartType = type;
      chartTypeEl = el;
      break;
    }
  }
  if (!chartType || !chartTypeEl) return null;

  // barDir (bar vs column)
  const barDir = getTextContent(chartTypeEl, CHART_NS, 'barDir');
  // grouping
  const grouping = getTextContent(chartTypeEl, CHART_NS, 'grouping');

  // 시리즈 데이터 추출
  const serEls = chartTypeEl.getElementsByTagNameNS(CHART_NS, 'ser');
  const series = [];
  let categories = [];

  for (const ser of serEls) {
    // 시리즈 이름
    const name = getTextContent(ser, CHART_NS, 'tx', 'strRef', 'strCache', 'pt', 'v')
      || getTextContent(ser, CHART_NS, 'tx', 'v')
      || `Series ${series.length + 1}`;

    // 카테고리 (첫 시리즈에서 추출)
    if (!categories.length) {
      const catEl = ser.getElementsByTagNameNS(CHART_NS, 'cat')[0];
      if (catEl) {
        const strCache = catEl.getElementsByTagNameNS(CHART_NS, 'strCache')[0]
          || catEl.getElementsByTagNameNS(CHART_NS, 'numCache')[0];
        if (strCache) {
          const pts = strCache.getElementsByTagNameNS(CHART_NS, 'pt');
          categories = Array.from(pts).map(pt => {
            const v = pt.getElementsByTagNameNS(CHART_NS, 'v')[0];
            return v?.textContent?.trim() || '';
          });
        }
      }
    }

    // 값
    const isScatter = chartType === 'scatterChart';
    const valTag = isScatter ? 'yVal' : 'val';
    const valEl = ser.getElementsByTagNameNS(CHART_NS, valTag)[0];
    const values = [];
    if (valEl) {
      const numCache = valEl.getElementsByTagNameNS(CHART_NS, 'numCache')[0];
      if (numCache) {
        const pts = numCache.getElementsByTagNameNS(CHART_NS, 'pt');
        for (const pt of pts) {
          const v = pt.getElementsByTagNameNS(CHART_NS, 'v')[0];
          values.push(v ? parseFloat(v.textContent) : 0);
        }
      }
    }

    // scatter x값
    let xValues = null;
    if (isScatter) {
      const xValEl = ser.getElementsByTagNameNS(CHART_NS, 'xVal')[0];
      if (xValEl) {
        const numCache = xValEl.getElementsByTagNameNS(CHART_NS, 'numCache')[0];
        if (numCache) {
          xValues = [];
          const pts = numCache.getElementsByTagNameNS(CHART_NS, 'pt');
          for (const pt of pts) {
            const v = pt.getElementsByTagNameNS(CHART_NS, 'v')[0];
            xValues.push(v ? parseFloat(v.textContent) : 0);
          }
        }
      }
    }

    series.push({ name, values, xValues });
  }

  if (!series.length) return null;

  console.log(`[DOCX Import] 차트 파싱: ${chartType}, "${title}", ${series.length}개 시리즈, ${categories.length}개 카테고리`);

  return { chartType, title, categories, series, barDir, grouping };
}

// 차트 색상 팔레트
const CHART_COLORS = [
  '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5',
  '#70AD47', '#264478', '#9B57A0', '#636363', '#EB7E30',
];

/**
 * Chart.js로 차트를 canvas에 렌더링 → PNG data URL 반환
 */
async function renderChartToImage(chartData) {
  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  // canvas를 DOM에 부착해야 Chart.js가 제대로 렌더링함
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 440;
  canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;';
  document.body.appendChild(canvas);

  // Chart.js 차트 타입 매핑
  let type;
  if (chartData.chartType.includes('bar') || chartData.chartType.includes('Bar')) {
    type = 'bar';
  } else if (chartData.chartType.includes('line') || chartData.chartType.includes('Line')) {
    type = 'line';
  } else if (chartData.chartType.includes('pie') || chartData.chartType.includes('Pie')) {
    type = 'pie';
  } else if (chartData.chartType.includes('doughnut') || chartData.chartType.includes('Doughnut')) {
    type = 'doughnut';
  } else if (chartData.chartType.includes('area') || chartData.chartType.includes('Area')) {
    type = 'line'; // area는 line + fill
  } else if (chartData.chartType.includes('radar') || chartData.chartType.includes('Radar')) {
    type = 'radar';
  } else if (chartData.chartType.includes('scatter') || chartData.chartType.includes('Scatter')) {
    type = 'scatter';
  } else {
    type = 'bar';
  }

  const isArea = chartData.chartType.includes('area') || chartData.chartType.includes('Area');
  const isPieOrDoughnut = type === 'pie' || type === 'doughnut';
  const isHorizontalBar = type === 'bar' && chartData.barDir === 'bar';
  const isStacked = chartData.grouping === 'stacked' || chartData.grouping === 'percentStacked';

  // 데이터셋 구성
  const datasets = chartData.series.map((s, i) => {
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const dataset = {
      label: s.name,
      data: type === 'scatter' && s.xValues
        ? s.xValues.map((x, j) => ({ x, y: s.values[j] || 0 }))
        : s.values,
      backgroundColor: isPieOrDoughnut
        ? s.values.map((_, j) => CHART_COLORS[j % CHART_COLORS.length])
        : isArea ? color + '40' : color,
      borderColor: color,
      borderWidth: type === 'line' || isArea ? 2 : 1,
      fill: isArea,
    };
    return dataset;
  });

  const config = {
    type: isHorizontalBar ? 'bar' : type,
    data: {
      labels: chartData.categories,
      datasets,
    },
    options: {
      responsive: false,
      animation: false,
      indexAxis: isHorizontalBar ? 'y' : 'x',
      plugins: {
        title: chartData.title ? {
          display: true,
          text: chartData.title,
          font: { size: 14, weight: 'bold' },
          color: '#1e293b',
        } : { display: false },
        legend: {
          display: !isPieOrDoughnut || chartData.series.length > 1,
          position: 'bottom',
          labels: { font: { size: 11 }, color: '#475569' },
        },
      },
      scales: isPieOrDoughnut || type === 'radar' ? {} : {
        x: {
          stacked: isStacked,
          ticks: { font: { size: 10 }, color: '#64748b' },
          grid: { color: '#e2e8f0' },
        },
        y: {
          stacked: isStacked,
          ticks: { font: { size: 10 }, color: '#64748b' },
          grid: { color: '#e2e8f0' },
        },
      },
    },
  };

  const chart = new Chart(canvas.getContext('2d'), config);
  // Chart.js animation:false이므로 즉시 렌더링 완료
  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  document.body.removeChild(canvas);

  console.log(`[DOCX Import] 차트 이미지 생성: ${dataUrl.length} bytes, prefix: ${dataUrl.substring(0, 40)}`);
  return dataUrl;
}

/**
 * docx-preview의 코멘트 요소를 클릭 팝업 방식으로 변환.
 * hover 기반 CSS 팝오버는 인라인 스타일 적용 시 소실되므로,
 * 인라인 JS + CSS로 독립적인 클릭 팝업 구현.
 */
function processComments(container) {
  // docx-preview className prefix: 'docx-viewer' (renderAsync 옵션에서 설정)
  const commentRefs = container.querySelectorAll('[class*="comment-ref"]');
  if (!commentRefs.length) return;

  console.log(`[DOCX Import] 코멘트 ${commentRefs.length}개 처리`);

  commentRefs.forEach((ref, i) => {
    // 말풍선 아이콘 옆의 popover div 찾기 (sibling)
    const popover = ref.nextElementSibling;
    if (!popover || !popover.className?.includes('comment-popover')) return;

    // popover 내용 추출
    const authorEl = popover.querySelector('[class*="comment-author"]');
    const dateEl = popover.querySelector('[class*="comment-date"]');
    const author = authorEl?.textContent || '';
    const date = dateEl?.textContent || '';

    // popover의 나머지 내용 (코멘트 본문)
    const bodyParts = [];
    for (const child of popover.children) {
      if (child === authorEl || child === dateEl) continue;
      bodyParts.push(child.textContent?.trim() || '');
    }
    const body = bodyParts.filter(Boolean).join('\n') || popover.textContent?.replace(author, '').replace(date, '').trim() || '';

    // 원래 ref + popover를 새로운 인라인 구조로 교체
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-comment-wrapper', '');
    wrapper.style.cssText = 'position: relative; display: inline;';

    const bubble = document.createElement('span');
    bubble.textContent = '💬';
    bubble.setAttribute('data-comment-idx', i);
    bubble.style.cssText = 'cursor: pointer; font-size: 14px; vertical-align: super; line-height: 1; user-select: none;';

    const popup = document.createElement('span');
    popup.setAttribute('data-comment-popup', i);
    popup.style.cssText = 'display: none; position: absolute; left: 0; top: 1.5em; z-index: 9999; background: #fff; border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); padding: 10px 14px; min-width: 220px; max-width: 320px; font-size: 13px; line-height: 1.5; color: #1e293b;';

    let popupHtml = '';
    if (author) popupHtml += `<span style="font-weight: 600; color: #475569; font-size: 12px;">${author}</span>`;
    if (date) popupHtml += `<span style="color: #94a3b8; font-size: 11px; margin-left: 6px;">${date}</span>`;
    if (author || date) popupHtml += '<br>';
    popupHtml += `<span style="color: #334155;">${body}</span>`;
    popup.innerHTML = popupHtml;

    wrapper.appendChild(bubble);
    wrapper.appendChild(popup);

    // 원래 요소 교체
    ref.parentNode.insertBefore(wrapper, ref);
    popover.remove();
    ref.remove();
  });
}

export async function parseDocxToHtml(file) {
  const { renderAsync } = await import('docx-preview');
  const arrayBuffer = await file.arrayBuffer();

  // 숨겨진 컨테이너 — visibility:hidden은 레이아웃 유지, display:none과 달리 이미지 디코딩 가능
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:800px;visibility:hidden;';
  document.body.appendChild(container);

  // docx-preview CSS를 받을 스타일 컨테이너
  const styleContainer = document.createElement('div');
  document.body.appendChild(styleContainer);

  try {
    await renderAsync(arrayBuffer, container, styleContainer, {
      className: 'docx-viewer',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: false,
      ignoreLastRenderedPageBreak: true,
      experimental: true,
      trimXmlDeclaration: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: true,
    });

    // docx-preview가 생성한 CSS를 container 내부로 이동
    const docxStyles = styleContainer.querySelectorAll('style');
    for (const s of docxStyles) {
      container.insertBefore(s, container.firstChild);
    }

    // 이미지 로딩 대기
    await new Promise(r => setTimeout(r, 500));

    // DOCX zip에서 래스터 이미지 추출 (EMF/WMF 대체용)
    const rasterImages = await extractRasterImages(arrayBuffer);
    console.log(`[DOCX Import] zip에서 래스터 이미지 ${rasterImages.length}개 추출`);

    // SVG 요소 처리: VML 이미지가 포함된 SVG는 <img>로 변환, 나머지 제거
    container.querySelectorAll('svg').forEach(svg => {
      const imageEl = svg.querySelector('image');
      if (imageEl) {
        const href = imageEl.getAttribute('href') || imageEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
        if (href) {
          const img = document.createElement('img');
          img.setAttribute('src', href);
          const svgW = parseInt(svg.style.width || svg.getAttribute('width')) || 0;
          const svgH = parseInt(svg.style.height || svg.getAttribute('height')) || 0;
          if (svgW > 0 && svgH > 0) {
            img.setAttribute('style', `width: ${svgW}px; height: ${svgH}px; max-width: 100%;`);
          } else {
            img.setAttribute('style', 'max-width: 100%; height: auto;');
          }
          svg.parentNode.replaceChild(img, svg);
          return;
        }
      }
      svg.remove();
    });

    // 이미지 처리
    const imgs = container.querySelectorAll('img');
    console.log(`[DOCX Import] 이미지 ${imgs.length}개 발견`);

    let rasterIdx = 0; // 래스터 이미지 대체 인덱스

    await Promise.all(Array.from(imgs).map(async (img) => {
      let src = img.getAttribute('src') || '';

      if (!src) { img.remove(); return; }

      // blob/http URL → base64 변환
      if (src.startsWith('blob:') || src.startsWith('http')) {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          src = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
          });
          if (src) img.setAttribute('src', src);
          else { img.remove(); return; }
        } catch (e) {
          console.warn('[DOCX] 이미지 변환 실패:', e);
          img.remove(); return;
        }
      }

      // data URL이 아니면 제거
      if (!src.startsWith('data:')) { img.remove(); return; }

      // EMF/WMF/octet-stream 이미지 → DOCX zip의 래스터 이미지로 교체
      if (src.startsWith('data:application/octet-stream') || src.startsWith('data:image/x-emf') || src.startsWith('data:image/x-wmf')) {
        console.log(`[DOCX Import] EMF/WMF 이미지 감지, 래스터 대체 시도 (idx=${rasterIdx})`);
        if (rasterIdx < rasterImages.length) {
          img.setAttribute('src', rasterImages[rasterIdx]);
          rasterIdx++;
          console.log('[DOCX Import] 래스터 이미지로 교체 성공');
        } else {
          console.warn('[DOCX Import] 대체할 래스터 이미지 없음, 제거');
          img.remove();
        }
        return;
      }

      // 올바른 이미지 data URL 확인 (PNG/JPEG 매직 바이트로 MIME 보정)
      if (src.startsWith('data:application/')) {
        const b64 = src.split(',')[1] || '';
        if (b64.startsWith('iVBORw0KGgo')) {
          img.setAttribute('src', `data:image/png;base64,${b64}`);
        } else if (b64.startsWith('/9j/')) {
          img.setAttribute('src', `data:image/jpeg;base64,${b64}`);
        } else if (b64.startsWith('R0lGODlh')) {
          img.setAttribute('src', `data:image/gif;base64,${b64}`);
        }
      }
    }));

    const remainingImgs = container.querySelectorAll('img');
    console.log(`[DOCX Import] 최종 이미지 ${remainingImgs.length}개`);

    // ── 차트 추출 및 렌더링 ──
    const charts = await extractCharts(arrayBuffer);
    if (charts.length > 0) {
      console.log(`[DOCX Import] 차트 ${charts.length}개 렌더링 시작`);
      const chartImages = await Promise.all(charts.map(c => renderChartToImage(c).catch(() => null)));

      // article 영역의 직접 자식 요소 목록 (docx-preview가 렌더링한 단락들)
      const target = container.querySelector('article') || container.querySelector('section') || container;
      const children = Array.from(target.children);

      // 차트를 원래 문서 위치에 삽입 (paragraphIndex 기반)
      // 뒤에서부터 삽입해야 인덱스가 밀리지 않음
      const chartsToInsert = charts
        .map((c, i) => ({ chart: c, dataUrl: chartImages[i], idx: i }))
        .filter(c => c.dataUrl)
        .reverse();

      for (const { chart, dataUrl, idx } of chartsToInsert) {
        const chartDiv = document.createElement('div');
        chartDiv.style.cssText = 'text-align: center; margin: 16px 0;';
        const chartImg = document.createElement('img');
        chartImg.setAttribute('src', dataUrl);
        chartImg.setAttribute('style', 'max-width: 100%; height: auto;');
        chartImg.setAttribute('alt', chart.title || `Chart ${idx + 1}`);
        chartDiv.appendChild(chartImg);

        if (chart.paragraphIndex >= 0 && chart.paragraphIndex < children.length) {
          // 해당 단락 뒤에 삽입
          const refChild = children[chart.paragraphIndex];
          refChild.parentNode.insertBefore(chartDiv, refChild.nextSibling);
          console.log(`[DOCX Import] 차트 ${idx + 1} → 단락 ${chart.paragraphIndex} 뒤에 삽입: "${chart.title || 'Untitled'}"`);
        } else {
          // 위치를 알 수 없으면 끝에 추가
          target.appendChild(chartDiv);
          console.log(`[DOCX Import] 차트 ${idx + 1} → 끝에 삽입: "${chart.title || 'Untitled'}"`);
        }
      }
    }

    // ── 코멘트 처리: docx-preview의 hover 팝오버 → 클릭 팝업으로 변환 ──
    processComments(container);

    // docx-preview 구조: <section> → <header> + <article> + <footer>
    // 각각에 인라인 스타일 적용 후 합침
    const section = container.querySelector('section') || container;
    const headerEl = section.querySelector(':scope > header');
    const articleEl = section.querySelector(':scope > article');
    const footerEl = section.querySelector(':scope > footer');

    // 인라인 스타일 적용
    if (headerEl) applyInlineStyles(headerEl, window);
    if (articleEl) applyInlineStyles(articleEl, window);
    if (footerEl) applyInlineStyles(footerEl, window);
    // article이 없는 경우 container 전체에 적용
    if (!articleEl && !headerEl) applyInlineStyles(section, window);

    // <style> 태그 제거 (이미 인라인화됨)
    container.querySelectorAll('style').forEach(s => s.remove());

    // 최종 이미지 확인 (디버그)
    const finalImgs = (articleEl || section).querySelectorAll('img');
    console.log(`[DOCX Import] 인라인 스타일 적용 후 이미지 ${finalImgs.length}개`);
    finalImgs.forEach((img, i) => {
      const src = img.getAttribute('src') || '';
      console.log(`[DOCX Import] 이미지 ${i}: src prefix="${src.substring(0, 50)}", length=${src.length}`);
    });

    // header + article + footer 조합
    const parts = [];
    if (headerEl && headerEl.innerHTML.trim()) {
      parts.push(`<div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; color: #64748b; font-size: 14px;">${headerEl.innerHTML}</div>`);
    }
    parts.push(articleEl ? articleEl.innerHTML : (section.innerHTML || container.innerHTML));
    if (footerEl && footerEl.innerHTML.trim()) {
      parts.push(`<div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 16px; color: #64748b; font-size: 14px;">${footerEl.innerHTML}</div>`);
    }
    const bodyHtml = parts.join('\n');

    if (!bodyHtml || !bodyHtml.trim()) {
      throw new Error('DOCX 파일에서 내용을 추출할 수 없습니다.');
    }

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      line-height: 1.6;
      color: #1e293b;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 32px 40px 48px;
    }
    table { border-collapse: collapse; margin: 0.5em 0; }
    img { max-width: 100%; height: auto; }
    td, th { padding: 4px 8px; }
  </style>
</head>
<body>
${bodyHtml}
<script>
(function(){
  var open = null;
  document.addEventListener('click', function(e) {
    var bubble = e.target.closest('[data-comment-idx]');
    if (bubble) {
      var idx = bubble.getAttribute('data-comment-idx');
      var popup = document.querySelector('[data-comment-popup="'+idx+'"]');
      if (!popup) return;
      if (open && open !== popup) open.style.display = 'none';
      popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
      open = popup.style.display === 'block' ? popup : null;
      e.stopPropagation();
      return;
    }
    if (open) { open.style.display = 'none'; open = null; }
  });
})();
<\/script>
</body>
</html>`;
  } finally {
    document.body.removeChild(container);
    if (styleContainer.parentNode) document.body.removeChild(styleContainer);
  }
}
