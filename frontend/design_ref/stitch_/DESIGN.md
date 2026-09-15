---
name: 맥(脈)
colors:
  # v2 (2026-09-15) 화이트 기반 재조정. 본문(## Colors)의 중성 회색 팔레트로 통일했다.
  surface: '#f5f6f8'
  surface-dim: '#c9d3df'
  surface-bright: '#ffffff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f8fa'
  surface-container: '#eef0f3'
  surface-container-high: '#e3e6eb'
  surface-container-highest: '#dfe3e8'
  on-surface: '#161b22'
  on-surface-variant: '#4a5361'
  inverse-surface: '#1f2937'
  inverse-on-surface: '#f3f4f6'
  outline: '#67717f'
  outline-variant: '#cdd3da'
  surface-tint: '#1f3a5f'
  primary: '#142b4a'
  on-primary: '#ffffff'
  primary-container: '#1f3a5f'
  on-primary-container: '#b9c8dd'
  inverse-primary: '#9fbde6'
  secondary: '#1a5fa7'
  on-secondary: '#ffffff'
  secondary-container: '#dbe8fa'
  on-secondary-container: '#0f3f78'
  tertiary: '#5a3a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#7a5200'
  on-tertiary-container: '#f2c46a'
  error: '#b42318'
  on-error: '#ffffff'
  error-container: '#fdebe9'
  on-error-container: '#8a1c14'
  primary-fixed: '#e2e9f3'
  primary-fixed-dim: '#b9c8dd'
  on-primary-fixed: '#0f2340'
  on-primary-fixed-variant: '#2d476d'
  secondary-fixed: '#e3edfb'
  secondary-fixed-dim: '#b7d0f2'
  on-secondary-fixed: '#0b2f5c'
  on-secondary-fixed-variant: '#0f4d8f'
  tertiary-fixed: '#fbe8c8'
  tertiary-fixed-dim: '#f2c46a'
  on-tertiary-fixed: '#3a2400'
  on-tertiary-fixed-variant: '#6b4300'
  background: '#f5f6f8'
  on-background: '#161b22'
  surface-variant: '#e3e6eb'
typography:
  display-kpi:
    fontFamily: Public Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-page:
    fontFamily: Public Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-section:
    fontFamily: Public Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-regular:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-medium:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  body-semibold:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  caption-regular:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  caption-medium:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  table-header:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  table-cell:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system establishes a high-trust, public-sector administrative analytics interface tailored for ministerial officials, regional policy planners, and municipal data scientists. The operational environment demands uncompromising visual discipline, high legibility under prolonged analytical review, and an aesthetic that translates seamlessly into official ministerial briefings, press releases, and printed government whitepapers.

The design philosophy blends **Modern Institutionalism** with **Analytical Restraint**:
- **Zero Decorative Noise:** Flashy multi-stop gradients, skeuomorphic glass treatments, decorative illustrations, and gratuitous micro-interactions are strictly prohibited.
- **Document-Ready Composition:** Every screen, table, and analytical card must maintain print-ready contrast, tabular visual clarity, and precise structural alignment suitable for immediate screen capture into executive policy decks.
- **Administrative Authority:** Visual weight is achieved through deep navy structural framing, crisp hairline dividers, robust information hierarchy, and dedicated state colors reflecting statistical diagnostic urgency.

## Colors
The color architecture relies on an authoritative light administrative palette engineered for maximum optical clarity and institutional seriousness.

> **v2 (2026-09-15) — 화이트 기반 재조정.** 프론트매터의 M3 토큰이 본문의 팔레트와 달리 파란 기운을 띠어(캔버스 `#F7F9FF`, 타일 `#ECF4FF`, 경계선 `#D9E4F1`) 흰 카드·캔버스·경계선의 명도 차가 사라졌다. 프론트매터를 본문 값에 맞춰 무채색으로 되돌리고, 12~13px 글자에서도 WCAG AA(4.5:1)를 넘기도록 보조 글자(`#4A5361`)와 흐린 글자(`#67717F`)를 한 단계 진하게, 경계선(`#DFE3E8`)은 캔버스보다 확실히 진하게 잡았다. 사이드바는 흰 바탕으로 바꾸고 남색은 브랜드 마크·활성 항목 막대·주요 버튼에만 남긴다. 유형 팔레트는 흰 표면에서 3:1 을 넘기도록 유지형 `#8A96A3`, 기능 결손형 `#C47D0C` 로 마크 색만 조정했다(뱃지 글자색은 유지). 라틴·숫자 글꼴은 Public Sans → IBM Plex Sans(tabular 숫자).

