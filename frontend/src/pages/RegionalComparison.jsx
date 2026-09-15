/**
 * 지역 비교 — 최대 3개 지자체 교차 진단 매트릭스.
 *
 * 위 한 줄에서 지역을 고르고, 표에서 항목별로 나란히 본다. 값만 늘어놓으면
 * 넓은 칸 왼쪽에 숫자가 따로 놀아 비교하는 느낌이 나지 않는다. 그래서
 * 수치 항목마다 같은 눈금의 막대를 칸 폭 가득 깔고, 대조 지역 칸에는
 * 기준 지역과의 격차를 칩으로 붙인다.
 */
import { useState } from 'react'
import GapProfile from '../charts/GapProfile'
import RegionPicker from '../components/RegionPicker'
import {
  Button, Chip, ErrorState, Icon, Loading, Panel, TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { num, pct, signed, won } from '../lib/format'
import { fitHeight, useViewportHeight } from '../lib/useViewport'

const LINE_COLOR = ['#c0392b', '#c47d0c', '#1f3a5f']
const MAX = 3

// 막대 눈금. 지역이 달라도 같은 눈금이어야 길이를 견줄 수 있다.
const DOMAIN = { drain: [-30, 40], percent: [0, 100], ladder: [0, 3] }

function Slot({ index, region, onChange, onRemove, removable }) {
  const [editing, setEditing] = useState(!region)
  const label = index === 0 ? '기준' : `대조 ${String.fromCharCode(64 + index)}`
  return (
    <div className="flex items-center gap-1">
      <span className="w-4 h-4 rounded-full text-[11px] font-semibold flex items-center justify-center
                       text-on-primary tabular shrink-0"
            style={{ background: LINE_COLOR[index] }}>
        {index + 1}
      </span>
      {editing || !region ? (
        <RegionPicker
          value={region}
          onChange={(r) => { onChange(r); setEditing(false) }}
          onClose={() => { if (region) setEditing(false) }}
          autoFocus
          className="w-56"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="지역 변경"
          className="h-8 pl-2 pr-1.5 rounded border border-surface-container-highest bg-surface-container-lowest
                     hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
        >
          <span className="text-caption-regular text-outline">{label}</span>
          <span className="text-body-semibold text-on-surface">{region}</span>
          <Icon name="expand_more" size={14} className="text-on-surface-variant" />
        </button>
      )}
      {removable && (
        <Button variant="ghost" size="sm" icon="close" onClick={onRemove}
                className="!h-7 !w-7 !px-0" aria-label="제거" />
      )}
    </div>
  )
}

/** 칸 폭 가득 까는 비교 막대. 눈금에 0이 들어 있으면 0에서 값 쪽으로 자란다. */
function Bar({ value, domain, color }) {
  if (typeof value !== 'number') return null
  const [lo, hi] = domain
  const at = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))
  const zero = lo < 0 ? at(0) : 0
  const pos = at(value)
  return (
    <div className="relative mt-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
      {lo < 0 && <div className="absolute inset-y-0 w-px bg-outline" style={{ left: `${zero}%` }} />}
      <div className="absolute inset-y-0 rounded-full"
           style={{ left: `${Math.min(zero, pos)}%`, width: `${Math.abs(pos - zero)}%`, background: color }} />
    </div>
  )
}

/** 대조 지역 칸에 붙는 격차 칩 */
function Delta({ children, same = false }) {
  return (
    <Chip tone={same ? 'neutral' : 'outline'} className="shrink-0">
      <Icon name={same ? 'drag_handle' : 'compare_arrows'} size={12} />
      {children}
    </Chip>
  )
}

