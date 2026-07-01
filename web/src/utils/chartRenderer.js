/**
 * 클라이언트 사이드 차트/다이어그램 렌더링 유틸리티.
 *
 * - 차트:    <!--CHART:{...}-->               → ECharts SSR 로 SVG 렌더 (벡터, 선명)
 * - 다이어그램: <div class="mermaid">...</div>   → Mermaid 로 SVG 렌더
 *
 * 둘 다 SVG 로 출력하므로 확대해도 뭉개지지 않고, PPTX/PDF 변환에서도 선명하게 남는다.
 * (기존 Chart.js 는 canvas → base64 PNG 라서 확대 시 흐릿하고 편집 불가였음.)
 *
 * echarts(~1MB), mermaid(~2MB) 는 동적 import 로 실제 사용 시점에만 로드해 초기 번들을 경량화한다.
 * renderChartPlaceholders 는 mermaid 렌더가 비동기이므로 async 다 — 호출부에서 await 할 것.
 */

// ─── 지연 로더 (동적 import) ───

let _echartsPromise = null;
function getECharts() {
  if (!_echartsPromise) _echartsPromise = import('echarts');
  return _echartsPromise;
}

let _mermaidPromise = null;
function getMermaid() {
  if (!_mermaidPromise) {
    _mermaidPromise = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'neutral',
        fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
      });
      return mermaid;
    });
  }
  return _mermaidPromise;
}

// ─── 플레이스홀더 정규식 ───

const CHART_PLACEHOLDER_RE = /<!--CHART:([\s\S]*?)-->/g;
// mermaid 코드에는 `-->` 화살표가 들어가 HTML 주석과 충돌하므로, 주석이 아닌
// mermaid 네이티브 형식 <div class="mermaid"> / <pre class="mermaid"> 로 받는다.
const MERMAID_BLOCK_RE = /<(div|pre)([^>]*\bclass="[^"]*\bmermaid\b[^"]*"[^>]*)>([\s\S]*?)<\/\1>/g;

// ─── 기본 색상 팔레트 ───

const PALETTE = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const TEXT = '#1e293b';
const MUTED = '#64748b';
const GRID = '#e2e8f0';
const FONT = "'Pretendard', 'Noto Sans KR', sans-serif";

// ─── 차트 플레이스홀더 파싱 ───

function findChartPlaceholders(html) {
  const results = [];
  let m;
  CHART_PLACEHOLDER_RE.lastIndex = 0;
  while ((m = CHART_PLACEHOLDER_RE.exec(html)) !== null) {
    try {
      results.push({ match: m[0], config: JSON.parse(m[1].trim()) });
    } catch (e) {
      console.warn('[chartRenderer] 차트 JSON 파싱 실패:', e.message, m[1].slice(0, 100));
    }
  }
  return results;
}

// ─── 간소화된 CHART 스키마 → ECharts option ───
//
// { type: "line"|"bar"|"pie"|"doughnut"|"radar", title, labels, datasets:[{label,data}],
//   xLabel?, yLabel?, stacked? }
// (Gemini 가 보내는 형식 — Chart.js 시절과 동일하게 유지하여 프롬프트 호환)