### Core Interface Tokens
- **Primary Navy (`#1F3A5F`):** Anchors top-level global navigation headers, high-priority CTAs, primary active states, and structural data emphasis.
- **Secondary Blue (`#2D6CB5`):** Reserved for interactive linkages, inline navigational cues, secondary filters, and standard focus outlines.
- **Background (`#F7F8FA`):** Low-strain, cool tinted off-white canvas providing clear contrast against white surfaces without harsh monitor glare.
- **Surface / Card Background (`#FFFFFF`):** Base layer for analytical tiles, data grids, inspection panels, and modals.
- **Structural Border (`#E3E7EC`):** Uniform hairline boundary (`1px solid`) separating all interactive modules, table cells, and headers.
- **Text Primary (`#1A1D21`):** Near-black neutral ensuring WCAG AAA legibility for critical figures, metrics, and primary labels.
- **Text Secondary (`#5B6572`):** Medium cool-slate grey for column titles, metadata, administrative timestamps, and secondary captions.

### Regional Diagnostic Risk State Palette
The core domain logic categorizes local depopulation risk into four strictly managed, non-negotiable diagnostic classifications:
- **유지형 (Maintenance Type) — `#9AA5B1`:** Stable regional cash flow and balanced inter-generational retention. Displayed in neutral cool slate grey.
- **이탈 선행형 (Leading Outflow Type) — `#C0392B`:** Rapid youth and productive population outflow with early consumption drain. Signaled via alert crimson red.
- **기능 결손형 (Functional Deficit Type) — `#D68910`:** Essential infrastructure and retail service collapse across basic living zones. Highlighted with cautionary amber orange.
- **복합 소멸형 (Compound Extinction Type) — `#1F3A5F`:** Extreme terminal contraction combining total demographic and transaction collapse. Rendered in deep institutional navy for maximal gravity.

## Typography
Typography enforces strict administrative order, legibility, and high density. In production codebases, use Pretendard, Apple SD Gothic Neo, or systematically fall back to standard system sans-serif font stacks.

### Rules of Usage
- **Tabular Figures (`tabular-nums`):** All financial metrics, population census tallies, transaction velocity indices, and percentages must strictly enable `font-variant-numeric: tabular-nums` (or CSS `tnum`) to ensure perfect vertical column alignment in analytical tables and summary cards.
- **Headline Rigor:** Page headers are anchored at 24px Bold (`#1A1D21`), accompanied by breadcrumb navigations in 12px Medium (`#5B6572`). Section titles inside cards stay locked at 18px SemiBold.
- **Korean Typographic Polish:** Keep line-breaks clean by setting `word-break: keep-all` globally across all text blocks, guaranteeing consistent institutional readability without awkward mid-syllable hyphenations.

## Layout & Spacing
The layout follows a disciplined workstation framework built for standard desktop analytical displays (1440px baseline).

### Layout Geometry
- **Fixed Administrative Sidebar:** 240px static width anchored to the left. Houses administrative hierarchy, ministry department indicators, and primary service navigation.
- **Top Utility Bar:** 56px fixed height containing national security clearance indicators, regional boundary selectors (시·도 / 시·군·구), dataset refresh timestamps, and user profile metadata.
- **Main Canvas:** Fluid workspace remaining to the right of the sidebar, utilizing an 8px modular baseline grid. Standard horizontal margins are set to 24px (`space-lg`), with 16px (`gutter`) inter-card gutters.

### Responsive Behavior
- **Desktop Primary (≥ 1440px):** Full 12-column grid layout with persistent sidebar, multi-panel diagnostic heatmaps, and side-by-side time-series tabular matrices.
- **Condensed Desktop / Landscape Tablet (1024px – 1439px):** Sidebar remains fixed at 240px; KPI summary cards collapse from 4 columns to 2x2 grid format; data tables enforce horizontal scrolling with frozen header and region-name columns.
- **Reflow Constraint:** Administrative density takes precedence over touch-friendly enlargement. Compact cell height and rigorous data containment are preferred over spacious stacking.

