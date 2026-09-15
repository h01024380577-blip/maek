/**
 * 전국 현황 — 255개 시군구 종합 진단 대시보드.
 *
 * 1440×900 한 화면에 들어오도록 짠다. 왼쪽에 사분면, 오른쪽에 경보 목록과
 * 선택 지역 요약을 세로로 쌓아 점을 누르면 바로 옆에서 요약이 뜨게 한다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuadrantMatrix from '../charts/QuadrantMatrix'
import {
  Button, Chip, Empty, ErrorState, Icon, Loading, MiniStat, PageHeader, Panel, Stat, TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { TYPE_STYLE, month, num, pct, shortRegion, signed } from '../lib/format'
import { fitHeight, useViewportHeight } from '../lib/useViewport'

const KIND_TONE = { '선행 경보': 'alert', '과소평가': 'info', '외국인 의존': 'warn' }

// 페이지가 이미 스크롤되므로 목록 안에 또 스크롤을 만들지 않는다.
// 사분면 옆에 들어가는 만큼(rows)만 보여주고 나머지는 경보 센터로 넘긴다.
function AlertFeed({ onSelect, rows = 8 }) {
  const { data, error, loading } = useApi(() => api.alerts({}), [])
  const navigate = useNavigate()

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-error" />
          최근 감지 경보
        </span>
      }
      chip={<Chip tone="outline">{data?.total ?? 0}건</Chip>}
      actions={
        <Button variant="ghost" size="sm" icon="chevron_right" onClick={() => navigate('/alerts')}>
          경보 센터
        </Button>
      }
    >
      {loading && <Loading label="경보 조회 중…" />}
      {error && <ErrorState error={error} />}
      {data?.items?.length === 0 && <Empty title="감지된 경보가 없습니다" />}
      <ul className="divide-y divide-surface-container-highest">
        {data?.items?.slice(0, rows).map((a) => (
          <li key={`${a.region}-${a.kind}`}>
            <button
              onClick={() => onSelect?.(a.region)}
              className="w-full text-left flex items-center gap-2 px-1.5 py-row rounded
                hover:bg-surface-container-low transition-colors"
            >
              <span className="w-1 h-4 rounded-full shrink-0"
                    style={{ background: TYPE_STYLE[a.region_type]?.dot }} />
              <span className="flex-1 min-w-0 text-body-medium text-on-surface truncate">
                {shortRegion(a.region)}
              </span>
              <span className="text-caption-regular text-on-surface-variant tabular shrink-0">
                {signed(a.drain_index)} · {a.ladder_score}/3
                {a.kind === '외국인 의존' && ` · 외국인 ${pct(a.youth_foreign_share)}`}
              </span>
              <Chip tone={KIND_TONE[a.kind]}>{a.kind}</Chip>
            </button>
          </li>
        ))}
      </ul>
      {data && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-caption-regular text-outline truncate">기준: {data.criteria}</span>
          {data.total > rows && (
            <button
              onClick={() => navigate('/alerts')}
              className="text-caption-medium text-secondary hover:underline shrink-0"
            >
              나머지 {data.total - rows}건 보기
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}

function RegionInspector({ region, onClear }) {
  const navigate = useNavigate()
  const { data, error, loading } = useApi(
    () => api.diagnosis(region), [region], { skip: !region },
  )

  if (!region) {
    return (
      <Panel title="지역 상세" className="flex-1">
        <p className="flex items-center gap-1.5 text-caption-regular text-on-surface-variant">
          <Icon name="ads_click" size={14} className="text-outline" />
          산점도의 점이나 위 경보 목록을 클릭하면 정밀 진단 요약이 여기에 나타납니다.
        </p>
      </Panel>
    )
  }
  if (error) return <Panel title="지역 상세" className="flex-1"><ErrorState error={error} /></Panel>
  // skip 이 풀린 직후 첫 렌더는 loading=false 인데 data 도 아직 없다. 그 틈도 로딩으로 본다.
  if (loading || !data) return <Panel title="지역 상세" className="flex-1"><Loading /></Panel>

  return (
    <Panel
      className="flex-1"
      title={data.region}
      chip={<TypeBadge type={data.region_type} />}
      sub={data.cause.available
        ? `${data.cause.verdict} · 우선순위 ${data.priority}`
        : `우선순위 ${data.priority} · 원인 분해는 인구 데이터 연동 후 판정`}
      actions={
        <>
          <Button variant="ghost" size="sm" icon="analytics" title="정밀 진단서 열람"
                  aria-label="정밀 진단서 열람"
                  onClick={() => navigate(`/regions/${encodeURIComponent(data.region)}`)} />
          <Button variant="ghost" size="sm" icon="description" title="처방·리포트"
                  aria-label="처방·리포트"
                  onClick={() => navigate(`/reports/${encodeURIComponent(data.region)}`)} />
          <Button variant="ghost" size="sm" icon="close" title="선택 해제" aria-label="선택 해제"
                  onClick={onClear} />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="상권 사다리" value={data.ladder.score} unit={`/ ${data.ladder.max}`}
                  note={data.ladder.missing === '-' ? '전 계층 유지' : `결손 ${data.ladder.missing}`} />
        <MiniStat label="세대이탈지수" value={signed(data.drain.index)}
                  note={`전국 ${data.drain.rank}위 · 상위 ${num(data.drain.top_pct)}%`}
                  tone={data.drain.exceeded ? 'text-type-drain' : 'text-on-surface'} />
        <MiniStat label="외국인 소비 비중" value={pct(data.foreign.share)}
                  note={`청년 소비 중 ${pct(data.foreign.youth_share)}`} />
        <MiniStat label="위계 정합" value={data.ladder.conforms ? '부합' : '비정합'}
                  note={`패턴 ${data.ladder.pattern}`} />
      </div>
    </Panel>
  )
}

/** 어떤 원천이 붙어 있는지 한 줄로. 자세한 용도는 마우스를 올리면 나온다. */
function DataAudit({ summary }) {
  const rows = [
    ['BC카드 소비', 'BC카드 소비데이터', summary.sources.card,
     `${summary.audit.rows?.toLocaleString('ko-KR')}행 · 결측 ${summary.audit.nulls}건`],
    ['주민등록 인구', '행안부 주민등록 인구통계', summary.sources.population,
     '생활소비 원단위 · 공동화/유출 판정에 필요'],
    ['소멸위험지수', '고용정보원 지방소멸위험지수', summary.sources.risk_index,
     '기존 지수 대조를 통한 선행 경보 판정에 필요'],
    ['인구감소지역 지정', '행안부 인구감소지역 지정 현황', summary.sources.decline_areas,
     '미지정 지역 중 우선 검토 대상 추출에 필요'],
    ['LLM 서술문', 'LLM 진단 서술문', summary.sources.llm,
     '미연동 시 템플릿 서술문으로 자동 대체'],
  ]
  return (
    <Panel dense bodyClass="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-caption-medium text-on-surface-variant shrink-0">데이터 적재 현황</span>
      {rows.map(([short, full, ok, hint]) => (
        <span key={full} title={`${full} — ${hint}`}
              className="inline-flex items-center gap-1 text-caption-regular cursor-default">
          <Icon name={ok ? 'check_circle' : 'link_off'} size={14}
                className={ok ? 'text-secondary' : 'text-outline'} />
          <span className={ok ? 'text-on-surface font-medium' : 'text-on-surface-variant'}>{short}</span>
          <span className={`font-semibold ${ok ? 'text-secondary' : 'text-outline'}`}>
            {ok ? '연동' : '미연동'}
          </span>
        </span>
      ))}
      <span className="flex-1" />
      <span className="text-caption-regular text-outline tabular">
        (지역×업종) {summary.audit.complete_pairs}/{summary.audit.total_pairs}개 조합 전 기간 관측
        ({num((summary.audit.completeness ?? 0) * 100)}%) · 미상 코드 소비
        {' '}{num((summary.audit.unknown_amt_share ?? 0) * 100)}%
      </span>
    </Panel>
  )
}

