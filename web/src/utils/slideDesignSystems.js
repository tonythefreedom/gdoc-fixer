// 프리젠테이션 변환에 사용할 디자인 시스템 카탈로그.
// 각 시스템은 Gemini 가 슬라이드를 합성할 때 따라야 할 시각 규칙(palette,
// typography, layout pattern, prompt hint)을 한 곳에 모아둔다.
//
// convertHtmlToSlides(html, { designSystemId }) 에서 시스템 객체를 꺼내
// SYSTEM_PROMPT 에 인라인 주입한다.

export const SLIDE_DESIGN_SYSTEMS = [
  // ─────────────────────────────────────────────────────────────
  {
    id: 'modern-minimal',
    name: '모던 미니멀',
    nameEn: 'Modern Minimal',
    description: '깔끔한 흰 배경 + 단색 강조. 비즈니스 보고/제안서에 무난.',
    palette: {
      background: '#ffffff',
      surface: '#f8fafc',
      primary: '#2563eb',
      accent: '#0ea5e9',
      text: '#0f172a',
      muted: '#64748b',
      divider: '#e2e8f0',
    },
    typography: {
      heading: "'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "ui-monospace, 'D2 Coding', monospace",
      titleSize: 56,
      headingSize: 40,
      bodySize: 26,
      captionSize: 18,
      weights: { title: 800, heading: 700, body: 400, caption: 400 },
    },
    layout: {
      padding: 80,
      gridGap: 32,
      borderRadius: 12,
      shadow: '0 1px 3px rgba(15,23,42,0.06)',
    },
    promptHint: `
DESIGN SYSTEM — Modern Minimal:
- Background: pure white #ffffff. Surfaces use #f8fafc.
- Primary brand color #2563eb (use sparingly: title accents, divider lines).
- Text: #0f172a for headings, #64748b for muted captions.
- Title slide: massive 72-96px title left-aligned, primary-colored thin underline 4px tall.
- Content slides: top-left small primary chip (#2563eb), then 40px section heading, then body in 26px line-height 1.5.
- Use generous whitespace (padding 80px). NO gradients, NO decorative shapes — only subtle dividers.
- Sans-serif throughout: 'Pretendard', 'Noto Sans KR'.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'dark-tech',
    name: '다크 테크',
    nameEn: 'Dark Tech',
    description: '검은 배경 + 네온 사이안/마젠타. AI·개발 발표용.',
    palette: {
      background: '#0a0a12',
      surface: '#15151f',
      primary: '#22d3ee',
      accent: '#f472b6',
      text: '#f8fafc',
      muted: '#94a3b8',
      divider: '#1f1f2e',
    },
    typography: {
      heading: "'JetBrains Mono', 'Noto Sans KR', monospace",
      body: "'Inter', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 64,
      headingSize: 44,
      bodySize: 24,
      captionSize: 16,
      weights: { title: 800, heading: 700, body: 400, caption: 500 },
    },
    layout: {
      padding: 64,
      gridGap: 28,
      borderRadius: 8,
      shadow: '0 0 24px rgba(34,211,238,0.15)',
    },
    promptHint: `
DESIGN SYSTEM — Dark Tech:
- Background: deep near-black #0a0a12. Surface cards: #15151f with 1px border #22d3ee at 24% opacity.
- Primary neon cyan #22d3ee, accent magenta #f472b6 (alternate for chips/badges).
- Text: #f8fafc for headings, #94a3b8 muted. Use neon cyan glow on key numbers / titles (text-shadow: 0 0 16px).
- Title slide: large mono-style title in cyan, subtitle in white, small "v0.1" tag at top-right.
- Content slides: top labels look like terminal prompts ("$ ", "> ", "# "). Code blocks use #15151f background with cyan border-left 3px.
- Use monospace for headings (JetBrains Mono fallback Noto Sans KR), sans-serif body.
- Add subtle dot/grid background pattern via radial-gradient when appropriate.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'corporate-blue',
    name: '코퍼레이트 블루',
    nameEn: 'Corporate Blue',
    description: '진한 네이비 헤더 바 + 흰 본문. 정장 톤 IR/대기업 보고용.',
    palette: {
      background: '#ffffff',
      surface: '#f1f5f9',
      primary: '#1e3a8a',
      accent: '#d97706',
      text: '#1e293b',
      muted: '#475569',
      divider: '#cbd5e1',
    },
    typography: {
      heading: "'Noto Serif KR', 'Times New Roman', serif",
      body: "'Noto Sans KR', sans-serif",
      mono: "'Source Code Pro', monospace",
      titleSize: 52,
      headingSize: 36,
      bodySize: 24,
      captionSize: 16,
      weights: { title: 700, heading: 700, body: 400, caption: 600 },
    },
    layout: {
      padding: 64,
      gridGap: 24,
      borderRadius: 4,
      shadow: '0 2px 4px rgba(30,58,138,0.08)',
    },
    promptHint: `
DESIGN SYSTEM — Corporate Blue:
- Top header bar: full-width 80px tall #1e3a8a navy with white logo placeholder on left and slide page number "01 / NN" on right.
- Body area below the bar uses white background.
- Serif heading (Noto Serif KR), sans-serif body — gives a formal IR/대기업 보고서 feel.
- Title slide: full navy background, white title centered, gold #d97706 accent rule.
- Content slides: section heading 36px navy bold, body 24px dark-slate, small navy chip for chapter number.
- Data tables: navy header row with white text, alternating rows #f1f5f9.
- Use accent gold #d97706 ONLY for KPI numbers / call-out emphasis.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'soft-pastel',
    name: '소프트 파스텔',
    nameEn: 'Soft Pastel',
    description: '연한 파스텔 톤 + 둥근 모서리. 교육·캠페인·친근한 톤.',
    palette: {
      background: '#fef7ed',
      surface: '#ffe4e6',
      primary: '#f43f5e',
      accent: '#a78bfa',
      text: '#3f3f46',
      muted: '#71717a',
      divider: '#fcd5ce',
    },
    typography: {
      heading: "'Gowun Dodum', 'Noto Sans KR', sans-serif",
      body: "'Gowun Dodum', 'Noto Sans KR', sans-serif",
      mono: "'D2 Coding', monospace",
      titleSize: 60,
      headingSize: 40,
      bodySize: 26,
      captionSize: 18,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: {
      padding: 72,
      gridGap: 24,
      borderRadius: 24,
      shadow: '0 8px 24px rgba(244,63,94,0.10)',
    },
    promptHint: `
DESIGN SYSTEM — Soft Pastel:
- Background warm cream #fef7ed. Surfaces use rosy #ffe4e6 with large border-radius 24px.
- Primary coral-rose #f43f5e, accent lavender #a78bfa (alternate for badges).
- Cards have soft shadow (8-24px blur, low opacity). All corners deeply rounded (24px).
- Title slide: huge rounded title in coral, decorative oversized pastel circles in the corners (no images, just CSS shapes).
- Content slides: section heading in coral 40px, body in slate 26px. Bullet markers are filled lavender circles 12px.
- Friendly, approachable tone — appropriate for education / community campaigns.
- Avoid sharp rectangles; even data displays use pill-shaped tags.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'bold-gradient',
    name: '볼드 그라데이션',
    nameEn: 'Bold Gradient',
    description: '풀 컬러 그라데이션 + 거대한 타이포. 마케팅 키노트용.',
    palette: {
      background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)',
      surface: 'rgba(255,255,255,0.10)',
      primary: '#ffffff',
      accent: '#fde68a',
      text: '#ffffff',
      muted: 'rgba(255,255,255,0.75)',
      divider: 'rgba(255,255,255,0.20)',
    },
    typography: {
      heading: "'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "ui-monospace, monospace",
      titleSize: 96,
      headingSize: 56,
      bodySize: 28,
      captionSize: 18,
      weights: { title: 900, heading: 800, body: 500, caption: 600 },
    },
    layout: {
      padding: 80,
      gridGap: 24,
      borderRadius: 20,
      shadow: '0 12px 40px rgba(0,0,0,0.18)',
    },
    promptHint: `
DESIGN SYSTEM — Bold Gradient:
- Background: full vivid gradient (linear-gradient 135deg from #6366f1 indigo → #ec4899 pink → #f59e0b amber).
- All text in pure white #ffffff. Accent: pale yellow #fde68a for KPI numbers.
- Surfaces are translucent glass cards: rgba(255,255,255,0.10) with backdrop-filter:blur(20px) and rounded 20px.
- Title slide: gigantic 96-120px title with strong shadow (0 4px 24px rgba(0,0,0,0.30)), short subtitle below.
- Content slides: very large section heading 56px white, body 28px white at 90% opacity.
- Use big rounded pills for tags, big arrows or icons (CSS-only).
- Marketing keynote / launch-event vibe — emphasis on energy and confidence.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'editorial-print',
    name: '에디토리얼 프린트',
    nameEn: 'Editorial Print',
    description: '잡지 레이아웃 + Serif. 출판물/논평 톤.',
    palette: {
      background: '#fafaf7',
      surface: '#ffffff',
      primary: '#111111',
      accent: '#b91c1c',
      text: '#1c1917',
      muted: '#57534e',
      divider: '#111111',
    },
    typography: {
      heading: "'Playfair Display', 'Noto Serif KR', serif",
      body: "'Noto Serif KR', Georgia, serif",
      mono: "'Courier New', monospace",
      titleSize: 88,
      headingSize: 48,
      bodySize: 24,
      captionSize: 16,
      weights: { title: 900, heading: 700, body: 400, caption: 600 },
    },
    layout: {
      padding: 72,
      gridGap: 32,
      borderRadius: 0,
      shadow: 'none',
    },
    promptHint: `
DESIGN SYSTEM — Editorial Print:
- Background: paper #fafaf7. NO shadows, NO rounded corners (border-radius 0).
- Serif throughout: Playfair Display / Noto Serif KR for titles, Noto Serif KR for body.
- Title slide: oversized 96px+ italic serif title, dropped-caps style first letter, thin 1px black rule above the title.
- Content slides: editorial column layout. Use 2-column or asymmetric grid. Section heading bold 48px serif, body justified, small caps for subtle labels.
- Use accent red #b91c1c ONLY for pull-quotes and call-out numbers.
- Page number bottom-right tiny serif italic.
- Quotes get massive opening quotation mark "" in pale gray and centered text inside.
- Reads like a magazine spread (Vogue / The Atlantic).
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'korean-newspaper',
    name: '한국 신문',
    nameEn: 'Korean Newspaper',
    description: '명조체 + 흑백 + 구분선. 보도자료·언론사 톤.',
    palette: {
      background: '#ffffff',
      surface: '#f5f5f4',
      primary: '#0c0a09',
      accent: '#dc2626',
      text: '#0c0a09',
      muted: '#57534e',
      divider: '#0c0a09',
    },
    typography: {
      heading: "'Noto Serif KR', 'Batang', serif",
      body: "'Noto Serif KR', 'Batang', serif",
      mono: "monospace",
      titleSize: 72,
      headingSize: 40,
      bodySize: 22,
      captionSize: 14,
      weights: { title: 900, heading: 800, body: 400, caption: 600 },
    },
    layout: {
      padding: 56,
      gridGap: 20,
      borderRadius: 0,
      shadow: 'none',
    },
    promptHint: `
DESIGN SYSTEM — Korean Newspaper:
- Pure black-and-white newspaper feel — only red #dc2626 as the single accent for breaking-news markers.
- 명조체 (Noto Serif KR / Batang) for ALL text including body.
- Title slide: oversized vertical banner-style title, masthead-like horizontal rules 4px above and below.
- Content slides: 2-3 column body layout. Each column separated by 1px solid black divider.
- Section heading in heavy 800-weight serif, all caps Korean is rare so use deep navy/black contrast.
- Photo captions in tiny 14px italic right-aligned with byline mark.
- Quotes blocked off by thick left border 4px and indented.
- Reads like 조선/중앙/한겨레 print edition.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'glassmorphism',
    name: '글래스모피즘',
    nameEn: 'Glassmorphism',
    description: '반투명 + 블러 + 색감 있는 배경. iOS/Apple 키노트 톤.',
    palette: {
      background: 'radial-gradient(ellipse at 30% 20%, #818cf8 0%, #06b6d4 50%, #1e1b4b 100%)',
      surface: 'rgba(255,255,255,0.12)',
      primary: '#ffffff',
      accent: '#7dd3fc',
      text: '#ffffff',
      muted: 'rgba(255,255,255,0.70)',
      divider: 'rgba(255,255,255,0.20)',
    },
    typography: {
      heading: "'SF Pro Display', 'Pretendard', sans-serif",
      body: "'SF Pro Text', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'SF Mono', monospace",
      titleSize: 64,
      headingSize: 40,
      bodySize: 24,
      captionSize: 16,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: {
      padding: 72,
      gridGap: 24,
      borderRadius: 28,
      shadow: '0 12px 40px rgba(15,15,40,0.30)',
    },
    promptHint: `
DESIGN SYSTEM — Glassmorphism:
- Background: rich radial gradient (indigo → cyan → deep navy). Add subtle noise via SVG filter feTurbulence if possible.
- All content cards are glass: background rgba(255,255,255,0.12), backdrop-filter blur(24px) saturate(180%), border 1px rgba(255,255,255,0.20), border-radius 28px.
- Text: white with thin shadow (0 1px 2px rgba(0,0,0,0.20)). Accent sky #7dd3fc for KPI numbers.
- Title slide: large semi-bold title centered, subtitle below at 70% opacity, no decorative shapes (let the gradient breathe).
- Content slides: floating glass cards on the gradient backdrop. Sections use icons inside circular glass pills.
- Apple Keynote-like minimalism with depth from blur and gradient.
- Use SF Pro / Pretendard. Numbers in tabular-nums style.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'bauhaus-geometric',
    name: '바우하우스 기하학',
    nameEn: 'Bauhaus Geometric',
    description: '원색 + 큰 도형. 아트/디자인/스타트업 발표용.',
    palette: {
      background: '#f5f5dc',
      surface: '#ffffff',
      primary: '#dc2626',
      accent: '#fbbf24',
      secondary: '#2563eb',
      text: '#000000',
      muted: '#404040',
      divider: '#000000',
    },
    typography: {
      heading: "'Futura', 'Pretendard', sans-serif",
      body: "'Futura', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 80,
      headingSize: 48,
      bodySize: 24,
      captionSize: 16,
      weights: { title: 900, heading: 800, body: 500, caption: 700 },
    },
    layout: {
      padding: 64,
      gridGap: 32,
      borderRadius: 0,
      shadow: 'none',
    },
    promptHint: `
DESIGN SYSTEM — Bauhaus Geometric:
- Cream background #f5f5dc. Use primary colors: red #dc2626, yellow #fbbf24, blue #2563eb.
- All text BLACK #000000. Heavy black borders 4-8px on shapes.
- Decorative composition: large primary-colored circles, squares, triangles arranged geometrically as background (CSS shapes only).
- Title slide: massive sans-serif title (Futura/Pretendard 700-900 weight), giant geometric shapes (red circle + yellow square + blue triangle) tiled in the background.
- Content slides: section headings inside black-bordered colored boxes (red/yellow/blue rotating).
- Strong horizontal/vertical lines as dividers (4-8px solid black).
- NO gradients, NO shadows, NO rounded corners. Pure geometric flat color.
- Use thick black rules to separate quadrants of the slide.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'academic-journal',
    name: '학술 저널',
    nameEn: 'Academic Journal',
    description: '학술 페이퍼 톤 + 본문 중심. 연구 발표/논문 리뷰용.',
    palette: {
      background: '#fdfdfb',
      surface: '#f5f5f0',
      primary: '#1f2937',
      accent: '#7c2d12',
      text: '#1f2937',
      muted: '#6b7280',
      divider: '#9ca3af',
    },
    typography: {
      heading: "'Computer Modern', 'Noto Serif KR', serif",
      body: "'Computer Modern', 'Noto Serif KR', Georgia, serif",
      mono: "'CMU Typewriter', 'Courier New', monospace",
      titleSize: 48,
      headingSize: 32,
      bodySize: 22,
      captionSize: 16,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: {
      padding: 80,
      gridGap: 24,
      borderRadius: 0,
      shadow: 'none',
    },
    promptHint: `
DESIGN SYSTEM — Academic Journal:
- Paper-like background #fdfdfb. Surfaces #f5f5f0.
- Serif throughout — emulate Computer Modern / LaTeX-style typography.
- Title slide: paper-style — title 48px centered, byline of authors below (small caps), affiliations smaller still.
- Content slides: section headings numbered ("1. Introduction", "2. Method") in 32px serif bold.
- Use small caps for figure / table captions ("Fig. 1", "Table 2").
- Equations and code in serif monospace, lightly tinted background.
- Footnote-style citations bottom of slide in 12px superscript.
- Accent dark-brown #7c2d12 ONLY for highlighted terms / new concepts (italic + colored).
- Very conservative whitespace, almost like a printed page.
- Reads like an arXiv preprint or NeurIPS proceedings.
`.trim(),
  },
];

export function getDesignSystem(id) {
  return SLIDE_DESIGN_SYSTEMS.find((d) => d.id === id) || SLIDE_DESIGN_SYSTEMS[0];
}

export function listDesignSystems() {
  return SLIDE_DESIGN_SYSTEMS.map(({ id, name, nameEn, description, palette }) => ({
    id,
    name,
    nameEn,
    description,
    swatch: [palette.background, palette.primary, palette.accent].filter((c) => !c.startsWith('linear') && !c.startsWith('radial')),
  }));
}

/**
 * Gemini prompt 에 인라인 삽입할 디자인 시스템 가이드 블록을 만든다.
 */
export function buildDesignSystemPromptBlock(designSystemId) {
  const ds = getDesignSystem(designSystemId);
  if (!ds) return '';
  return `

========================================
APPLY THIS DESIGN SYSTEM TO EVERY SLIDE:
========================================
Name: ${ds.name} (${ds.nameEn})
Identity: ${ds.description}

${ds.promptHint}

Color tokens (use these exact values inline):
- background: ${ds.palette.background}
- surface: ${ds.palette.surface}
- primary: ${ds.palette.primary}
- accent: ${ds.palette.accent}
- text: ${ds.palette.text}
- muted: ${ds.palette.muted}
- divider: ${ds.palette.divider}

Typography (use these exact values, but you may shrink if content overflows):
- heading font-family: ${ds.typography.heading}
- body font-family: ${ds.typography.body}
- title slide title size: ${ds.typography.titleSize}px (weight ${ds.typography.weights.title})
- section heading size: ${ds.typography.headingSize}px (weight ${ds.typography.weights.heading})
- body size: ${ds.typography.bodySize}px (weight ${ds.typography.weights.body})
- caption size: ${ds.typography.captionSize}px (weight ${ds.typography.weights.caption})

Layout tokens:
- safe padding: ${ds.layout.padding}px
- grid gap: ${ds.layout.gridGap}px
- border-radius: ${ds.layout.borderRadius}px
- shadow: ${ds.layout.shadow}

EVERY slide MUST visually look like it comes from this design system. Be consistent across the deck.
========================================
`.trim();
}