## Elevation & Depth
This design system rejects drop shadows, blurred ambient lighting, and floating elevations in favor of a **Zero-Shadow Architectural Model**.

- **Structural Borders as Surface Delimiters:** Every panel, card, table container, and contextual inspector is bounded by a crisp `1px solid #E3E7EC` border against the `#F7F8FA` background.
- **Tonal Layering:** Visual stratification is achieved through background tinting rather than Z-axis elevation. Active selections use `#F0F4F8`, table headers use `#F7F8FA`, and hovered table rows transition subtly to `#F8FAFC`.
- **Modals & Flyouts:** System-critical confirmation dialogs and administrative export overlays utilize a flat white background (`#FFFFFF`), a hairline border (`1px solid #1F3A5F`), and an opaque `#00000033` backdrop overlay without blur filters.

## Shapes
Geometry is disciplined, precise, and utilitarian.
- **Standard Radius (8px / `0.5rem`):** Applied uniformly to analytics cards, main dashboard panels, modal containers, and action buttons.
- **Micro Radius (4px / `0.25rem`):** Applied to data input fields, table filter dropdowns, segmented controls, and inline diagnostic badges.
- **Pill Shapes Prohibited:** Circular pill chips and rounded floating buttons are excluded to preserve the official governmental aesthetic.

## Components

### Buttons & Action Triggers
- **Primary Button:** Deep Navy background (`#1F3A5F`), white text (`#FFFFFF`), 8px radius, 36px height (14px SemiBold text, 16px horizontal padding). Hover state: `#162A45`. Active state: `#101F33`. Focus ring: 2px offset in `#2D6CB5`.
- **Secondary Button:** Surface white (`#FFFFFF`) with 1px border (`#E3E7EC`), `#1A1D21` text. Hover: `#F0F4F8` with `#CBD2D9` border.
- **Report Export Button:** Subtle Navy tint (`#F0F4F8`), `#1F3A5F` text, 1px border (`#D0D9E3`). Optimized for downloading HWP, XLSX, and ministerial PDF dossiers.

### Diagnostic Badges & Status Chips
- **Container Structure:** 24px fixed height, 4px corner radius, 8px horizontal padding, 12px SemiBold text.
- **유지형 (Maintenance Type):** Background `#F1F3F5`, border `#9AA5B1`, text `#4E5762`.
- **이탈 선행형 (Leading Outflow Type):** Background `#FDF2F2`, border `#E6B0AA`, text `#C0392B`.
- **기능 결손형 (Functional Deficit Type):** Background `#FEF9E7`, border `#FAD7A0`, text `#B7770D`.
- **복합 소멸형 (Compound Extinction Type):** Background `#EAEFF5`, border `#8CA3BF`, text `#1F3A5F`.

### Analytical Tables & Data Grids
- **Header Row:** 40px height, background `#F7F8FA`, 13px SemiBold text (`#5B6572`), bottom border `1px solid #E3E7EC`.
- **Data Rows:** 44px height, background `#FFFFFF`, alternating hover state `#F8FAFC`. Bottom cell divider `1px solid #E3E7EC`.
- **Numeric Alignment:** Regional administrative codes and names are left-aligned; diagnostic status chips are centered; all transaction volumes, population ratios, and trend deltas are right-aligned using tabular figures.

### Form Inputs & Selectors
- **Input Fields & Dropdowns:** 36px height, background `#FFFFFF`, border `1px solid #E3E7EC`, 4px radius, 14px Regular text (`#1A1D21`). Placeholder text in `#9AA5B1`. Active focus state triggers `1px solid #2D6CB5` with no outer glow.
- **Administrative Filters:** Compact segmented selectors featuring horizontal division with `#E3E7EC` separators and `#1F3A5F` active indicators.

### Metric KPI Tiles & Cards
- **Card Framing:** Background `#FFFFFF`, 1px border (`#E3E7EC`), 8px radius, 20px internal padding.
- **KPI Layout:** 12px Medium category label (`#5B6572`) at top, followed by 32px Bold value (`#1A1D21`, tabular figures), flanked by a comparison delta (+/- % versus previous quarter) and the diagnostic risk badge pinned to the upper right corner.