export default function NationalOverview({ summary }) {
  const [selected, setSelected] = useState(null)
  const { data: matrix, error, loading } = useApi(() => api.matrix(), [])
  // 사분면은 화면 높이를 따라 자라고, 옆의 경보 목록은 그만큼 줄을 더 보여준다
  const vh = useViewportHeight()
  const matrixH = fitHeight(vh, 400, 0.85, 660)
  const feedRows = 8 + Math.floor((matrixH - 400) / 34)

  return (
    <>
      <PageHeader
        title="전국 인구·상권 맥락 종합 진단"
        meta={
          <>
            <Chip tone="primary">소비데이터 기반 조기경보</Chip>
            <span className="text-caption-regular text-outline tabular">
              데이터 차수 {month(summary.months?.[0])} ~ {month(summary.base_month)} (
              {summary.months?.length ?? 0}개월)
            </span>
          </>
        }
        sub="BC카드 시군구·업종별 소비데이터로 상권기능 사다리와 세대이탈지수를 산출해 255개 기초지자체를 매월 진단합니다."
        actions={
          <Button variant="tonal" icon="download" as="a" href={api.alertsCsvUrl({})}>
            경보 목록 CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-gutter">
        {summary.kpi.map((k) => (
          <Stat
            key={k.key}
            label={k.label}
            value={k.key === 'conformity' ? num(k.value) : k.value}
            unit={k.unit}
            note={k.note}
            status={k.status}
            tone={k.tone}
            chip={k.chip && <Chip tone={k.key === 'drain_lead' ? 'alert' : 'neutral'}>{k.chip}</Chip>}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-gutter items-stretch">
        <Panel
          title="2×2 지자체 소멸 리스크 사분면"
          sub="상권기능 사다리(가로) × 세대이탈지수(세로). 두 축의 순위상관은 −0.337로 서로를 대체하지 않습니다."
          chip={<Chip tone="outline">{month(summary.base_month)} 기준</Chip>}
          className="flex flex-col"
          bodyClass="flex flex-col flex-1"
        >
          {loading && <Loading label="매트릭스 산출 중…" />}
          {error && <ErrorState error={error} />}
          {matrix && (
            <>
              <QuadrantMatrix data={matrix} selected={selected} onSelect={setSelected} height={matrixH} />
              <ul className="mt-auto pt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                {matrix.legend.map((l) => (
                  <li key={l.type} className="flex items-center gap-1.5 text-caption-regular">
                    <span className="w-2 h-2 rounded-full"
                          style={{ background: TYPE_STYLE[l.type].dot }} />
                    <span className="text-on-surface font-medium">{l.type}</span>
                    <span className="text-on-surface font-semibold tabular">{l.count}곳</span>
                    <span className="text-outline tabular">({num(l.share)}%)</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-gutter min-w-0">
          <AlertFeed onSelect={setSelected} rows={feedRows} />
          <RegionInspector region={selected} onClear={() => setSelected(null)} />
        </div>
      </div>

      <DataAudit summary={summary} />
    </>
  )
}
