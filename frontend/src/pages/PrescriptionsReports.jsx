/** 처방 및 리포트 — 유형별 권장 조치와 공문서용 리포트 묶음. 왼쪽 처방, 오른쪽 문서 미리보기. */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import RegionPicker from '../components/RegionPicker'
import {
  Button, Chip, ErrorState, Icon, Loading, MiniStat, NotLinked, PageHeader, Panel, Segmented,
  TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { month, num, pct, signed } from '../lib/format'

const HORIZON_TONE = { 단기: 'alert', 중기: 'info', 장기: 'neutral' }
const AUDIENCES = {
  지자체: '지자체 정책 담당자',
  창업자: '로컬 창업자',
  카드사: '제휴 카드사·소상공인 진흥원',
}

function ActionRow({ action, selected, onToggle }) {
  const priority = action.rank === '우선과제'
  return (
    <li className="flex items-start gap-2.5 py-[calc(var(--row)+2px)] border-b border-surface-container-highest last:border-0">
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={selected}
        aria-label={`${action.title} 선택`}
        className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center transition-colors
          ${selected
            ? 'bg-primary-container border-primary-container text-on-primary'
            : 'bg-surface-container-low border-outline-variant'}`}
      >
        {selected && <Icon name="check" size={12} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip tone={priority ? 'primary' : 'neutral'}>
            {action.rank} {action.no}
          </Chip>
          <h4 className="text-body-semibold text-on-surface">{action.title}</h4>
        </div>
        <p className="mt-0.5 text-caption-regular text-on-surface-variant leading-relaxed">
          {action.detail}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Chip tone="outline">{action.owner}</Chip>
        <Chip tone={HORIZON_TONE[action.horizon]}>{action.horizon}</Chip>
      </div>
    </li>
  )
}

function ReportPreview({ report, selectedCount }) {
  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <Icon name="draft" size={18} className="text-secondary" />
          리포트 미리보기
        </span>
      }
      chip={<Chip tone="outline">A4 규격</Chip>}
      sub={`문서번호 ${report.document_no} · 같은 지역·같은 기준월이면 항상 같은 번호가 발급됩니다.`}
      actions={
        <Button variant="primary" size="sm" icon="picture_as_pdf" onClick={() => window.print()}>
          인쇄 / PDF 저장
        </Button>
      }
    >
      <div className="rounded border border-surface-container-highest bg-surface-container-lowest px-4 py-3">
        <div className="flex items-start justify-between gap-2 text-[11px] leading-4 text-outline">
          <span className="tabular">{report.document_no}</span>
          <span>맥(脈) 조기감지 시스템</span>
        </div>
        <div className="my-3 text-center">
          <div className="mx-auto w-10 h-0.5 bg-primary-container mb-1.5" />
          <h3 className="text-body-semibold text-on-surface leading-snug">
            {report.region} 지방소멸 위기대응<br />
            상권 및 인구이탈 종합 처방보고서
          </h3>
          <p className="mt-1 text-caption-regular text-on-surface-variant tabular">
            {month(report.base_month)} 기준 · {report.audience_label} 용
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-surface-container-highest border-y border-surface-container-highest">
          {Object.entries(report.facts).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-1">
              <dt className="text-caption-regular text-on-surface-variant">{k.replace(/_/g, ' ')}</dt>
              <dd className="text-caption-medium text-on-surface tabular">{String(v)}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-1.5 text-[11px] leading-4 text-outline text-right tabular">
          선택 조치 {selectedCount}건 반영 · 1 / {report.contents.length + 1}
        </p>
      </div>

      <div className="mt-2">
        <p className="text-caption-medium text-on-surface-variant mb-1">보고서 목차</p>
        <ol className="flex flex-col gap-0.5">
          {report.contents.map((c) => (
            <li key={c.no} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-surface-container-high text-[11px] font-medium
                               flex items-center justify-center tabular shrink-0">{c.no}</span>
              <span className="text-caption-regular text-on-surface truncate">{c.title}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  )
}

export default function PrescriptionsReports() {
  const { region: routeRegion } = useParams()
  const navigate = useNavigate()
  const region = routeRegion ?? '전라남도 영암군'
  const [audience, setAudience] = useState('지자체')
  const [selected, setSelected] = useState(null)

  const { data, error, loading, reload } = useApi(
    () => api.report(region, audience), [region, audience],
  )

  useEffect(() => {
    if (data) setSelected(new Set(data.actions.filter((a) => a.selected).map((a) => a.no)))
  }, [data])

  const toggle = (no) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(no)) next.delete(no)
      else next.add(no)
      return next
    })

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-1.5">
            <Icon name="policy" size={20} className="text-secondary" />
            정책 맞춤 처방 및 공문서 리포트
          </span>
        }
        meta={<Chip tone="outline">문서 생성 모듈</Chip>}
        actions={
          <>
            <RegionPicker value={data?.region ?? region}
                          onChange={(r) => navigate(`/reports/${encodeURIComponent(r)}`)}
                          className="w-60" />
            <Button variant="tonal" icon="analytics"
                    onClick={() => navigate(`/regions/${encodeURIComponent(region)}`)}>
              진단 상세
            </Button>
          </>
        }
      />

      {loading && <Loading label="처방 구성 중…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <Panel dense bodyClass="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="flex items-center gap-1 text-headline-section text-on-surface">
                <Icon name="location_on" size={16} className="text-secondary" />
                {data.region}
              </span>
              <TypeBadge type={data.region_type} />
              <Chip tone={data.priority.startsWith('최상') ? 'alert' : 'neutral'}>
                우선순위 {data.priority}
              </Chip>
              <span className="ml-1 text-caption-regular text-on-surface-variant">소멸위험지수</span>
              {data.summary.risk_index_available ? (
                <span className="text-body-semibold tabular text-type-drain">
                  {num(data.summary.risk_index, 3)}
                </span>
              ) : (
                <Chip tone="outline">미연동</Chip>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption-regular text-on-surface-variant">수신 대상</span>
              <Segmented
                options={Object.entries(AUDIENCES).map(([key, label]) => ({ key, label }))}
                value={audience}
                onChange={(v) => setAudience(v ?? '지자체')}
              />
            </div>
          </Panel>

          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-gutter items-start">
            <div className="flex flex-col gap-gutter min-w-0">
              <Panel
                title={
                  <span className="flex items-center gap-1.5">
                    <Icon name="lightbulb" size={18} className="text-secondary" />
                    정책 권고 총평
                  </span>
                }
                chip={<Chip tone="outline">{data.narrative_source === 'template'
                  ? '규칙 기반 서술' : data.narrative_source}</Chip>}
              >
                <p className="text-body-semibold text-on-surface">{data.headline}</p>
                <p className="mt-1.5 tile px-2.5 py-2 text-body-regular text-on-surface leading-relaxed">
                  {data.narrative}
                </p>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <MiniStat label="세대이탈지수" value={signed(data.summary.youth_drain)}
                            note={`전국 상위 ${num(data.summary.drain_top_pct)}%`} tone="text-type-drain" />
                  <MiniStat label="상권 사다리 잔존"
                            value={`${data.summary.ladder_score} / ${data.summary.ladder_max}`}
                            note="상위 업종 잔존 단계" />
                  <MiniStat label="청년 소비 중 외국인" value={pct(data.summary.youth_foreign_share)}
                            note="체류 정책 전이 위험" tone="text-secondary" />
                </div>

                {!data.summary.decline_area_available && (
                  <NotLinked
                    className="mt-2"
                    what="행안부 인구감소지역 지정 현황"
                    hint="data/decline_areas.csv 를 넣으면 지정 여부 대조와 미지정 우선 검토 대상 추출이 활성화됩니다."
                  />
                )}
              </Panel>

              <Panel
                title={
                  <span className="flex items-center gap-1.5">
                    <Icon name="checklist" size={18} className="text-secondary" />
                    핵심 권장 조치 및 실행 매트릭스
                  </span>
                }
                sub="선택한 조치가 우측 리포트에 반영됩니다."
                actions={
                  <span className="text-caption-medium text-on-surface-variant tabular">
                    {selected?.size ?? 0} / {data.actions.length}건 선택
                  </span>
                }
              >
                <ul className="flex flex-col">
                  {data.actions.map((a) => (
                    <ActionRow
                      key={a.no}
                      action={a}
                      selected={selected?.has(a.no) ?? false}
                      onToggle={() => toggle(a.no)}
                    />
                  ))}
                </ul>
                <p className="note mt-2">
                  <Icon name="info" size={14} className="mt-px text-outline" />
                  <span>{data.budget_note}</span>
                </p>
              </Panel>
            </div>

            <ReportPreview report={data} selectedCount={selected?.size ?? 0} />
          </div>
        </>
      )}
    </>
  )
}
