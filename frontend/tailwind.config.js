/**
 * 색 토큰은 design_ref/stitch_/DESIGN.md 를 그대로 옮긴 것이다.
 * 값을 바꿔야 하면 그쪽을 먼저 고치고 여기에 반영한다.
 *
 * v2 (2026-09-15) 화이트 기반 재조정.
 * 원안의 M3 토큰은 표면 전부가 파란 기운(#f7f9ff·#ecf4ff·#e4effc)을 띠어 흰 카드와
 * 캔버스, 경계선의 명도 차가 거의 없었다. DESIGN.md 본문이 요구하는 중성 회색
 * 팔레트(#FFFFFF 표면 · #F7F8FA 캔버스 · #E3E7EC 경계선 · #1A1D21 글자)로 되돌리고,
 * 경계선과 보조 글자는 한 단계 진하게 잡아 12~13px 에서도 4.5:1 이상을 지킨다.
 * 토큰 이름은 그대로 두어 화면 코드를 건드리지 않고 값만 바뀌게 했다.
 *
 * 글자 크기와 간격은 DESIGN.md 원안보다 한 단계씩 조인 값이다. 원안(32/24/18/14)
 * 으로 두면 1440×900 화면에서 한 페이지가 두 화면 반을 넘어가 한눈에 읽히지
 * 않았다. DESIGN.md 의 "Reflow Constraint" 항목이 밀도를 우선하라고 한 대로
 * 좁혔다. 원안 값: display-kpi 32/40 · headline-page 24/32 · headline-section
 * 18/26 · body 14/20 · gutter 16px.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── 표면(무채색 계열). 캔버스 < 타일 < 카드 순으로 밝아진다 ──
        surface: '#f5f6f8',                    // 페이지 캔버스
        'surface-dim': '#c9d3df',
        'surface-bright': '#ffffff',
        'surface-container-lowest': '#ffffff', // 카드·패널
        'surface-container-low': '#f7f8fa',    // 타일·표 머리·행 호버
        'surface-container': '#eef0f3',        // 중립 칩·세그먼트 트랙
        'surface-container-high': '#e3e6eb',   // 막대 트랙·비활성 원
        'surface-container-highest': '#dfe3e8',// 1px 경계선
        'on-surface': '#161b22',               // 본문 글자 (≈15:1)
        'on-surface-variant': '#4a5361',       // 보조 글자 (≈7.6:1)
        'inverse-surface': '#1f2937',
        'inverse-on-surface': '#f3f4f6',
        outline: '#67717f',                    // 흐린 글자 (≈5.0:1)
        'outline-variant': '#cdd3da',          // 입력창 경계선·점선
        'surface-tint': '#1f3a5f',

        // ── 남색: 브랜드 · 주요 동작 · 활성 내비게이션 ──
        primary: '#142b4a',
        'on-primary': '#ffffff',
        'primary-container': '#1f3a5f',
        'on-primary-container': '#b9c8dd',
        'inverse-primary': '#9fbde6',
        'primary-fixed': '#e2e9f3',
        'primary-fixed-dim': '#b9c8dd',
        'on-primary-fixed': '#0f2340',
        'on-primary-fixed-variant': '#2d476d',

        // ── 파랑: 링크 · 초점 · 정보 칩 ──
        secondary: '#1a5fa7',
        'on-secondary': '#ffffff',
        'secondary-container': '#dbe8fa',
        'on-secondary-container': '#0f3f78',
        'secondary-fixed': '#e3edfb',
        'secondary-fixed-dim': '#b7d0f2',
        'on-secondary-fixed': '#0b2f5c',
        'on-secondary-fixed-variant': '#0f4d8f',

        // ── 황갈색: 조건부 판정 ──
        tertiary: '#5a3a00',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#7a5200',
        'on-tertiary-container': '#f2c46a',
        'tertiary-fixed': '#fbe8c8',
        'tertiary-fixed-dim': '#f2c46a',
        'on-tertiary-fixed': '#3a2400',
        'on-tertiary-fixed-variant': '#6b4300',

        // ── 오류·경보 ──
        error: '#b42318',
        'on-error': '#ffffff',
        'error-container': '#fdebe9',
        'on-error-container': '#8a1c14',

        background: '#f5f6f8',
        'on-background': '#161b22',
        'surface-variant': '#e3e6eb',

        // ── 2×2 유형 전용 팔레트 (DESIGN.md — Regional Diagnostic Risk State) ──
        // 흰 표면에서 3:1 을 넘기도록 유지형 회색과 기능 결손형 주황만 한 단계 진하게.
        'type-maintain': '#8a96a3',
        'type-maintain-bg': '#f2f4f6',
        'type-maintain-text': '#4e5762',
        'type-drain': '#c0392b',
        'type-drain-bg': '#fdf1f0',
        'type-drain-border': '#eab7b1',
        'type-deficit': '#c47d0c',
        'type-deficit-bg': '#fdf6e6',
        'type-deficit-border': '#f1d59b',
        'type-deficit-text': '#9a6108',
        'type-compound': '#1f3a5f',
        'type-compound-bg': '#eaeff5',
        'type-compound-border': '#9db0c8',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      spacing: {
        // 세로 리듬은 화면 높이를 따라간다 (index.css :root 참고)
        gutter: 'var(--gutter)',
        pad: 'var(--pad)',
        'pad-sm': 'var(--pad-sm)',
        row: 'var(--row)',
        margin: '1.5rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2rem',
      },
      fontFamily: {
        // 라틴·숫자는 IBM Plex Sans(표 정렬용 tabular 숫자), 한글은 Pretendard 로 떨어진다
        sans: ['IBM Plex Sans', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-kpi': ['28px', { lineHeight: '32px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-page': ['20px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '700' }],
        'headline-section': ['15px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-regular': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'body-medium': ['13px', { lineHeight: '18px', fontWeight: '500' }],
        'body-semibold': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'caption-regular': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'caption-medium': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'table-header': ['12px', { lineHeight: '16px', fontWeight: '600' }],
        'table-cell': ['13px', { lineHeight: '18px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
}
