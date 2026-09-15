/** 창업 적합도 — 지역 × 희망 업종의 진입 판정. 조건 한 줄, 판정 한 줄, 근거는 그 아래. */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Donut, ScoreBreakdown } from '../charts/Figures'
import RegionPicker from '../components/RegionPicker'
import {
  Button, Chip, ErrorState, Icon, Loading, PageHeader, Panel, Select, TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { VERDICT_STYLE, num, pct, signed } from '../lib/format'
import { fitHeight, useViewportHeight } from '../lib/useViewport'

const AGE_COLOR = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281', '#0b2747']
const TONE_STYLE = {
  positive: { bg: 'bg-secondary', icon: 'check' },
  neutral: { bg: 'bg-outline', icon: 'remove' },
  negative: { bg: 'bg-type-deficit', icon: 'priority_high' },
}

function VerdictStrip({ result }) {
  const style = VERDICT_STYLE[result.verdict]
  return (
    <div className="tile px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded text-body-semibold ${style.chip}`}>
        <Icon name={style.icon} size={18} />
        {result.verdict}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-caption-regular text-on-surface-variant">종합 진단 스코어</span>
        <span className="text-display-kpi tabular text-on-surface leading-none">{num(result.score)}</span>
        <span className="text-caption-regular text-on-surface-variant">/ 100</span>
      </span>
      <span className="text-caption-regular text-outline">
        {result.region} · {result.business}
      </span>
      <span className="flex-1" />
      <span className="flex items-center gap-1.5">
        <Icon name="query_stats" size={16} className="text-secondary" />
        <span className="text-caption-regular text-on-surface-variant">공급 대비 수요 공백 지수</span>
        <span className={`text-headline-section tabular ${
          result.demand_gap_pct > 0 ? 'text-secondary' : 'text-type-drain'}`}>
          {signed(result.demand_gap_pct, 1, '%')}
        </span>
      </span>
    </div>
  )
}

export default function StartupSuitability() {
  const navigate = useNavigate()
  const [region, setRegion] = useState('전라남도 영암군')
  const [business, setBusiness] = useState('갈비전문점')
  const vh = useViewportHeight()

  const { data: catalog } = useApi(() => api.businesses(), [])
  const { data, error, loading, reload } = useApi(
    () => api.assess(region, business), [region, business], { skip: !region || !business },
  )

  return (
    // 예비 창업자 한 사람이 위에서 아래로 읽는 화면이라 관리자 화면보다 좁게 잡는다
    <div className="mx-auto w-full max-w-[1080px] flex flex-col gap-gutter">
      <PageHeader
        title="창업 적합도 진단"
        meta={
          <Chip tone="info">
            <Icon name="storefront" size={13} />
            소상공인·예비 창업자 전용
          </Chip>
        }
        sub="지역과 희망 업종을 선택하면 카드 소비데이터 기반의 진입 적합도를 산출합니다. 공급 공백은 배후 수요가 확인될 때만 기회로 계산됩니다."
      />

      {/* 지역 검색 드롭다운이 아래 패널 위로 뜨도록 이 패널을 z-20 층에 올린다 */}
      <Panel dense className="relative z-20" bodyClass="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <span className="flex items-center gap-1 text-caption-medium text-on-surface-variant shrink-0">
            <Icon name="location_on" size={14} />
            희망 지역
          </span>
          <RegionPicker value={region} onChange={setRegion} className="flex-1" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[320px]">
          <span className="flex items-center gap-1 text-caption-medium text-on-surface-variant shrink-0">
            <Icon name="restaurant" size={14} />
            희망 업종
          </span>
          <Select
            className="flex-1"
            value={business}
            onChange={setBusiness}
            options={(catalog?.items ?? []).map((b) => ({
              value: b.business,
              label: `${b.business} — ${b.group_label} (전국 ${b.presence}/${b.total}개 지역 보유)`,
            }))}
          />
        </div>
        <Chip tone="outline">{catalog?.items?.length ?? 0}개 업종</Chip>
      </Panel>

      {loading && <Loading label="적합도 산출 중…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <Panel bodyClass="flex flex-col gap-3">
            <VerdictStrip result={data} />

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3">
              <div>
                <h3 className="flex items-center gap-1.5 text-body-semibold text-on-surface mb-1.5">
                  <Icon name="fact_check" size={16} className="text-secondary" />
                  핵심 입지 판정 요약
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {data.findings.map((f, i) => {
                    const tone = TONE_STYLE[f.tone] ?? TONE_STYLE.neutral
                    return (
                      <li key={i} className="tile flex items-start gap-2 px-2.5 py-1.5">
                        <span className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center
                                          text-on-primary text-[11px] font-medium tabular ${tone.bg}`}>
                          {i + 1}
                        </span>
                        <p className="text-body-regular text-on-surface leading-relaxed">{f.text}</p>
                      </li>
                    )
                  })}
                </ol>
              </div>

              <div>
                <h3 className="flex items-center gap-1.5 text-body-semibold text-on-surface mb-1.5">
                  <Icon name="bar_chart" size={16} className="text-secondary" />
                  점수 구성
                </h3>
                <ScoreBreakdown breakdown={data.breakdown} weights={data.weights} />
                <p className="mt-1.5 text-caption-regular text-outline leading-relaxed">
                  권장 {num(data.thresholds.recommend, 0)}점 이상 · 조건부 권장
                  {' '}{num(data.thresholds.conditional, 0)}점 이상. 공급 공백 점수는 배후 수요와
                  곱해 산출하므로, 사람이 없어 비어 있는 자리는 기회로 계산되지 않습니다.
                </p>
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-gutter items-stretch">
            <Panel
              title="이 지역에 남아 있는 소비 세대"
              sub="근린소매(편의점·슈퍼마켓) 결제의 연령 구성비. 원정 소비가 없어 실제 거주 인구 구조를 반영합니다."
            >
              <Donut
                size={fitHeight(vh, 136, 0.25, 180)}
                items={data.age_mix.map((a, i) => ({
                  label: a.label, share: a.share, color: AGE_COLOR[i],
                }))}
                centerValue={
                  data.age_mix.reduce((a, b) => ((a.share ?? 0) >= (b.share ?? 0) ? a : b)).label
                }
                centerLabel="주력 세대"
              />
            </Panel>

            <Panel
              title="상권 내 공백 업종 TOP 3"
              sub="해당 업종 보유 지역의 중앙값 대비 미달 폭이 큰 순서"
              chip={<Chip tone="warn">수요 유출 구간</Chip>}
            >
              <ol className="flex flex-col gap-1.5">
                {data.vacancies.map((v, i) => (
                  <li key={v.business} className="tile px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-primary-container text-on-primary
                                         text-[11px] font-medium flex items-center justify-center tabular">
                          {i + 1}
                        </span>
                        <span className="text-body-semibold text-on-surface">{v.business}</span>
                        <Chip tone={v.status === '결손' ? 'alert' : 'warn'}>{v.status}</Chip>
                      </span>
                      <span className="text-body-semibold tabular text-type-drain">
                        {signed(v.gap_pct, 1, '%')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-caption-regular text-on-surface-variant">{v.note}</p>
                    <p className="text-[11px] leading-4 text-outline tabular">
                      지역 {pct(v.local_share, 2)} · 보유 지역 중앙값 {pct(v.national_share, 2)} ·
                      전국 보유 {v.presence}
                    </p>
                  </li>
                ))}
                {data.vacancies.length === 0 && (
                  <li className="text-body-regular text-on-surface-variant py-3 text-center">
                    보유 지역 중앙값에 미달하는 업종이 없습니다.
                  </li>
                )}
              </ol>
            </Panel>
          </div>

          <Panel dense bodyClass="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <TypeBadge type={data.region_type} />
              <p className="text-caption-regular text-on-surface-variant">
                지역 유형에 따른 진입 조건이 점수에 반영되어 있습니다. {data.caveat}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="tonal" size="sm" icon="analytics"
                      onClick={() => navigate(`/regions/${encodeURIComponent(data.region)}`)}>
                지역 정밀 진단 보기
              </Button>
              <Button variant="primary" size="sm" icon="print" onClick={() => window.print()}>
                간이 상권 분석서 인쇄
              </Button>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