function LadderCell({ value, base, index, color }) {
  const diff = value.score - base.score
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-headline-section tabular text-on-surface">
          {value.score}<span className="text-caption-regular text-on-surface-variant font-normal"> / {value.max}점</span>
        </span>
        {index > 0 && (
          <Delta same={diff === 0}>{diff === 0 ? '동일' : `기준 대비 ${signed(diff, 0, '')}단계`}</Delta>
        )}
      </div>
      <Bar value={value.score} domain={DOMAIN.ladder} color={color} />
      <span className="mt-1.5 flex items-center gap-0.5 flex-wrap">
        {value.steps.map((s, i) => (
          <span key={s.business} className="flex items-center gap-0.5">
            {i > 0 && <Icon name="chevron_right" size={12} className="text-outline-variant" />}
            <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-caption-medium ${
              s.present
                ? 'bg-surface-container-low border-surface-container-highest text-secondary'
                : 'bg-type-drain-bg border-type-drain-border text-type-drain'}`}>
              <Icon name={s.present ? 'check_circle' : 'cancel'} size={12} />
              {s.business}
            </span>
          </span>
        ))}
      </span>
    </>
  )
}

function DrainCell({ value, base, index, color }) {
  const diff = value.index - base.index
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-headline-section tabular ${
            value.exceeded ? 'text-type-drain' : 'text-on-surface'}`}>
            {signed(value.index)}
          </span>
          <Chip tone={value.exceeded ? 'alert' : 'neutral'}>전국 상위 {num(value.top_pct)}%</Chip>
          <span className="text-caption-regular text-outline tabular">
            {value.rank}위 / {value.total}
          </span>
        </span>
        {index > 0 && <Delta>기준 대비 {signed(diff, 1, '%p')}</Delta>}
      </div>
      <Bar value={value.index} domain={DOMAIN.drain} color={color} />
    </>
  )
}

function PercentCell({ value, base, index, color }) {
  const diff = value - base
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-headline-section tabular ${
          value >= 40 ? 'text-secondary' : 'text-on-surface'}`}>
          {pct(value)}
        </span>
        {index > 0 && <Delta>기준 대비 {signed(diff, 1, '%p')}</Delta>}
      </div>
      <Bar value={value} domain={DOMAIN.percent} color={color} />
    </>
  )
}

function TagsCell({ value, base, index }) {
  const tags = (v) => (v === '-' ? [] : v.split(',').map((t) => t.trim()))
  const mine = tags(value)
  const common = index > 0 ? mine.filter((t) => tags(base).includes(t)) : []
  return (
    <div className="flex items-start justify-between gap-2">
      {mine.length === 0 ? (
        <span className="text-body-regular text-secondary">결손 없음</span>
      ) : (
        <span className="flex flex-wrap gap-1">
          {mine.map((t) => <Chip key={t} tone="alert">{t}</Chip>)}
        </span>
      )}
      {index > 0 && (
        <Delta same={common.length > 0}>
          {common.length ? `공통 결손 ${common.join('·')}` : '기준과 다름'}
        </Delta>
      )}
    </div>
  )
}

function Cell({ row, value, index, color }) {
  const base = row.values[0]
  switch (row.kind) {
    case 'badge':
      return (
        <div className="flex items-start justify-between gap-2">
          <TypeBadge type={value} />
          {index > 0 && <Delta same={value === base}>{value === base ? '동일 유형' : '유형 다름'}</Delta>}
        </div>
      )
    case 'ladder':
      return <LadderCell value={value} base={base} index={index} color={color} />
    case 'drain':
      return <DrainCell value={value} base={base} index={index} color={color} />
    case 'tags':
      return <TagsCell value={value} base={base} index={index} />
    case 'percent':
      return <PercentCell value={value} base={base} index={index} color={color} />
    default:
      return <p className="text-body-regular text-on-surface-variant leading-relaxed">{value}</p>
  }
}

/** 꺾은선만으로는 두 지역의 값을 대조하기 어렵다. 연령대별 수치를 표로 같이 둔다. */
function GapTable({ rows, labels }) {
  const cell = 'px-1.5 py-1 text-right tabular whitespace-nowrap'
  return (
    <table className="w-full border-collapse text-caption-regular">
      <thead>
        <tr className="border-b border-surface-container-highest text-on-surface-variant">
          <th className="px-1.5 py-1 text-left font-medium">연령대</th>
          {labels.map((l) => <th key={l} className={`${cell} font-medium`}>{l}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-surface-container-highest last:border-0">
            <td className="px-1.5 py-1 whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 text-on-surface">
                {r.color
                  ? <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  : <span className="w-3 border-t-2 border-dashed border-outline" />}
                {r.label}
              </span>
            </td>
            {r.points.map((p) => (
              <td key={p.code ?? p.label}
                  className={`${cell} ${r.muted ? 'text-outline' : p.gap < 0 ? 'text-type-drain' : 'text-on-surface'} ${r.muted ? '' : 'font-semibold'}`}>
                {signed(p.gap, 1, '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function RegionalComparison() {
  const [slots, setSlots] = useState(['전라남도 영암군', '충청남도 서천군'])
  const vh = useViewportHeight()

  const ready = slots.filter(Boolean)
  const { data, error, loading, reload } = useApi(
    () => api.compare(ready), [ready.join('|')], { skip: ready.length < 2 },
  )

  const setSlot = (i, value) => setSlots((s) => s.map((v, idx) => (idx === i ? value : v)))
  const addSlot = () => setSlots((s) => [...s, ''])
  const removeSlot = (i) => setSlots((s) => s.filter((_, idx) => idx !== i))

  return (
    // 두세 지역을 나란히 놓는 표라 본문을 다 쓰면 칸이 비어 보인다. 한 단계 좁게 잡는다.
    <div className="mx-auto w-full max-w-[1080px] flex flex-col gap-gutter">
      {/* 지역 검색 드롭다운이 아래 표 위로 뜨도록 이 패널을 z-20 층에 올린다 */}
      <Panel dense className="relative z-20" bodyClass="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 mr-1">
          <Icon name="compare_arrows" size={18} className="text-secondary" />
          <span className="text-headline-section text-on-surface">다중 지자체 교차 진단</span>
          <span className="text-caption-regular text-outline">최대 {MAX}개 지자체</span>
        </span>
        {slots.map((region, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-caption-medium text-outline font-semibold">vs</span>}
            <Slot
              index={i}
              region={region}
              onChange={(r) => setSlot(i, r)}
              onRemove={() => removeSlot(i)}
              removable={slots.length > 2}
            />
          </span>
        ))}
        {slots.length < MAX && (
          <Button variant="ghost" size="sm" icon="add_circle" onClick={addSlot}>
            비교 지역 추가
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="tonal" size="sm" icon="print" onClick={() => window.print()}>
          행정 보고서 출력
        </Button>
      </Panel>

      {ready.length < 2 && (
        <Panel>
          <p className="py-6 text-center text-body-regular text-on-surface-variant">
            비교할 지역을 2개 이상 선택하세요.
          </p>
        </Panel>
      )}

      {loading && <Loading label="교차 진단 산출 중…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <Panel
            title="핵심 행정·상권 진단 지표 교차 검증"
            sub="막대는 지역이 달라도 같은 눈금입니다. 대조 지역 칸의 칩은 기준 지역과의 격차입니다."
            actions={
              <span className="inline-flex items-center gap-1.5 text-caption-regular text-on-surface-variant">
                <span className="w-3 h-3 rounded-sm bg-type-deficit-bg border border-type-deficit-border" />
                유의미 격차 발생행
              </span>
            }
            bodyClass="!px-0 !pb-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: 170 }} />
                  {data.regions.map((r) => <col key={r.region} />)}
                </colgroup>
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="text-left text-table-header text-on-surface-variant px-3 py-2
                                   border-y border-surface-container-highest align-bottom">
                      진단 항목
                    </th>
                    {data.regions.map((r, i) => (
                      <th key={r.region}
                          className="text-left px-3 py-2 border-b border-l border-surface-container-highest align-bottom"
                          style={{ borderTop: `3px solid ${LINE_COLOR[i]}` }}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full text-[11px] font-semibold flex items-center
                                           justify-center text-on-primary tabular shrink-0"
                                style={{ background: LINE_COLOR[i] }}>
                            {i + 1}
                          </span>
                          <span className="text-body-semibold text-on-surface">{r.region}</span>
                          <Chip tone={i === 0 ? 'primary' : 'neutral'}>
                            {i === 0 ? '기준' : `대조 ${String.fromCharCode(64 + i)}`}
                          </Chip>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.key}
                        className={row.divergent ? 'bg-type-deficit-bg/40' : 'bg-surface-container-lowest'}>
                      <th scope="row"
                          className="text-left align-top px-3 py-row border-b border-surface-container-highest">
                        <span className="flex items-center gap-1.5 text-body-semibold text-on-surface">
                          {row.label}
                          {row.divergent && <Chip tone="warn">격차</Chip>}
                        </span>
                        <span className="block text-caption-regular text-outline font-normal">
                          {row.sub}
                        </span>
                      </th>
                      {row.values.map((v, i) => (
                        <td key={i}
                            className="align-top px-3 py-row border-b border-l border-surface-container-highest">
                          <Cell row={row} value={v} index={i} color={LINE_COLOR[i]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title="세대 이탈 프로파일 다중 비교"
            sub="연령대별 외식 소비 비중과 근린소매 비중의 격차. 0선 위는 그 세대가 지역에 잔존, 아래는 이탈을 뜻합니다."
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              <GapProfile
                series={data.regions.map((r, i) => ({
                  region: r.region,
                  color: LINE_COLOR[i],
                  points: r.age_profile,
                }))}
                national={data.national_profile}
                height={fitHeight(vh, 270, 0.5, 420)}
              />
              <div className="flex flex-col gap-2 min-w-0">
                <div className="tile px-1.5 py-1 overflow-x-auto">
                  <GapTable
                    labels={data.regions[0].age_profile.map((p) => p.label)}
                    rows={[
                      ...data.regions.map((r, i) => ({
                        label: r.ccg, color: LINE_COLOR[i], points: r.age_profile,
                      })),
                      { label: '전국 평균', points: data.national_profile, muted: true },
                    ]}
                  />
                </div>
                {data.regions.map((r, i) => {
                  const valid = r.age_profile.filter((p) => typeof p.gap === 'number')
                  const lowest = valid.reduce((a, b) => (a.gap <= b.gap ? a : b))
                  const highest = valid.reduce((a, b) => (a.gap >= b.gap ? a : b))
                  return (
                    <div key={r.region} className="tile px-2.5 py-1.5">
                      <p className="flex items-center gap-1.5 text-caption-medium text-on-surface">
                        <span className="w-2 h-2 rounded-full" style={{ background: LINE_COLOR[i] }} />
                        {r.ccg} 분석 시사점
                      </p>
                      <p className="mt-0.5 text-caption-regular text-on-surface-variant leading-relaxed">
                        {lowest.label}에서 {signed(lowest.gap)}로 가장 크게 이탈하고
                        {' '}{highest.label}에서 {signed(highest.gap)}로 잔존합니다.
                        근린소매 소비 규모는 {won(r.volume.living_spend)}(전국 백분위
                        {' '}{num(r.volume.living_spend_pctl, 0)}%)입니다.
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
