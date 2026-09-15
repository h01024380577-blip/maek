/** 표시 규칙 한곳 모음. 화면마다 반올림이 달라지는 것을 막는다. */

export const TYPE_STYLE = {
  '유지형': {
    chip: 'bg-type-maintain-bg border-type-maintain text-type-maintain-text',
    dot: '#8a96a3',
    short: '유지',
  },
  '이탈 선행형': {
    chip: 'bg-type-drain-bg border-type-drain-border text-type-drain',
    dot: '#c0392b',
    short: '이탈 선행',
  },
  '기능 결손형': {
    chip: 'bg-type-deficit-bg border-type-deficit-border text-type-deficit-text',
    dot: '#c47d0c',
    short: '기능 결손',
  },
  '복합 소멸형': {
    chip: 'bg-type-compound-bg border-type-compound-border text-type-compound',
    dot: '#1f3a5f',
    short: '복합 소멸',
  },
}

export const TYPE_ORDER = ['유지형', '이탈 선행형', '기능 결손형', '복합 소멸형']

export const VERDICT_STYLE = {
  '권장': { chip: 'bg-secondary text-on-secondary', icon: 'verified' },
  '조건부 권장': { chip: 'bg-tertiary-fixed-dim text-on-tertiary-fixed', icon: 'gpp_maybe' },
  '비권장': { chip: 'bg-error-container text-on-error-container', icon: 'gpp_bad' },
}

const NBSP = '–' // 값이 없을 때의 자리표시

export function num(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return NBSP
  return Number(value).toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function int(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return NBSP
  return Number(value).toLocaleString('ko-KR')
}

export function pct(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return NBSP
  return `${num(value, digits)}%`
}

/** 세대이탈지수처럼 부호가 의미를 갖는 값 */
export function signed(value, digits = 1, unit = '%p') {
  if (value === null || value === undefined || Number.isNaN(value)) return NBSP
  const sign = value > 0 ? '+' : ''
  return `${sign}${num(value, digits)}${unit}`
}

/** 결제 금액은 억/조 단위로 접는다. 원 단위는 표에서 읽히지 않는다. */
export function won(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return NBSP
  const v = Number(value)
  if (Math.abs(v) >= 1e12) return `${num(v / 1e12, 2)}조원`
  if (Math.abs(v) >= 1e8) return `${num(v / 1e8, 1)}억원`
  if (Math.abs(v) >= 1e4) return `${num(v / 1e4, 0)}만원`
  return `${int(v)}원`
}

export function month(value) {
  if (!value) return NBSP
  const s = String(value)
  return `${s.slice(0, 4)}.${s.slice(4, 6)}`
}

export function shortRegion(region) {
  if (!region) return NBSP
  const [sido, ...rest] = region.split(' ')
  const abbr = {
    서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
    광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
    경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
    전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남',
    제주특별자치도: '제주',
  }
  return `${abbr[sido] ?? sido} ${rest.join(' ')}`.trim()
}

export const PLACEHOLDER = NBSP
