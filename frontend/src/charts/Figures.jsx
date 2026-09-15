/** 화면 곳곳에 쓰는 작은 도형들. 전부 SVG·CSS만 쓴다. */
import { pct, num, signed, PLACEHOLDER } from '../lib/format'

const SERIES = ['#1f3a5f', '#1c5cab', '#2a78d6', '#86b6ef']

/** 칠한 막대 위 글자색. 밝은 칠에는 검정, 어두운 칠에는 흰색 — 인덱스가 아니라 실제 밝기로 정한다 */
function inkFor(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return lum > 0.3 ? '#161b22' : '#ffffff'
}

/** 잔존 소비 세대 도넛 */
export function Donut({ items, size = 136, thickness = 20, centerLabel, centerValue }) {
  const valid = items.filter((i) => typeof i.share === 'number' && i.share > 0)
  const total = valid.reduce((s, i) => s + i.share, 0)
  if (!total) return <p className="text-caption-regular text-outline">표시할 값이 없습니다</p>

  const r = (size - thickness) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex items-center gap-space-md flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
           aria-label="연령대별 소비 구성비">
        <g transform={`rotate(-90 ${c} ${c})`}>
          {valid.map((item, i) => {
            const frac = item.share / total
            const dash = `${frac * circumference} ${circumference}`
            const el = (
              <circle
                key={item.label} cx={c} cy={c} r={r} fill="none"
                stroke={item.color ?? SERIES[i % SERIES.length]}
                strokeWidth={thickness} strokeDasharray={dash}
                strokeDashoffset={-offset * circumference}
              >
                <title>{`${item.label} ${pct(item.share)}`}</title>
              </circle>
            )
            offset += frac
            return el
          })}
        </g>
        {centerValue && (
          <>
            <text x={c} y={c - 2} textAnchor="middle" className="fill-on-surface"
                  style={{ fontSize: 15, fontWeight: 700 }}>
              {centerValue}
            </text>
            <text x={c} y={c + 16} textAnchor="middle" className="fill-on-surface-variant"
                  style={{ fontSize: 11 }}>
              {centerLabel}
            </text>
          </>
        )}
      </svg>

      <ul className="w-full max-w-[220px] flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-body-regular text-on-surface">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: item.color ?? SERIES[i % SERIES.length] }} />
              {item.label}
            </span>
            <span className="text-body-semibold text-on-surface tabular">{pct(item.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 소비 구조 4분류 가로 스택바 */
export function StackedBar({ groups, valueKey = 'share', height = 28, showLabels = true }) {
  const total = groups.reduce((s, g) => s + (g[valueKey] ?? 0), 0) || 1
  return (
    <div className="flex rounded overflow-hidden border border-surface-container-highest"
         style={{ height }}>
      {groups.map((g, i) => {
        const value = g[valueKey] ?? 0
        const width = (value / total) * 100
        if (width <= 0) return null
        return (
          <div
            key={g.key ?? g.label}
            className="flex items-center justify-center text-caption-medium font-semibold"
            style={{
              width: `${width}%`,
              background: g.color ?? SERIES[i % SERIES.length],
              color: inkFor(g.color ?? SERIES[i % SERIES.length]),
            }}
            title={`${g.label} ${pct(value)}`}
          >
            {showLabels && width > 8 ? pct(value, 1) : ''}
          </div>
        )
      })}
    </div>
  )
}

/** 임계선이 있는 눈금 막대 — 세대이탈지수처럼 '선을 넘었는가'가 핵심인 값 */
export function ThresholdGauge({ value, threshold, min = -30, max = 40, unit = '%p' }) {
  if (typeof value !== 'number') return <p className="text-caption-regular text-outline">{PLACEHOLDER}</p>
  const clamp = (v) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))
  const pos = clamp(value)
  const thr = clamp(threshold)
  const exceeded = value > threshold

  return (
    <div className="pt-5 pb-0.5">
      <div className="relative h-2 rounded-full bg-surface-container-high">
        <div
          className="absolute inset-y-0 rounded-l-full"
          style={{
            left: 0, width: `${thr}%`,
            background: '#e3e6eb',
          }}
        />
        <div
          className="absolute inset-y-0 rounded-r-full"
          style={{ left: `${thr}%`, right: 0, background: 'rgba(192,57,43,0.16)' }}
        />
        <div className="absolute -top-1 bottom-[-4px] w-0.5 bg-type-drain" style={{ left: `${thr}%` }} />
        <span
          className="absolute -top-6 text-caption-medium font-semibold text-type-drain -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${thr}%` }}
        >
          경보 {num(threshold)}{unit}
        </span>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white"
          style={{ left: `${pos}%`, background: exceeded ? '#c0392b' : '#1a5fa7' }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-caption-regular text-outline tabular">
        <span>{signed(min, 0, unit)}</span>
        <span className={`font-semibold ${exceeded ? 'text-type-drain' : 'text-secondary'}`}>
          현재 {signed(value, 1, unit)}
        </span>
        <span>{signed(max, 0, unit)}</span>
      </div>
    </div>
  )
}

/** 전국 중앙값 기준선이 있는 비율 막대 — 외국인 의존도 등 */
export function MedianBar({ value, median, label = '전국 중앙값' }) {
  if (typeof value !== 'number') return <p className="text-caption-regular text-outline">{PLACEHOLDER}</p>
  const pos = Math.min(100, Math.max(0, value))
  const mid = Math.min(100, Math.max(0, median ?? 0))
  return (
    <div className="pt-4">
      <div className="relative h-2 rounded-full bg-surface-container-high overflow-visible">
        <div className="absolute inset-y-0 left-0 rounded-full bg-secondary" style={{ width: `${pos}%` }} />
        {typeof median === 'number' && (
          <>
            <div className="absolute -top-1.5 bottom-[-6px] w-0.5 bg-type-drain" style={{ left: `${mid}%` }} />
            <span
              className="absolute -top-5 text-caption-regular text-type-drain -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${mid}%` }}
            >
              {label} {pct(median)}
            </span>
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between text-caption-regular text-outline tabular">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  )
}

/** 점수 구성 막대 — 창업 적합도 항목별 기여 */
export function ScoreBreakdown({ breakdown, weights }) {
  const rows = Object.entries(weights).map(([key, meta]) => ({
    key,
    label: meta.label,
    max: meta.max,
    value: breakdown[key] ?? 0,
  }))
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const negative = r.max < 0
        const ratio = Math.min(100, Math.abs(r.value / r.max) * 100)
        return (
          <li key={r.key} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-caption-medium text-on-surface-variant">{r.label}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
              <div
                className={`h-full rounded-full ${negative ? 'bg-error' : 'bg-secondary'}`}
                style={{ width: `${ratio}%` }}
              />
            </div>
            <span className="w-20 text-right text-caption-medium tabular text-on-surface">
              {num(r.value, 1)} / {num(r.max, 0)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export { SERIES }
