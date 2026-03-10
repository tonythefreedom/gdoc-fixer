/**
 * 클라이언트 사이드 차트 렌더링 유틸리티.
 * Gemini가 반환한 차트 플레이스홀더(<!--CHART:{...}-->)를
 * Chart.js로 렌더링하여 base64 PNG <img> 태그로 교체.
 */
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ─── 차트 플레이스홀더 파싱 ───

const CHART_PLACEHOLDER_RE = /<!--CHART:([\s\S]*?)-->/g;

/**
 * HTML 내 <!--CHART:{...}--> 플레이스홀더를 모두 찾아 반환.
 * @returns {{ match: string, config: object, index: number }[]}
 */
function findChartPlaceholders(html) {
  const results = [];
  let m;
  CHART_PLACEHOLDER_RE.lastIndex = 0;
  while ((m = CHART_PLACEHOLDER_RE.exec(html)) !== null) {
    try {
      const config = JSON.parse(m[1].trim());
      results.push({ match: m[0], config, index: m.index });
    } catch (e) {
      console.warn('[chartRenderer] 차트 JSON 파싱 실패:', e.message, m[1].slice(0, 100));
    }
  }
  return results;
}

// ─── 기본 색상 팔레트 ───

const PALETTE = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
];

const PALETTE_BG = PALETTE.map((c) => c + '33'); // 20% opacity

/**
 * Chart config를 Chart.js 옵션으로 변환.
 * Gemini가 보내는 간소화된 형식:
 * {
 *   type: "line" | "bar" | "pie" | "doughnut" | "radar",
 *   title: "차트 제목",
 *   labels: ["1월", "2월", ...],
 *   datasets: [
 *     { label: "시리즈A", data: [1,2,3] },
 *     { label: "시리즈B", data: [4,5,6] }
 *   ],
 *   xLabel?: "X축",
 *   yLabel?: "Y축",
 *   stacked?: boolean
 * }
 */
function buildChartJsConfig(config) {
  const { type = 'line', title, labels, datasets, xLabel, yLabel, stacked } = config;

  const chartDatasets = (datasets || []).map((ds, i) => {
    const color = PALETTE[i % PALETTE.length];
    const bgColor = PALETTE_BG[i % PALETTE_BG.length];

    const base = {
      label: ds.label || `데이터 ${i + 1}`,
      data: ds.data || [],
      borderColor: ds.borderColor || color,
      backgroundColor: ds.backgroundColor || (type === 'line' ? bgColor : color),
      borderWidth: ds.borderWidth || 2,
    };

    if (type === 'line') {
      base.fill = ds.fill ?? false;
      base.tension = ds.tension ?? 0.3;
      base.pointRadius = ds.pointRadius ?? 3;
    }

    return base;
  });

  // pie/doughnut: 단일 데이터셋에 여러 색상 적용
  if ((type === 'pie' || type === 'doughnut') && chartDatasets.length > 0) {
    const ds = chartDatasets[0];
    if (!config.datasets?.[0]?.backgroundColor) {
      ds.backgroundColor = (ds.data || []).map((_, i) => PALETTE[i % PALETTE.length]);
      ds.borderColor = '#ffffff';
      ds.borderWidth = 2;
    }
  }

  return {
    type,
    data: {
      labels: labels || [],
      datasets: chartDatasets,
    },
    options: {
      responsive: false,
      animation: false,
      plugins: {
        title: title
          ? { display: true, text: title, font: { size: 16, weight: 'bold' }, color: '#1e293b' }
          : { display: false },
        legend: {
          display: chartDatasets.length > 1 || type === 'pie' || type === 'doughnut',
          position: 'bottom',
          labels: { font: { size: 11 }, color: '#475569' },
        },
      },
      scales:
        type === 'pie' || type === 'doughnut' || type === 'radar'
          ? undefined
          : {
              x: {
                title: xLabel ? { display: true, text: xLabel, color: '#64748b' } : undefined,
                stacked: !!stacked,
                ticks: { color: '#64748b', font: { size: 10 } },
                grid: { color: '#e2e8f0' },
              },
              y: {
                title: yLabel ? { display: true, text: yLabel, color: '#64748b' } : undefined,
                stacked: !!stacked,
                ticks: { color: '#64748b', font: { size: 10 } },
                grid: { color: '#e2e8f0' },
                beginAtZero: type === 'bar',
              },
            },
    },
  };
}

// ─── 오프스크린 캔버스에서 Chart.js 렌더링 → base64 PNG ───

function renderChartToBase64(config, width = 800, height = 500) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  // 흰색 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const chartJsConfig = buildChartJsConfig(config);

  const chart = new Chart(ctx, chartJsConfig);
  // Chart.js animation:false이므로 즉시 렌더링 완료
  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();

  return dataUrl;
}

// ─── 메인 함수: HTML 내 차트 플레이스홀더를 이미지로 교체 ───

/**
 * HTML 문자열 내의 <!--CHART:{...}--> 플레이스홀더를
 * Chart.js로 렌더링한 <img> 태그로 교체.
 * @param {string} html
 * @returns {string} 차트가 이미지로 교체된 HTML
 */
export function renderChartPlaceholders(html) {
  const placeholders = findChartPlaceholders(html);
  if (placeholders.length === 0) return html;

  console.log(`[chartRenderer] ${placeholders.length}개 차트 플레이스홀더 발견`);

  let result = html;
  for (const { match, config } of placeholders) {
    try {
      const width = config.width || 800;
      const height = config.height || 500;
      const dataUrl = renderChartToBase64(config, width, height);

      const imgTag = `<div style="text-align:center;margin:16px 0;"><img src="${dataUrl}" alt="${config.title || '차트'}" style="max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:8px;" /></div>`;
      result = result.replace(match, imgTag);
      console.log(`[chartRenderer] 차트 렌더링 완료: ${config.title || '(제목 없음)'}`);
    } catch (e) {
      console.error('[chartRenderer] 차트 렌더링 실패:', e.message, config);
      // 실패 시 에러 메시지로 대체
      const errorDiv = `<div style="padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;margin:16px 0;">차트 렌더링 실패: ${e.message}</div>`;
      result = result.replace(match, errorDiv);
    }
  }

  return result;
}
