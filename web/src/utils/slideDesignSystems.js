// 프리젠테이션 변환에 사용할 디자인 시스템 카탈로그.
// 이 카탈로그는 IR (Investor Relations) / 비즈니스 제안 / 컨설팅 / 연차보고서
// 등 "정장 · 데이터 · 신뢰감" 톤만 모은다. 마케팅 키노트나 캐주얼한 톤은
// 의도적으로 제외한다.
//
// convertHtmlToSlides(html, { designSystemId }) 에서 시스템 객체를 꺼내
// SYSTEM_PROMPT 에 인라인 주입한다.

export const SLIDE_DESIGN_SYSTEMS = [
  // ─────────────────────────────────────────────────────────────
  {
    id: 'executive-navy',
    name: 'Executive Navy',
    nameEn: 'Executive Navy',
    description: '진한 네이비 + 금색 액센트. 정통 IR 보고서 톤.',
    palette: {
      background: '#ffffff',
      surface: '#f8fafc',
      primary: '#0b1f4a',
      accent: '#b8860b',
      text: '#0f172a',
      muted: '#475569',
      divider: '#0b1f4a',
    },
    typography: {
      heading: "'Noto Serif KR', 'Times New Roman', serif",
      body: "'Noto Sans KR', sans-serif",
      mono: "'Source Code Pro', monospace",
      titleSize: 52,
      headingSize: 36,
      bodySize: 22,
      captionSize: 14,
      weights: { title: 700, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 72, gridGap: 24, borderRadius: 4, shadow: '0 1px 2px rgba(11,31,74,0.08)' },
    promptHint: `
DESIGN SYSTEM — Executive Navy (IR / Annual Report):
- Top brand band: full-width 56px deep navy #0b1f4a with thin 2px gold #b8860b underline; company logo placeholder on left, slide number "01 / NN" right-aligned in gold.
- Body white #ffffff. Serif title (Noto Serif KR), sans-serif body.
- Section heading 36px navy bold, with 4px gold left border. Body 22px slate.
- Data tables: navy header row, white text, alternating rows #f8fafc with subtle gold tick on KPI cells.
- KPI tiles: navy outlined cards with massive serif numbers in gold #b8860b and 14px caption beneath.
- Always include footer line at bottom: tiny gold rule + "Confidential · For Investor Use Only" 12px caption.
- No gradients, no decorative shapes. Authority and restraint.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'wallstreet-charcoal',
    name: 'Wall Street Charcoal',
    nameEn: 'Wall Street Charcoal',
    description: '차콜 그레이 + 금색. 골드만삭스류 IB 발표 톤.',
    palette: {
      background: '#1f2937',
      surface: '#111827',
      primary: '#f5d76e',
      accent: '#cbd5e1',
      text: '#f8fafc',
      muted: '#94a3b8',
      divider: '#374151',
    },
    typography: {
      heading: "'Georgia', 'Noto Serif KR', serif",
      body: "'Helvetica Neue', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 48,
      headingSize: 32,
      bodySize: 20,
      captionSize: 13,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: { padding: 64, gridGap: 20, borderRadius: 0, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Wall Street Charcoal (Investment Banking Pitch):
- Dark charcoal background #1f2937. Surfaces #111827.
- Gold #f5d76e as the SINGLE highlight color, used only for KPI numbers, headings, and underlines.
- Body text #f8fafc, muted captions #94a3b8.
- Title slide: large serif title in gold, deal codename label in mono uppercase, classified-style footer "DRAFT · CONFIDENTIAL".
- Content slides: section heading 32px gold serif, subtle gold underline. Body in clean sans-serif.
- Pitch-book vibe — strict left-right two-column layout with thin vertical 1px divider #374151 between columns.
- Tables minimal, no fills — only horizontal hairline rules in gray. Numbers monospaced for alignment.
- No rounded corners (border-radius 0). No shadows. Premium and severe.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'tech-ipo-bold',
    name: 'Tech IPO Bold',
    nameEn: 'Tech IPO Bold',
    description: '진한 블루 + 흰색 + 큰 KPI 숫자. 테크 IPO 키노트.',
    palette: {
      background: '#ffffff',
      surface: '#eff6ff',
      primary: '#1d4ed8',
      accent: '#0ea5e9',
      text: '#0f172a',
      muted: '#475569',
      divider: '#dbeafe',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 72,
      headingSize: 48,
      bodySize: 24,
      captionSize: 14,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 80, gridGap: 28, borderRadius: 10, shadow: '0 2px 8px rgba(29,78,216,0.06)' },
    promptHint: `
DESIGN SYSTEM — Tech IPO Bold:
- White background. Surface tiles #eff6ff with thin 1px primary border for KPI cards.
- Primary deep blue #1d4ed8, accent sky #0ea5e9. Text near-black.
- Title slide: oversized 72-96px sans-serif title in primary, single subtitle 28px slate beneath.
- KPI-first layout: each slide has 3-4 big KPI tiles up top (giant 64px numbers in primary, 14px caption uppercase, optional ▲▼ tick in green/red).
- Use thin progress bars for adoption / penetration metrics, all in primary.
- Section heading 48px bold. Body 24px slate.
- Charts: only line + bar, all primary/accent two-color palette, light grid #dbeafe.
- Vibe: confident growth story (Series D / pre-IPO roadshow).
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'consulting-pure',
    name: 'Consulting Pure',
    nameEn: 'Consulting Pure',
    description: '흰 배경 + 차분한 네이비 + 그리드. McKinsey/Bain/BCG deck 톤.',
    palette: {
      background: '#ffffff',
      surface: '#f1f5f9',
      primary: '#1e293b',
      accent: '#0369a1',
      text: '#0f172a',
      muted: '#64748b',
      divider: '#cbd5e1',
    },
    typography: {
      heading: "'Helvetica Neue', 'Arial', 'Noto Sans KR', sans-serif",
      body: "'Helvetica Neue', 'Arial', 'Noto Sans KR', sans-serif",
      mono: "'Courier New', monospace",
      titleSize: 40,
      headingSize: 28,
      bodySize: 18,
      captionSize: 12,
      weights: { title: 700, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 56, gridGap: 16, borderRadius: 2, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Consulting Pure (McKinsey / Bain / BCG style):
- White background. Strict 12-column grid feel.
- Top of every slide: one-line "action title" 28px bold dark slate, summarising the SO WHAT of the slide.
- Below action title: thin 1px horizontal divider #cbd5e1.
- Source line bottom-left in 12px muted italic ("Source: ..."), page number bottom-right ("Page NN").
- Heavy use of boxes / matrices / 2x2 grids with thin slate borders. Quadrants labelled in top corners.
- Charts get a 1-line takeaway label inside the chart area, often with an arrow pointing to a data point.
- Helvetica throughout — no serif. Body 18px slate, weights restrained.
- Color discipline: only slate and ONE accent blue #0369a1 (used sparingly to highlight the conclusion).
- Vibe: management consulting deliverable — analytic, neutral, exhaustive.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'quarterly-earnings',
    name: 'Quarterly Earnings',
    nameEn: 'Quarterly Earnings',
    description: '흰 배경 + 검정 + 빨강/녹색 변화율. 분기 실적 발표 톤.',
    palette: {
      background: '#ffffff',
      surface: '#fafafa',
      primary: '#000000',
      accent: '#dc2626',
      secondary: '#16a34a',
      text: '#171717',
      muted: '#525252',
      divider: '#e5e5e5',
    },
    typography: {
      heading: "'Helvetica Neue', 'Pretendard', sans-serif",
      body: "'Helvetica Neue', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 44,
      headingSize: 32,
      bodySize: 20,
      captionSize: 13,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 64, gridGap: 20, borderRadius: 0, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Quarterly Earnings:
- Pure white background. Pure black headings #000000.
- Red #dc2626 for negative variance / decline, green #16a34a for positive growth — used ONLY on numbers (▲ +12% / ▼ −3%).
- Title slide: "FY2026 Q2 Earnings Results" style massive 44px headline, fiscal period in mono uppercase.
- Each slide top-left: small fiscal-period chip "FY2026 Q2" in mono 13px.
- Comparison tables (YoY, QoQ) are central: header row in light gray #e5e5e5, fixed-width mono numbers, variance column tinted red/green.
- Bullet lists are tight, 20px, with single-line callouts only.
- Bottom-right: tiny "(Unaudited)" disclaimer.
- No decorative graphics. Maximum information density. Conference-call deck vibe.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'venture-pitch',
    name: 'Venture Pitch',
    nameEn: 'Venture Pitch',
    description: '깔끔한 흰 + 보라/인디고 액센트 + 큰 비전 문구. Series A 피치덱.',
    palette: {
      background: '#ffffff',
      surface: '#f5f3ff',
      primary: '#6d28d9',
      accent: '#0ea5e9',
      text: '#0f172a',
      muted: '#475569',
      divider: '#e9d5ff',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 60,
      headingSize: 40,
      bodySize: 22,
      captionSize: 14,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 72, gridGap: 24, borderRadius: 12, shadow: '0 4px 12px rgba(109,40,217,0.08)' },
    promptHint: `
DESIGN SYSTEM — Venture Pitch (YC / Series A style):
- White background. Surface cards #f5f3ff with thin 1px primary border, 12px radius.
- Primary indigo-purple #6d28d9, accent sky #0ea5e9 for hyperlinks / secondary highlights.
- Title slide: huge single-sentence vision statement (60-72px), one-liner under it in muted slate. Tiny mono "v.1 · 2026" tag bottom-left.
- "Problem / Solution / Market / Traction / Team / Ask" sequence — each slide ONE big idea.
- Big % growth / TAM numbers in primary, 80-96px font, with one-line context underneath.
- Team slide: round headshots in a horizontal row with name + 1-line role.
- Traction slides emphasise a single line chart (primary line, light grid) with a callout label on the latest data point.
- Vibe: confident-but-readable founder pitch deck.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'annual-report',
    name: 'Annual Report',
    nameEn: 'Annual Report',
    description: '베이지/크림 + 갈색 + Serif. 정통 연차보고서 톤.',
    palette: {
      background: '#fdfaf3',
      surface: '#f5efe0',
      primary: '#5b3a1c',
      accent: '#b8860b',
      text: '#2a1f12',
      muted: '#6b5638',
      divider: '#c9b690',
    },
    typography: {
      heading: "'Noto Serif KR', 'Garamond', serif",
      body: "'Noto Serif KR', Georgia, serif",
      mono: "'Courier New', monospace",
      titleSize: 48,
      headingSize: 32,
      bodySize: 20,
      captionSize: 13,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: { padding: 80, gridGap: 24, borderRadius: 0, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Annual Report:
- Warm cream paper #fdfaf3. Surface beige #f5efe0.
- Brown #5b3a1c primary, accent gold #b8860b. All serif.
- Title slide: paper-style — large italic serif title centered, fiscal year "FY 2026 Annual Report" small caps below, thin gold rule above and below.
- Each section opens with a chapter number "01 · 사업 개요" in small caps gold.
- Body: justified 20px serif, classic newspaper-like column flow.
- Pull quotes get massive gold opening quotation mark "" with quote in serif italic.
- Footnotes 13px serif italic at the bottom.
- Tables minimal: only thin gold rules, never solid fills.
- Vibe: prestigious printed annual report (Samsung / LG / 포스코).
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'strategy-dashboard',
    name: 'Strategy Dashboard',
    nameEn: 'Strategy Dashboard',
    description: '어두운 데이터 시각화 톤 + 차트 강조. 전략 대시보드 발표.',
    palette: {
      background: '#0f172a',
      surface: '#1e293b',
      primary: '#22d3ee',
      accent: '#f59e0b',
      text: '#f8fafc',
      muted: '#94a3b8',
      divider: '#334155',
    },
    typography: {
      heading: "'Inter', 'Pretendard', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 40,
      headingSize: 28,
      bodySize: 18,
      captionSize: 12,
      weights: { title: 700, heading: 600, body: 400, caption: 600 },
    },
    layout: { padding: 48, gridGap: 16, borderRadius: 8, shadow: '0 0 0 1px rgba(34,211,238,0.20)' },
    promptHint: `
DESIGN SYSTEM — Strategy Dashboard:
- Dark navy background #0f172a. Tile surface #1e293b with 1px cyan border at 20% opacity.
- Cyan #22d3ee for primary metrics, amber #f59e0b for alerts / call-outs.
- Multi-tile dashboard layout per slide: 2x3 or 3x3 grid of KPI tiles + one larger chart panel.
- Each KPI tile: small uppercase mono label 12px muted, then big 40-56px number in cyan, then ▲/▼ delta in amber.
- Charts: minimal axes, white grid at 8% opacity, single accent line/area in cyan.
- Tables monospaced for column alignment.
- Vibe: a board-of-directors strategy review built in a BI tool (Looker / Tableau).
- Always include a "Last updated: YYYY-MM-DD" small label top-right in muted gray.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'roadshow-premium',
    name: 'Roadshow Premium',
    nameEn: 'Roadshow Premium',
    description: '진한 부르고뉴 + 골드 + Serif. 프리미엄 로드쇼.',
    palette: {
      background: '#1a0b10',
      surface: '#2a1018',
      primary: '#d4af37',
      accent: '#e5e7eb',
      text: '#f8fafc',
      muted: '#cbd5e1',
      divider: '#4a1d2a',
    },
    typography: {
      heading: "'Playfair Display', 'Noto Serif KR', serif",
      body: "'Noto Serif KR', Georgia, serif",
      mono: "'Times New Roman', serif",
      titleSize: 56,
      headingSize: 36,
      bodySize: 22,
      captionSize: 14,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: { padding: 80, gridGap: 24, borderRadius: 4, shadow: '0 4px 24px rgba(212,175,55,0.10)' },
    promptHint: `
DESIGN SYSTEM — Roadshow Premium:
- Deep burgundy background #1a0b10. Surface darker plum #2a1018 with 1px gold border at 30% opacity.
- Champagne gold #d4af37 as the ONLY highlight color (used on KPI numbers and headings).
- Text in cream white #f8fafc. Italic serif headings (Playfair Display).
- Title slide: ornate gold rule above and below a large serif italic title centered, with smaller "Confidential Investor Presentation · MMM YYYY" below in muted serif.
- Page numbers bottom-center in gold "— 01 —" decoration style.
- Data tables: gold border-top/bottom, no vertical lines, numbers in serif.
- Vibe: black-tie luxury / family-office / private placement deck. Restrained but luxurious.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'financial-times',
    name: 'Financial Times Editorial',
    nameEn: 'Financial Times Editorial',
    description: 'FT 핑크 + 검정 + Serif. 금융지 에디토리얼 톤.',
    palette: {
      background: '#fff1e5',
      surface: '#ffffff',
      primary: '#000000',
      accent: '#990f3d',
      text: '#0d0d0d',
      muted: '#66605c',
      divider: '#000000',
    },
    typography: {
      heading: "'Financier', 'Noto Serif KR', 'Georgia', serif",
      body: "'Source Serif Pro', 'Noto Serif KR', Georgia, serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 56,
      headingSize: 36,
      bodySize: 20,
      captionSize: 13,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 64, gridGap: 20, borderRadius: 0, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Financial Times Editorial:
- Background salmon pink #fff1e5 (FT signature paper color). Surfaces pure white #ffffff.
- All headings in heavy black serif (Financier-like). Body in Source Serif Pro.
- Accent claret red #990f3d used only for breaking-emphasis labels ("EXCLUSIVE", "ANALYSIS").
- Title slide: oversized 56-72px black serif headline, byline "By Antonio Kim" in italic serif below, date in small caps.
- Section heading 36px serif bold, with thin 4px black underline.
- Two-column body for content slides — newspaper feel.
- Pull-quote: large italic serif with thick black left border 4px.
- Charts adopt FT minimalist style: small mono axes, one bold red line, light dotted grid.
- Vibe: prestigious financial-press editorial spread.
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
Audience: investors / executives / boards / clients. Tone: data-driven, restrained, trustworthy.
========================================
`.trim();
}

// localStorage 에 옛 (modern-minimal / dark-tech 등) ID 가 남아있을 수 있어
// 첫 로드 시 새 카탈로그에 없는 ID 는 안전한 기본값으로 마이그레이션.
export function migrateDesignSystemId(maybeId) {
  if (!maybeId) return SLIDE_DESIGN_SYSTEMS[0].id;
  if (SLIDE_DESIGN_SYSTEMS.find((d) => d.id === maybeId)) return maybeId;
  return SLIDE_DESIGN_SYSTEMS[0].id;
}
