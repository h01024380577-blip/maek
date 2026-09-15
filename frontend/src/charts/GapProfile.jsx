/**
 * 세대 이탈 프로파일.
 *
 * 연령대별 갭(외식 비중 − 근린소매 비중)을 꺾은선으로 그린다. 0선을
 * 기준으로 위는 그 세대가 외식에 과대표집(잔존), 아래는 과소표집(이탈)을
 * 뜻한다. 전국 평균선을 점선으로 깔아 비교 기준을 준다.
 */
import { useMemo } from 'react'
import { signed } from '../lib/format'
import { useMeasure } from '../lib/useMeasure'

// 오른쪽 여백은 마지막 축 라벨('60대 이상')의 절반보다 넓어야 잘리지 않는다
const PAD = { top: 22, right: 36, bottom: 30, left: 46 }
const MIN_WIDTH = 480

export default function GapProfile({ series, national, height = 210, showValues = true }) {
  const [boxRef, measured] = useMeasure(660)
  const width = Math.max(MIN_WIDTH, measured)

  const { scaleX, scaleY, ticks, labels } = useMemo(() => {
    const all = [
      ...series.flatMap((s) => s.points.map((p) => p.gap)),
      ...(national ?? []).map((p) => p.gap),
    ].filter((v) => typeof v === 'number')

    // 0선을 유지하되 범위는 실제 데이터에 맞춘다. 대칭으로 잡으면 값이 한쪽에
    // 몰린 지역에서 절반이 빈 칸으로 남아 꺾은선이 납작해 보인다.
    const step = 5
    const lo = Math.min(0, Math.floor(Math.min(...all, 0) / step) * step) - step
    const hi = Math.max(0, Math.ceil(Math.max(...all, 0) / step) * step) + step
    const n = series[0]?.points.length ?? 6
    const plotW = width - PAD.left - PAD.right
    const plotH = height - PAD.top - PAD.bottom

    const gapX = plotW / Math.max(1, n - 1)
    const span = hi - lo
    // 눈금 간격은 40px 에 하나꼴이 되게 고른다. 차트가 높아지면 자연히 촘촘해진다.
    const stepY = [5, 10, 20, 25, 50].find((s) => span / s <= plotH / 40) ?? 50
    const tickValues = []
    for (let v = Math.ceil(lo / stepY) * stepY; v <= hi; v += stepY) tickValues.push(v)
    if (!tickValues.includes(0)) tickValues.push(0)

    return {
      scaleX: (i) => PAD.left + i * gapX,
      scaleY: (v) => PAD.top + ((hi - v) / span) * plotH,
      ticks: tickValues.sort((a, b) => a - b),
      labels: series[0]?.points.map((p) => p.label) ?? [],
    }
  }, [series, national, height, width])

  // 값 라벨 자리. 계열이 하나면 0선 위는 위쪽, 아래는 아래쪽에 둔다. 여럿이면
  // 같은 연령대에서 값이 가장 큰 계열은 위, 가장 작은 계열은 아래, 그 사이는
  // 오른쪽에 두어 서로 겹치지 않게 한다(Stitch 원안의 다중 비교 표기).
  const labelPos = useMemo(() => {
    const n = labels.length
    return series.map((s, si) =>
      Array.from({ length: n }, (_, i) => {
        if (series.length === 1) return (s.points[i]?.gap ?? 0) >= 0 ? 'above' : 'below'
        const order = series
          .map((t, ti) => ({ ti, v: t.points[i]?.gap ?? 0 }))
          .sort((a, b) => b.v - a.v)
        const rank = order.findIndex((o) => o.ti === si)
        return rank === 0 ? 'above' : rank === order.length - 1 ? 'below' : 'right'
      }))
  }, [series, labels])

  // 계열이 하나일 때 가장 크게 이탈한 연령대와 가장 잔존한 연령대를 축에서 강조한다
  const extremes = useMemo(() => {
    if (series.length !== 1) return {}
    const pts = series[0].points.map((p, i) => ({ i, v: p.gap })).filter((p) => typeof p.v === 'number')
    if (!pts.length) return {}
    const lo = pts.reduce((a, b) => (b.v < a.v ? b : a)).i
    const hi = pts.reduce((a, b) => (b.v > a.v ? b : a)).i
    return { [lo]: '#c0392b', [hi]: '#161b22' }
  }, [series])

  if (!series?.length) return null

  const path = (points, key = 'gap') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p[key] ?? 0)}`)
      .join(' ')

  const plotBottom = height - PAD.bottom
  const single = series.length === 1

  return (
    <figure className="m-0">
      <div ref={boxRef} className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}
             className="block max-w-none" role="img"
             aria-label="연령대별 세대 이탈 프로파일">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={width - PAD.right} y1={scaleY(t)} y2={scaleY(t)}
                stroke={t === 0 ? '#8a94a3' : '#dfe3e8'}
                strokeWidth={t === 0 ? 1.2 : 1}
                strokeDasharray={t === 0 ? '0' : '2 4'}
                opacity={t === 0 ? 0.9 : 0.5}
              />
              <text x={PAD.left - 8} y={scaleY(t) + 4} textAnchor="end" className="fill-outline"
                    style={{ fontSize: 11 }}>
                {t > 0 ? `+${t}` : t}%p
              </text>
            </g>
          ))}

          {national?.length > 0 && (
            <path
              d={path(national)} fill="none" stroke="#67717f" strokeWidth="1.5"
              strokeDasharray="5 4" opacity="0.75"
            />
          )}

          {series.map((s, si) => (
            <g key={s.region}>
              <path d={path(s.points)} fill="none" stroke={s.color} strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round" />
              {s.points.map((p, i) => (
                <circle
                  key={p.code} cx={scaleX(i)} cy={scaleY(p.gap ?? 0)} r="4"
                  fill={single ? s.color : 'white'} stroke={s.color} strokeWidth="2"
                >
                  <title>{`${s.region} · ${p.label} · ${signed(p.gap)}`}</title>
                </circle>
              ))}
              {showValues && s.points.map((p, i) => {
                const pos = labelPos[si][i]
                const dx = pos === 'right' ? 8 : 0
                const dy = pos === 'above' ? -10 : pos === 'below' ? 17 : 4
                return (
                  <text
                    key={`v-${p.code}`} x={scaleX(i) + dx} y={scaleY(p.gap ?? 0) + dy}
                    textAnchor={pos === 'right' ? 'start' : 'middle'}
                    style={{ fontSize: 11, fontWeight: 700, fill: s.color }}
                  >
                    {signed(p.gap, 1, '')}
                  </text>
                )
              })}
            </g>
          ))}

          {labels.map((label, i) => (
            <text
              key={label} x={scaleX(i)} y={plotBottom + 20} textAnchor="middle"
              className={extremes[i] ? '' : 'fill-on-surface-variant'}
              style={{ fontSize: 11, fontWeight: extremes[i] ? 700 : 400, fill: extremes[i] }}
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        {series.map((s) => (
          <span key={s.region} className="inline-flex items-center gap-1.5 text-caption-medium text-on-surface-variant">
            <span className="w-4 h-0.5 rounded" style={{ background: s.color }} />
            {s.region}
          </span>
        ))}
        {national?.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-caption-medium text-on-surface-variant">
            <span className="w-4 border-t-2 border-dashed border-outline" />
            전국 평균선
          </span>
        )}
      </div>
    </figure>
  )
}
