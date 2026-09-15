/**
 * 2×2 유형 사분면 산점도.
 *
 * 가로축(사다리 점수)은 0~3의 정수라 그대로 찍으면 네 줄로 뭉친다.
 * 지역명 해시로 결정적 지터를 주어 분포가 보이게 하되, 축 눈금은 정수
 * 위치에만 두고 캡션에 그 사실을 밝힌다. 같은 지역은 언제 그려도 같은
 * 자리에 온다.
 */
import { useMemo, useState } from 'react'
import { TYPE_STYLE, shortRegion, signed } from '../lib/format'
import { useMeasure } from '../lib/useMeasure'

const MIN_WIDTH = 560

const PAD = { top: 24, right: 28, bottom: 44, left: 56 }
const JITTER = 0.34

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** 한글은 반각의 두 배 가까이 넓다. 라벨 상자 크기를 눈대중으로 맞춘다. */
function textWidth(text) {
  let w = 0
  for (const ch of text) w += /[ㄱ-힝]/.test(ch) ? 11.5 : ch === ' ' ? 3.5 : 6.4
  return w
}

const LABEL_H = 18

/**
 * 라벨이 서로 겹치지 않게 자리를 잡는다. 점의 오른쪽을 먼저 시도하고,
 * 막히면 왼쪽 → 위 → 아래 순으로 옮긴다. 끝내 자리가 없으면 그 라벨은
 * 버린다. 겹쳐 찍어 둘 다 못 읽게 되는 쪽이 더 나쁘다.
 */
function placeLabels(candidates, bounds, reserved = []) {
  const placed = [...reserved]
  const out = []
  const hit = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

  for (const c of candidates) {
    const w = textWidth(c.text) + 12
    const offsets = [
      [9, -LABEL_H / 2], [-w - 9, -LABEL_H / 2],
      [9, -LABEL_H - 6], [-w - 9, -LABEL_H - 6],
      [-w / 2, -LABEL_H - 9], [-w / 2, 9],
    ]
    let spot = null
    for (const [dx, dy] of offsets) {
      const box = { x: c.cx + dx, y: c.cy + dy, w, h: LABEL_H }
      if (box.x < bounds.left || box.x + box.w > bounds.right) continue
      if (box.y < bounds.top || box.y + box.h > bounds.bottom) continue
      if (placed.some((p) => hit(box, p))) continue
      spot = box
      break
    }
    if (spot) {
      const label = { ...spot, text: c.text, color: c.color, region: c.region }
      placed.push(spot)
      out.push(label)
    }
  }
  return out
}

