// 프리젠테이션 변환에 사용할 디자인 시스템 카탈로그 (총 24종).
// 크게 두 그룹:
//   (A) 비즈니스/IR/컨설팅/연차보고서/에디토리얼 — "정장 · 데이터 · 신뢰감" 톤
//   (B) 예쁜/다양 — 인기 팔레트(Catppuccin/Rosé Pine/Tokyo Night/Dracula/Solarized/
//       Gruvbox)와 2026 트렌드(warm editorial/sage/coral/mint/midnight-gold) 차용
// 단 모든 프리셋은 클라이언트 PPTX export 제약을 지킨다: solid 컬러만, 계층은
// muted color 로(opacity 금지), CSS gradient/box-shadow/glassmorphism 금지.
//
// 구조는 2축이다 (Slidev 차용):
//   테마 = 색·폰트·무드 (아래 SLIDE_DESIGN_SYSTEMS 프리셋)
//   레이아웃 = 슬라이드별 구조 (SLIDE_LAYOUTS 카탈로그)
// buildDesignSystemPromptBlock() 이 [테마 + 공용 무드 관례 + 레이아웃 카탈로그]를
// 함께 SYSTEM_PROMPT 에 인라인 주입한다.
//
// convertHtmlToSlides(html, { designSystemId }) 에서 시스템 객체를 꺼내 사용한다.

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

  // ───────────────────────────────────────────────────────────── (Slidev 차용)
  {
    id: 'editorial-seriph',
    name: 'Editorial Seriph',
    nameEn: 'Editorial Seriph',
    description: '차분한 dusty teal + 세리프 제목·본문. 리서치/에디토리얼 톤. (Slidev seriph)',
    palette: {
      background: '#ffffff',
      surface: '#f6f8f9',
      primary: '#5d8392',
      accent: '#5d8392',
      text: '#1a2b32',
      muted: '#6b7c85',
      divider: '#dbe3e7',
    },
    typography: {
      heading: "'PT Serif', 'Noto Serif KR', Georgia, serif",
      body: "'PT Serif', 'Noto Serif KR', Georgia, serif",
      mono: "'PT Mono', 'Source Code Pro', monospace",
      titleSize: 60,
      headingSize: 36,
      bodySize: 20,
      captionSize: 14,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 2, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Editorial Seriph (research / editorial, borrowed from Slidev seriph):
- White background, both title AND body in serif (PT Serif). Restrained, literary.
- Primary dusty teal-blue #5d8392 — used on h1 titles and thin rules only. Everything else near-black #1a2b32.
- Cover / section: centered, serif title 60px weight 400-700 with generous whitespace; kicker label above in uppercase muted.
- Body: 20px serif, line-height 1.6, comfortable measure (max ~30em). Never dense.
- Pull quotes: large serif italic with a thin teal left rule.
- Hierarchy comes from whitespace, size, and the muted color token (#6b7c85) — never CSS opacity. No gradients, no shadows, no rounded cards.
- Vibe: academic paper / long-form report / whitepaper.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'geist-mono',
    name: 'Geist Monochrome',
    nameEn: 'Geist Monochrome',
    description: '순수 흑백 + 회색 스케일 + Inter. 극단적 미니멀 테크/SaaS. (Slidev geist / Vercel)',
    palette: {
      background: '#ffffff',
      surface: '#fafafa',
      primary: '#000000',
      accent: '#171717',
      text: '#0a0a0a',
      muted: '#737373',
      divider: '#eaeaea',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'Menlo', 'JetBrains Mono', monospace",
      titleSize: 60,
      headingSize: 36,
      bodySize: 18,
      captionSize: 14,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 6, shadow: '0 1px 2px rgba(0,0,0,0.04)' },
    promptHint: `
DESIGN SYSTEM — Geist Monochrome (Vercel Geist design system, via Slidev geist):
- Pure monochrome: white background, black #000000, and a GRAYSCALE ramp (#0a0a0a text, #737373 muted, #eaeaea dividers). NO chromatic accent color at all.
- Hierarchy is built from weight, size, and the GRAYSCALE ramp (muted #737373 as an explicit solid color) — never CSS opacity, and never a chromatic accent.
- Cover: large 60px title weight 700, one-line subtitle in #737373. Tiny mono tag bottom-left ("2026 · v1").
- Cards / tiles: white with thin 1px #eaeaea border, 6px radius, near-invisible shadow. Lots of negative space.
- Labels & metadata in mono uppercase 14px muted.
- Charts: single black line/bar on light gray grid. Monochrome only.
- Vibe: developer-tool / SaaS product launch — clinical, precise, expensive-minimal.
`.trim(),
  },

  // ─────────────────────────────────────────────────────────────
  {
    id: 'nord-dark',
    name: 'Nord Dark',
    nameEn: 'Nord Dark',
    description: '북유럽 한랭 다크 팔레트 + frost blue. 기술 리뷰/개발자 발표. (Slidev nord)',
    palette: {
      background: '#2e3440',
      surface: '#3b4252',
      primary: '#88c0d0',
      accent: '#81a1c1',
      text: '#eceff4',
      muted: '#d8dee9',
      divider: '#434c5e',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
      titleSize: 52,
      headingSize: 32,
      bodySize: 18,
      captionSize: 13,
      weights: { title: 700, heading: 600, body: 400, caption: 600 },
    },
    layout: { padding: 56, gridGap: 20, borderRadius: 8, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Nord Dark (Nord palette, via Slidev nord):
- Fixed Nord palette. Background Polar Night #2e3440, tile surface #3b4252, borders #434c5e.
- Text Snow Storm #eceff4 / muted #d8dee9. Frost blue #88c0d0 is the primary accent (headings, KPI numbers, links); #81a1c1 secondary.
- Status / delta colors use Aurora ONLY on small tokens: green #a3be8c (up/ok), red #bf616a (down/alert), yellow #ebcb8b (warn), purple #b48ead (special).
- Cards: #3b4252 tiles, 8px radius, 1px #434c5e border. Calm and even — low contrast, no harsh pure-black or pure-white.
- Mono labels for metrics. Charts: frost-blue line/area on faint white grid.
- Vibe: technical architecture review / engineering deep-dive, calm and cold.
`.trim(),
  },

  // ═════════════ 예쁜·다양한 프리셋 (인기 팔레트 / 2026 트렌드 차용) ═════════════
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    nameEn: 'Catppuccin Mocha',
    description: '부드러운 파스텔 다크. 개발자 최애 테마. mauve/blue 액센트.',
    palette: {
      background: '#1e1e2e', surface: '#313244', primary: '#cba6f7', accent: '#89b4fa',
      text: '#cdd6f4', muted: '#a6adc8', divider: '#45475a',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 60, headingSize: 34, bodySize: 19, captionSize: 14,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 14, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Catppuccin Mocha (soft pastel dark):
- Background #1e1e2e, cards/tiles surface #313244 with 14px radius and 1px #45475a border.
- Text #cdd6f4, muted #a6adc8. Pastel accents: mauve #cba6f7 (primary, headings/KPIs), blue #89b4fa (links/secondary). Optional pink #f5c2e7, green #a6e3a1 for tags.
- Soft, low-contrast, cozy. Use rounded cards and generous spacing.
- Muted text via the muted color token (never opacity). No gradients, no glassmorphism.
- Vibe: friendly modern product / dev-tool deck with a soothing pastel palette.
`.trim(),
  },

  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    nameEn: 'Rosé Pine Dawn',
    description: '우아한 뮤트 로즈/파인 (라이트). 클래식 미니멀 에디토리얼.',
    palette: {
      background: '#faf4ed', surface: '#fffaf3', primary: '#286983', accent: '#d7827e',
      text: '#575279', muted: '#797593', divider: '#dfdad9',
    },
    typography: {
      heading: "'PT Serif', 'Noto Serif KR', Georgia, serif",
      body: "'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'PT Mono', monospace",
      titleSize: 56, headingSize: 34, bodySize: 20, captionSize: 14,
      weights: { title: 700, heading: 700, body: 400, caption: 500 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 10, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Rosé Pine Dawn (elegant muted, light):
- Warm off-white background #faf4ed, surface #fffaf3. Muted plum text #575279.
- Pine #286983 primary (titles/rules), rose #d7827e accent, gold #ea9d34 for small highlights.
- Serif titles (PT Serif), sans body. Classy, restrained, editorial whitespace.
- Hierarchy via muted color #797593 + size + serif/sans contrast — never opacity.
- Soft 10px rounded surfaces, hairline #dfdad9 dividers. No gradients, no shadows-as-meaning.
- Vibe: refined minimalist essay / boutique brand deck.
`.trim(),
  },

  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    nameEn: 'Tokyo Night',
    description: '네온 다크. 하이테크·AI 제품 톤. blue/purple/cyan 네온.',
    palette: {
      background: '#1a1b26', surface: '#24283b', primary: '#7aa2f7', accent: '#bb9af7',
      text: '#c0caf5', muted: '#9aa5ce', divider: '#414868',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 60, headingSize: 34, bodySize: 18, captionSize: 13,
      weights: { title: 800, heading: 600, body: 400, caption: 600 },
    },
    layout: { padding: 56, gridGap: 20, borderRadius: 12, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Tokyo Night (neon dark, high-tech):
- Deep night background #1a1b26, tile surface #24283b with 1px #414868 border.
- Text #c0caf5, muted #9aa5ce. Neon accents: blue #7aa2f7 (primary), purple #bb9af7 (accent), cyan #7dcfff, green #9ece6a for status.
- KPI numbers and headings in the neon accents; keep the rest calm.
- Mono labels 13px for metrics. Solid fills only, muted color for de-emphasis (never opacity/gradient/glow-image).
- Vibe: modern AI / infra / developer product keynote.
`.trim(),
  },

  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    nameEn: 'Warm Editorial',
    description: '크림+테라코타 따뜻한 뉴트럴. 라이프스타일·브랜딩 에디토리얼.',
    palette: {
      background: '#fdf6ec', surface: '#f6ead6', primary: '#c65f3f', accent: '#b07d48',
      text: '#3a2e28', muted: '#8a7563', divider: '#e5d5be',
    },
    typography: {
      heading: "'Fraunces', 'Noto Serif KR', Georgia, serif",
      body: "'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 58, headingSize: 34, bodySize: 20, captionSize: 14,
      weights: { title: 700, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 64, gridGap: 24, borderRadius: 8, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Warm Editorial (cream + terracotta):
- Warm cream background #fdf6ec, surface #f6ead6. Espresso text #3a2e28.
- Terracotta #c65f3f primary (titles/emphasis), warm ochre #b07d48 accent.
- Editorial serif titles (Fraunces), clean sans body. Magazine-like generous margins.
- Muted brown #8a7563 for captions/de-emphasis — never opacity. Hairline #e5d5be rules.
- Solid warm blocks, no gradients. Big pull-quotes in serif.
- Vibe: lifestyle / brand / lookbook editorial spread — warm and human.
`.trim(),
  },

  {
    id: 'sage-botanical',
    name: 'Sage Botanical',
    nameEn: 'Sage Botanical',
    description: '내추럴 세이지 그린 + 크림 (라이트). 웰니스·지속가능·오가닉.',
    palette: {
      background: '#f4f6f2', surface: '#e7ede2', primary: '#3a5a40', accent: '#7a9b76',
      text: '#2f3b30', muted: '#6a756a', divider: '#d5ddcf',
    },
    typography: {
      heading: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 56, headingSize: 34, bodySize: 20, captionSize: 14,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: { padding: 60, gridGap: 24, borderRadius: 16, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Sage Botanical (natural green, light):
- Soft cream-green background #f4f6f2, surface #e7ede2 with 16px rounded cards.
- Deep forest #3a5a40 primary, sage #7a9b76 accent. Text #2f3b30, muted #6a756a.
- Calm, organic, breathable. Rounded soft cards, generous whitespace.
- De-emphasis via muted color (never opacity). Solid fills, no gradients.
- Vibe: wellness / sustainability / ESG / organic brand — grounded and calm.
`.trim(),
  },

  {
    id: 'coral-pop',
    name: 'Coral Pop',
    nameEn: 'Coral Pop',
    description: '코랄+피치 파스텔 (라이트). 친근·창의적. 밝고 에너지.',
    palette: {
      background: '#fff7f2', surface: '#ffe9e0', primary: '#e0533d', accent: '#ff8a5c',
      text: '#3a2b26', muted: '#8a726a', divider: '#ffdccd',
    },
    typography: {
      heading: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 62, headingSize: 36, bodySize: 20, captionSize: 14,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 18, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Coral Pop (warm coral pastel, light):
- Soft peach-white background #fff7f2, surface #ffe9e0 with big 18px rounded cards.
- Coral #e0533d primary (bold titles/CTAs), peach #ff8a5c accent. Text #3a2b26, muted #8a726a.
- Friendly, energetic, rounded. Oversized bold titles, playful but clean.
- De-emphasis via muted color (never opacity). Solid color blocks, no gradients.
- Vibe: creative studio / consumer app / community brand — approachable and warm.
`.trim(),
  },

  {
    id: 'dracula',
    name: 'Dracula',
    nameEn: 'Dracula',
    description: '클래식 다크 퍼플/핑크. 대담하고 플레이풀한 개발자 톤.',
    palette: {
      background: '#282a36', surface: '#343746', primary: '#bd93f9', accent: '#ff79c6',
      text: '#f8f8f2', muted: '#9ea4c4', divider: '#44475a',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 60, headingSize: 34, bodySize: 18, captionSize: 13,
      weights: { title: 800, heading: 600, body: 400, caption: 600 },
    },
    layout: { padding: 56, gridGap: 20, borderRadius: 12, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Dracula (bold dark purple/pink):
- Background #282a36, surface #343746 with 1px #44475a border.
- Text #f8f8f2, muted #9ea4c4. Purple #bd93f9 primary, pink #ff79c6 accent; green #50fa7b, cyan #8be9fd for status/tags.
- Bold, confident, a touch playful. Vivid accents on numbers/headings, calm elsewhere.
- Muted color for de-emphasis (never opacity). Solid fills only, no gradients/glow images.
- Vibe: energetic developer / hackathon / product-launch deck.
`.trim(),
  },

  {
    id: 'solarized-light',
    name: 'Solarized Light',
    nameEn: 'Solarized Light',
    description: '아이코닉 밸런스 팔레트 (라이트). 크림 배경 + 블루/오렌지.',
    palette: {
      background: '#fdf6e3', surface: '#eee8d5', primary: '#268bd2', accent: '#cb4b16',
      text: '#073642', muted: '#657b83', divider: '#ded8c3',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      titleSize: 54, headingSize: 32, bodySize: 19, captionSize: 13,
      weights: { title: 700, heading: 600, body: 400, caption: 600 },
    },
    layout: { padding: 60, gridGap: 20, borderRadius: 8, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Solarized Light (iconic balanced palette):
- Warm paper background #fdf6e3, surface #eee8d5. Deep teal-ink text #073642.
- Blue #268bd2 primary, orange #cb4b16 accent (use sparingly for emphasis). Muted #657b83.
- Precise, balanced, easy on the eyes. Mono #IBM Plex for code/metrics.
- De-emphasis via muted color (never opacity). Solid fills, hairline #ded8c3 rules, no gradients.
- Vibe: engineering / documentation / research deck — calm and legible.
`.trim(),
  },

  {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    nameEn: 'Gruvbox Light',
    description: '레트로 웜 (라이트). 크림+머스터드/오렌지. 빈티지 감성.',
    palette: {
      background: '#fbf1c7', surface: '#f2e5bc', primary: '#b57614', accent: '#af3a03',
      text: '#3c3836', muted: '#7c6f64', divider: '#ebdbb2',
    },
    typography: {
      heading: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      body: "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 56, headingSize: 34, bodySize: 20, captionSize: 14,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 60, gridGap: 22, borderRadius: 8, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Gruvbox Light (retro warm):
- Warm cream background #fbf1c7, surface #f2e5bc. Dark bark text #3c3836.
- Mustard #b57614 primary, burnt orange #af3a03 accent; olive #79740e for secondary/status.
- Retro, cozy, high legibility. Chunky bold titles, warm solid blocks.
- Muted #7c6f64 for de-emphasis (never opacity). No gradients.
- Vibe: retro-tech / indie / craft brand deck — warm and characterful.
`.trim(),
  },

  {
    id: 'mint-fresh',
    name: 'Mint Fresh',
    nameEn: 'Mint Fresh',
    description: '클린 민트/틸 (라이트). 2026 Color of the Year 톤. 프레시 SaaS.',
    palette: {
      background: '#f2fbf9', surface: '#dcf3ee', primary: '#0f766e', accent: '#14b8a6',
      text: '#0f2e2a', muted: '#5b7d77', divider: '#c5e8e0',
    },
    typography: {
      heading: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 58, headingSize: 34, bodySize: 20, captionSize: 14,
      weights: { title: 700, heading: 600, body: 400, caption: 500 },
    },
    layout: { padding: 56, gridGap: 24, borderRadius: 14, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Mint Fresh (clean teal, light):
- Airy mint-white background #f2fbf9, surface #dcf3ee with 14px rounded cards.
- Deep teal #0f766e primary, bright teal #14b8a6 accent (Transformative-Teal, 2026 color of the year). Text #0f2e2a, muted #5b7d77.
- Crisp, fresh, trustworthy. Clean sans, plenty of white space.
- De-emphasis via muted color (never opacity). Solid fills, no gradients.
- Vibe: modern SaaS / health-tech / fintech product deck — fresh and clean.
`.trim(),
  },

  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    nameEn: 'Midnight Gold',
    description: '딥 인디고 + 골드 (다크). 모던 프리미엄. 럭셔리하지만 테크.',
    palette: {
      background: '#0f1226', surface: '#1b1f3a', primary: '#f5c451', accent: '#8b93ff',
      text: '#eef0ff', muted: '#a5adcf', divider: '#2c3157',
    },
    typography: {
      heading: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      body: "'Pretendard', 'Inter', 'Noto Sans KR', sans-serif",
      mono: "'JetBrains Mono', monospace",
      titleSize: 60, headingSize: 34, bodySize: 19, captionSize: 14,
      weights: { title: 800, heading: 700, body: 400, caption: 600 },
    },
    layout: { padding: 60, gridGap: 24, borderRadius: 12, shadow: 'none' },
    promptHint: `
DESIGN SYSTEM — Midnight Gold (deep indigo + gold, dark):
- Deep indigo background #0f1226, surface #1b1f3a with 1px #2c3157 border.
- Champagne gold #f5c451 primary (headings/KPIs), periwinkle #8b93ff accent. Text #eef0ff, muted #a5adcf.
- Modern premium — luxurious but techy, not ornate. Gold used sparingly on key numbers.
- De-emphasis via muted color (never opacity). Solid fills only, no gradients/glow.
- Vibe: premium product launch / fund / awards deck — sleek and confident.
`.trim(),
  },
];

// ───────────────────────────────────────────────────────────────────────────
// 2축 구조 (Slidev 차용): "테마(색·폰트, 위 카탈로그) × 레이아웃(구조, 아래)".
// 프리셋은 색/폰트/무드를, 레이아웃 카탈로그는 슬라이드별 구조를 담당한다.
// buildDesignSystemPromptBlock() 이 둘을 함께 프롬프트에 주입한다.
// ───────────────────────────────────────────────────────────────────────────

// 전 프리셋이 공유하는 타이포 스케일(px). 임의 크기 대신 이 단계를 재사용한다.
export const SHARED_TYPO_SCALE = {
  label: 14, small: 16, body: 20, lead: 24, h3: 30, heading: 36, display: 60, hero: 96,
};

// 캔버스/여백 기본 규격 (Slidev base).
export const SLIDE_BASE = {
  canvas: '1280x720',
  paddingVertical: 40,
  paddingHorizontal: 56,
  bodyLineHeight: 1.5,
};

// 색·톤과 무관하게 모든 슬라이드에 적용하는 타이포 무드 관례.
export const MOOD_CONVENTIONS = `
UNIVERSAL TYPOGRAPHY CONVENTIONS (apply on top of the design system):
- Eyebrow / kicker / category labels: UPPERCASE, letter-spacing 0.1em, weight 500, in the MUTED color token (not full-black).
- Subtitle directly under a title: use the MUTED color token — build hierarchy with COLOR (muted vs text) + WEIGHT + ALIGNMENT, not size alone.
- Do NOT rely on CSS opacity/rgba-alpha for text hierarchy: the native PPTX export ignores opacity, so a 0.5-opacity subtitle would export at full strength. Always express muted text with an explicit solid color (the muted token), never opacity.
- Large display titles: margin-left:-0.05em optical alignment so the cap edge lines up with the column below.
- Reuse the shared type scale (px) instead of arbitrary sizes: 14(label) · 16 · 20(body) · 24(lead) · 30 · 36(heading) · 60(cover/display) · 96(hero number).
- Body ~18-20px, line-height 1.5. Canvas 1280x720, safe padding 40px vertical / 56px horizontal.
- Use SOLID color fills only. AVOID CSS the PPTX export cannot reproduce and will silently drop: CSS gradients (linear/radial-gradient) on backgrounds OR text, background-clip:text, box-shadow used to convey meaning, and pseudo-element (::before/::after) content or bullets. Convey depth with solid surfaces + muted colors, and put real characters/markers in the DOM instead of ::before.
`.trim();

// 슬라이드 구조 레이아웃 카탈로그 (1280x720 인라인 CSS 재현 스펙).
export const SLIDE_LAYOUTS = [
  { id: 'cover', name: '표지', use: '첫 슬라이드/표지', spec: 'Vertically & horizontally centered. Title 60px (line-height ~1.1), subtitle 24px in the muted color below. Optional eyebrow label above title. Meta (date/version) small bottom-left.' },
  { id: 'section', name: '섹션 구분', use: '챕터/파트 전환', spec: 'Centered. Section number as uppercase label above, section title 60px weight 500-700. Lots of whitespace, minimal else.' },
  { id: 'statement', name: '선언', use: '핵심 한 문장', spec: 'Whole-canvas centered single sentence, 60px bold. Nothing else. High contrast with background.' },
  { id: 'fact', name: '팩트/숫자', use: '단일 대형 지표', spec: 'Centered. One huge number/fact 96px bold (in primary), one supporting line 24px below. For a single KPI/stat slide.' },
  { id: 'quote', name: '인용', use: '인용문', spec: 'Vertically centered. Large quote (serif italic if theme allows), source line 20px in the muted color with 8px top margin.' },
  { id: 'default', name: '기본', use: '일반 콘텐츠', spec: 'Top-left flow. Heading 36px at top, body 20px below. Free composition inside safe padding.' },
  { id: 'bullets', name: '불릿 리스트', use: '핵심 항목 나열', spec: 'Heading 36px, then a tight bullet list. All bullets share the SAME left x-edge, one marker style, marker-to-text gap 12px, identical size/weight/color per level.' },
  { id: 'two-cols', name: '2단', use: '비교/before-after', spec: 'grid 2 columns 50/50, each column has its own padding. Optional shared heading spanning full width on top. For comparisons.' },
  { id: 'two-cols-header', name: '헤더+2단', use: '헤더 아래 좌우', spec: 'grid rows [auto 1fr auto]: full-width header on top, then 50/50 left/right columns, optional full-width footer.' },
  { id: 'image-right', name: '우측 이미지', use: '설명+비주얼(가장 흔함)', spec: 'grid 2 cols: left 50% text (heading + body/bullets), right 50% image (background cover). Text keeps safe padding, image bleeds to edge.' },
  { id: 'image-left', name: '좌측 이미지', use: '비주얼+설명', spec: 'Mirror of image-right: left 50% image (background cover), right 50% text.' },
  { id: 'image', name: '이미지 메인', use: '풀블리드 비주얼', spec: 'Full-canvas background image (cover). Optional text overlay with a semi-opaque scrim behind it for legibility.' },
  { id: 'full', name: '전체 캔버스', use: '차트/다이어그램 전용', spec: 'Remove safe padding, use the entire 1280x720 for one chart, table, or diagram. Title optional as a small overlay.' },
  { id: 'end', name: '마지막', use: '마무리/감사', spec: 'Minimal centered closing ("감사합니다" / contact). Same restraint as cover.' },
];

// 레이아웃 카탈로그를 프롬프트 블록 문자열로.
export function buildLayoutCatalogBlock() {
  const lines = SLIDE_LAYOUTS.map((l) => `- ${l.id} (${l.name} · ${l.use}): ${l.spec}`).join('\n');
  return `
LAYOUT CATALOG — for EACH slide, pick the SINGLE most appropriate layout and build it exactly to spec.
All sizes in px, everything must fit inside ${SLIDE_BASE.canvas}. The design system above controls color & font; these control structure.
${lines}

Layout rules:
- First slide = cover. Last slide = end.
- Single big metric → fact. Comparison / two ideas → two-cols or image-right/left. A chart or diagram that needs room → full.
- Vary layouts across the deck; do not make every slide "default".
`.trim();
}

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
  // promptHint 에 placeholder 로 박힌 YYYY-MM-DD 를 오늘 날짜로 치환.
  // (Gemini 가 placeholder 를 그대로 출력하거나 "Last updated: 20" 처럼
  // 일부만 채워 넣는 현상 방지)
  const today = new Date().toISOString().slice(0, 10);
  const hint = ds.promptHint.replace(/YYYY-MM-DD/g, today);
  return `

========================================
APPLY THIS DESIGN SYSTEM TO EVERY SLIDE:
========================================
Name: ${ds.name} (${ds.nameEn})
Identity: ${ds.description}

${hint}

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

${MOOD_CONVENTIONS}

${buildLayoutCatalogBlock()}

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