function buildEChartsOption(config) {
  const { type = 'line', title, labels = [], datasets = [], xLabel, yLabel, stacked } = config;

  const common = {
    color: PALETTE,
    backgroundColor: '#ffffff',
    textStyle: { fontFamily: FONT, color: TEXT },
    title: title
      ? { text: title, left: 'center', top: 8, textStyle: { fontFamily: FONT, fontSize: 16, fontWeight: 'bold', color: TEXT } }
      : undefined,
    legend:
      datasets.length > 1 || type === 'pie' || type === 'doughnut'
        ? { bottom: 8, textStyle: { fontFamily: FONT, fontSize: 11, color: MUTED }, itemWidth: 14, itemHeight: 10 }
        : undefined,
  };

  if (type === 'pie' || type === 'doughnut') {
    const data = (datasets[0]?.data || []).map((v, i) => ({ value: v, name: labels[i] ?? `항목 ${i + 1}` }));
    return {
      ...common,
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: type === 'doughnut' ? ['42%', '70%'] : '68%',
        center: ['50%', title ? '56%' : '50%'],
        data,
        label: { fontFamily: FONT, fontSize: 12, color: TEXT, formatter: '{b}\n{d}%' },
        labelLine: { length: 10, length2: 10 },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
      }],
    };
  }

  if (type === 'radar') {
    const maxVal = Math.max(1, ...datasets.flatMap((d) => d.data || []));
    return {
      ...common,
      radar: {
        indicator: labels.map((name) => ({ name, max: maxVal })),
        axisName: { fontFamily: FONT, fontSize: 11, color: MUTED },
        splitLine: { lineStyle: { color: GRID } },
        splitArea: { areaStyle: { color: ['#ffffff', '#f8fafc'] } },
      },
      series: [{
        type: 'radar',
        data: datasets.map((d, i) => ({
          value: d.data || [],
          name: d.label || `데이터 ${i + 1}`,
          areaStyle: { opacity: 0.12 },
          lineStyle: { width: 2 },
        })),
      }],
    };
  }

  // line / bar
  const series = datasets.map((d, i) => {
    const color = PALETTE[i % PALETTE.length];
    if (type === 'bar') {
      return {
        name: d.label || `데이터 ${i + 1}`,
        type: 'bar',
        data: d.data || [],
        stack: stacked ? 'total' : undefined,
        barMaxWidth: 44,
        itemStyle: { color, borderRadius: stacked ? 0 : [4, 4, 0, 0] },
      };
    }
    return {
      name: d.label || `데이터 ${i + 1}`,
      type: 'line',
      data: d.data || [],
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 3, color },
      itemStyle: { color },
      areaStyle: d.fill ? { opacity: 0.12, color } : undefined,
      stack: stacked ? 'total' : undefined,
    };
  });

  return {
    ...common,
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 28, top: title ? 56 : 24, bottom: (common.legend ? 48 : 40) + (xLabel ? 20 : 0) },
    xAxis: {
      type: 'category',
      data: labels,
      name: xLabel || undefined,
      nameLocation: 'middle',
      nameGap: 32,
      nameTextStyle: { fontFamily: FONT, color: MUTED, fontSize: 12 },
      axisLabel: { fontFamily: FONT, color: MUTED, fontSize: 11 },
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yLabel || undefined,
      nameTextStyle: { fontFamily: FONT, color: MUTED, fontSize: 12 },
      axisLabel: { fontFamily: FONT, color: MUTED, fontSize: 11 },
      splitLine: { lineStyle: { color: GRID } },
    },
    series,
  };
}

// ─── ECharts SSR → SVG data-URI <img> ───

function renderChartToImg(echarts, config) {
  const width = config.width || 800;
  const height = config.height || 500;
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  try {
    chart.setOption(buildEChartsOption(config));
    const svg = chart.renderToSVGString();
    const uri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    return `<div style="text-align:center;margin:16px 0;"><img src="${uri}" alt="${(config.title || '차트').replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;" /></div>`;
  } finally {
    chart.dispose();
  }
}

// ─── 유틸 ───

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function errorBox(msg) {
  return `<div style="padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;margin:16px 0;font-family:${FONT};">렌더링 실패: ${msg}</div>`;
}

// ─── 메인: HTML 내 차트/다이어그램 플레이스홀더를 SVG 로 교체 (async) ───

/**
 * HTML 문자열 내의 <!--CHART:{...}--> (ECharts) 와 <div class="mermaid">...</div> (Mermaid)
 * 를 렌더링된 SVG 로 교체한다.
 * @param {string} html
 * @returns {Promise<string>}
 */
export async function renderChartPlaceholders(html) {
  let result = html;

  // 1) ECharts 차트
  const charts = findChartPlaceholders(result);
  if (charts.length > 0) {
    console.log(`[chartRenderer] ${charts.length}개 차트(ECharts) 렌더링`);
    let echarts;
    try {
      echarts = await getECharts();
    } catch (e) {
      console.error('[chartRenderer] echarts 로드 실패:', e);
    }
    if (echarts) {
      for (const { match, config } of charts) {
        try {
          result = result.replace(match, renderChartToImg(echarts, config));
        } catch (e) {
          console.error('[chartRenderer] 차트 렌더링 실패:', e.message, config);
          result = result.replace(match, errorBox(e.message));
        }
      }
    }
  }

  // 2) Mermaid 다이어그램
  const blocks = [...result.matchAll(MERMAID_BLOCK_RE)];
  if (blocks.length > 0) {
    console.log(`[chartRenderer] ${blocks.length}개 다이어그램(Mermaid) 렌더링`);
    let mermaid;
    try {
      mermaid = await getMermaid();
    } catch (e) {
      console.error('[chartRenderer] mermaid 로드 실패:', e);
    }
    if (mermaid) {
      let i = 0;
      for (const b of blocks) {
        const code = decodeEntities(b[3]).trim();
        if (!code) continue;
        try {
          const { svg } = await mermaid.render(`mmd-${i++}`, code);
          result = result.replace(b[0], `<div style="text-align:center;margin:16px 0;">${svg}</div>`);
        } catch (e) {
          console.error('[chartRenderer] 다이어그램 렌더링 실패:', e.message);
          result = result.replace(b[0], errorBox(e.message));
        }
      }
    }
  }

  return result;
}