export default function QuadrantMatrix({ data, selected, onSelect, height = 340 }) {
  const [hover, setHover] = useState(null)
  const [boxRef, measured] = useMeasure(720)
  const width = Math.max(MIN_WIDTH, measured)

  const { points, x, y, yTicks } = useMemo(() => {
    if (!data) return { points: [], x: () => 0, y: () => 0, yTicks: [] }
    const ys = data.points.map((p) => p.y)
    const lo = Math.floor(Math.min(...ys, -10) / 10) * 10
    const hi = Math.ceil(Math.max(...ys, 10) / 10) * 10
    const plotW = width - PAD.left - PAD.right
    const plotH = height - PAD.top - PAD.bottom

    const x = (v) => PAD.left + ((v + 0.5) / 4) * plotW
    const y = (v) => PAD.top + ((hi - v) / (hi - lo)) * plotH

    const ticks = []
    for (let v = lo; v <= hi; v += 10) ticks.push(v)

    return {
      points: data.points.map((p) => ({
        ...p,
        cx: x(p.x + (hash(p.region) - 0.5) * 2 * JITTER),
        cy: y(p.y),
      })),
      x,
      y,
      yTicks: ticks,
    }
  }, [data, height, width])

  if (!data) return null

  const { ladder: ladderT, drain: drainT } = data.thresholds
  const plotRight = width - PAD.right
  const plotBottom = height - PAD.bottom
  const vx = x(ladderT)
  const hy = y(drainT)

  const quadFill = {
    'top-left': 'rgba(31,58,95,0.07)',
    'top-right': 'rgba(192,57,43,0.07)',
    'bottom-left': 'rgba(214,137,16,0.07)',
    'bottom-right': 'rgba(138,150,163,0.08)',
  }
  const quadBox = {
    'top-left': [PAD.left, PAD.top, vx - PAD.left, hy - PAD.top],
    'top-right': [vx, PAD.top, plotRight - vx, hy - PAD.top],
    'bottom-left': [PAD.left, hy, vx - PAD.left, plotBottom - hy],
    'bottom-right': [vx, hy, plotRight - vx, plotBottom - hy],
  }

  const active = hover ?? selected

  // 사분면 설명문과 임계선 설명문이 차지한 자리를 먼저 막아 두고, 남은
  // 공간에만 지역 라벨을 놓는다.
  const reserved = [
    { x: vx - 52, y: PAD.top - 22, w: 104, h: 20 },
    { x: plotRight - 154, y: hy - 21, w: 152, h: 20 },
    ...data.quadrants.map((q) => {
      const [bx, by, bw, bh] = quadBox[q.corner]
      const isTop = q.corner.startsWith('top')
      const isLeft = q.corner.endsWith('left')
      const w = 150
      return {
        x: isLeft ? bx + 8 : bx + bw - w - 8,
        y: isTop ? by + 4 : by + bh - 22,
        w,
        h: 20,
      }
    }),
  ]
  const labels = placeLabels(
    points
      .filter((p) => p.labelled || p.region === active)
      .map((p) => ({
        cx: p.cx, cy: p.cy, region: p.region,
        text: shortRegion(p.region), color: TYPE_STYLE[p.type].dot,
      })),
    { left: PAD.left + 2, right: plotRight - 2, top: PAD.top + 2, bottom: plotBottom - 2 },
    reserved,
  )

  return (
    <figure className="m-0">
      <div ref={boxRef} className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block max-w-none"
          role="img"
          aria-label="상권기능 사다리와 세대이탈지수의 2×2 유형 분포"
        >
          {Object.entries(quadBox).map(([corner, [bx, by, bw, bh]]) => (
            <rect key={corner} x={bx} y={by} width={bw} height={bh} fill={quadFill[corner]} />
          ))}

          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={plotRight} y1={y(t)} y2={y(t)}
                stroke="#dfe3e8" strokeWidth="1" strokeDasharray={t === 0 ? '0' : '2 4'}
                opacity={t === 0 ? 0.8 : 0.45}
              />
              <text
                x={PAD.left - 8} y={y(t) + 4} textAnchor="end"
                className="fill-outline" style={{ fontSize: 11 }}
              >
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}

          {[0, 1, 2, 3].map((t) => (
            <text
              key={t} x={x(t)} y={plotBottom + 18} textAnchor="middle"
              className="fill-on-surface-variant" style={{ fontSize: 11 }}
            >
              {t.toFixed(1)}
            </text>
          ))}

          {/* 임계선 */}
          <line x1={vx} x2={vx} y1={PAD.top} y2={plotBottom} stroke="#1f3a5f" strokeWidth="1.5" />
          <line x1={PAD.left} x2={plotRight} y1={hy} y2={hy} stroke="#c0392b" strokeWidth="1.5" />

          {data.quadrants.map((q) => {
            const [bx, by, bw, bh] = quadBox[q.corner]
            const isTop = q.corner.startsWith('top')
            const isLeft = q.corner.endsWith('left')
            return (
              <text
                key={q.corner}
                x={isLeft ? bx + 10 : bx + bw - 10}
                y={isTop ? by + 18 : by + bh - 10}
                textAnchor={isLeft ? 'start' : 'end'}
                style={{ fontSize: 11, fontWeight: 600, fill: TYPE_STYLE[q.type].dot }}
              >
                {q.type} ({q.caption})
              </text>
            )
          })}

          {points.map((p) => {
            const isActive = active === p.region
            return (
              <circle
                key={p.region}
                cx={p.cx} cy={p.cy}
                r={isActive ? 6 : 3.5}
                fill={TYPE_STYLE[p.type].dot}
                stroke={isActive ? '#161b22' : 'white'}
                strokeWidth={isActive ? 1.5 : 0.6}
                opacity={active && !isActive ? 0.35 : 0.9}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(p.region)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(p.region)}
              >
                <title>{`${p.region} · ${p.type} · 사다리 ${p.x} · 세대이탈 ${signed(p.y)}`}</title>
              </circle>
            )
          })}

          {labels.map((l) => (
            <g key={`label-${l.region}`} pointerEvents="none">
              <rect x={l.x} y={l.y} rx="3" width={l.w} height={l.h} fill={l.color} opacity="0.92" />
              <text x={l.x + 6} y={l.y + 13} fill="white" style={{ fontSize: 11, fontWeight: 600 }}>
                {l.text}
              </text>
            </g>
          ))}

          {/* 임계선 설명은 라벨 위에 얹어 항상 읽히게 한다 */}
          <g pointerEvents="none">
            <rect x={vx - 50} y={PAD.top - 20} rx="3" width="100" height="16" fill="#ffffff" opacity="0.96" />
            <text x={vx} y={PAD.top - 8} textAnchor="middle" className="fill-primary-container"
                  style={{ fontSize: 11, fontWeight: 600 }}>
              기능 임계선 ({ladderT})
            </text>
            <rect x={plotRight - 152} y={hy - 19} rx="3" width="150" height="16"
                  fill="#ffffff" opacity="0.96" />
            <text x={plotRight - 4} y={hy - 7} textAnchor="end" className="fill-type-drain"
                  style={{ fontSize: 11, fontWeight: 600 }}>
              경보 임계선 (세대이탈 {drainT}%p)
            </text>
          </g>

          <text
            x={(PAD.left + plotRight) / 2} y={height - 8} textAnchor="middle"
            className="fill-on-surface-variant" style={{ fontSize: 11, fontWeight: 600 }}
          >
            {data.axes.x.label} (0 ~ 3)
          </text>
          <text
            transform={`translate(14, ${(PAD.top + plotBottom) / 2}) rotate(-90)`}
            textAnchor="middle" className="fill-on-surface-variant"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {data.axes.y.label}
          </text>
        </svg>
      </div>
      <figcaption className="mt-1 text-caption-regular text-outline">
        사다리 점수는 0~3의 정수이며, 같은 점수의 지역이 겹치지 않도록 가로로만 분산해 표시했습니다.
      </figcaption>
    </figure>
  )
}
