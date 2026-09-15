/** 지역 진단 — 단일 시군구 정밀 진단서. 위 한 줄에 네 지표, 아래에 그래프와 서술. */
import { useNavigate, useParams } from 'react-router-dom'
import GapProfile from '../charts/GapProfile'
import { MedianBar, StackedBar, ThresholdGauge } from '../charts/Figures'
import RegionPicker from '../components/RegionPicker'
import {
  Button, Chip, Empty, ErrorState, Icon, KV, Loading, NotLinked, Panel, TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { month, num, pct, signed, won } from '../lib/format'
import { fitHeight, useViewportHeight } from '../lib/useViewport'

const COMP_COLOR = {
  social_dining: '#1f3a5f',
  daily_dining: '#1c5cab',
  large_retail: '#2a78d6',
  neighborhood: '#86b6ef',
}

function LadderCard({ ladder }) {
  return (
    <Panel title="기능 유지도" sub="상위 3단계 업종의 잔존 여부" chip={<Chip tone="outline">사다리 위계</Chip>}>
      <p className="text-display-kpi tabular text-on-surface leading-none">
        {ladder.score}
        <span className="ml-1 text-caption-regular text-on-surface-variant font-normal">
          / {ladder.max} 단계 충족
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {ladder.steps.map((s) => (
          <li key={s.business} className="tile flex items-center justify-between gap-2 px-2 py-1">
            <span className="flex items-center gap-1.5 text-body-regular text-on-surface">
              <span className="w-4 h-4 rounded-full bg-surface-container-high text-[11px] font-medium
                               flex items-center justify-center tabular">{s.step}</span>
              {s.business}
            </span>
            <span className={`inline-flex items-center gap-1 text-caption-medium font-semibold ${
              s.present ? 'text-secondary' : 'text-type-drain'}`}>
              <Icon name={s.present ? 'check_circle' : 'cancel'} size={14} />
              {s.state}
            </span>
          </li>
        ))}
      </ul>
      {ladder.missing !== '-' ? (
        <p className="mt-2 flex items-center gap-1 text-caption-medium text-type-deficit-text">
          <Icon name="info" size={14} />
          결손된 상위 업종: {ladder.missing}
        </p>
      ) : (
        <p className="mt-2 text-caption-regular text-outline">
          세 계층 모두 관측 · 위계 패턴 {ladder.pattern}{ladder.conforms ? ' (정합)' : ' (비정합)'}
        </p>
      )}
    </Panel>
  )
}

function DrainCard({ drain }) {
  return (
    <Panel
      title="세대 격차 민감도"
      sub="외식 연령 구성 − 근린소매 연령 구성"
      chip={drain.exceeded
        ? <Chip tone="alert">임계선 초과</Chip>
        : <Chip tone="neutral">임계선 이내</Chip>}
    >
      <p className={`text-display-kpi tabular leading-none ${
        drain.exceeded ? 'text-type-drain' : 'text-on-surface'}`}>
        {signed(drain.index, 1, '')}
        <span className="ml-0.5 text-caption-regular text-on-surface-variant font-normal">%p</span>
      </p>
      <ThresholdGauge value={drain.index} threshold={drain.threshold} />
      <p className={`mt-1.5 flex items-center gap-1 text-caption-medium ${
        drain.exceeded ? 'text-type-drain' : 'text-on-surface-variant'}`}>
        <Icon name={drain.exceeded ? 'warning' : 'check_circle'} size={14} />
        전국 {drain.rank}위 / {drain.total}개 지역 · 상위 {num(drain.top_pct)}%
      </p>
    </Panel>
  )
}

function CauseCard({ cause, volume }) {
  return (
    <Panel title="주 소비 이동 패턴" sub="생활소비 원단위 기반 원인 분해" chip={<Chip tone="outline">구조 진단</Chip>}>
      <p className={`text-display-kpi leading-none ${cause.available ? 'text-on-surface' : 'text-outline'}`}>
        {cause.available ? cause.verdict : '판정 보류'}
      </p>
      {cause.available ? (
        <div className="mt-2 tile px-2.5 py-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-caption-regular text-on-surface-variant">실존 인구 괴리율</span>
            <span className="text-headline-section tabular text-on-surface">
              {num(cause.presence_ratio, 2)}
            </span>
          </div>
          <p className="mt-0.5 text-caption-regular text-outline">
            주민등록 인구 {num(cause.population, 0)}명 기준 생활소비 원단위를 전국 중앙값(1.00)과
            대조한 값
          </p>
        </div>
      ) : (
        <NotLinked
          className="mt-2"
          what="행안부 주민등록 인구통계"
          hint="data/population.csv 를 넣으면 공동화형·유출형·유입형 판정이 활성화됩니다."
        />
      )}
      <KV
        className="mt-1.5"
        items={[
          ['근린소매 소비', (
            <>
              {won(volume.living_spend)}
              <span className="ml-1 text-caption-regular text-outline font-normal">
                백분위 {num(volume.living_spend_pctl, 0)}%
              </span>
            </>
          )],
          ['월평균 외식 지출', (
            <>
              {won(volume.monthly_dining)}
              <span className="ml-1 text-caption-regular text-outline font-normal">
                외식의존도 {num(volume.dining_dependency, 2)}
              </span>
            </>
          )],
        ]}
      />
    </Panel>
  )
}

function ForeignCard({ foreign }) {
  const hot = foreign.youth_share >= 40
  return (
    <Panel
      title="외국인 정주 소비"
      sub="체류 정책 변화의 상권 전이 위험"
      chip={hot ? <Chip tone="warn">청년 40% 이상</Chip> : <Chip tone="neutral">중앙값 대조</Chip>}
    >
      <p className={`text-display-kpi tabular leading-none ${hot ? 'text-type-drain' : 'text-on-surface'}`}>
        {pct(foreign.youth_share)}
        <span className="ml-1 text-caption-regular text-on-surface-variant font-normal">
          20~30대 소비 중 외국인
        </span>
      </p>
      <div className="mt-1">
        <MedianBar value={foreign.youth_share} median={foreign.youth_median} />
      </div>
      <p className="mt-1.5 text-caption-regular text-outline">
        전체 소비 중 외국인 {pct(foreign.share)} · 전국 255개 시군구 중앙값 {pct(foreign.youth_median)}
      </p>
    </Panel>
  )
}

function CompositionPanel({ composition, region }) {
  const groups = composition.groups.map((g) => ({ ...g, color: COMP_COLOR[g.key] }))
  const national = composition.groups.map((g) => ({
    ...g, share: g.national_share, color: COMP_COLOR[g.key],
  }))
  const worst = [...groups].sort((a, b) => a.delta - b.delta)[0]

  return (
    <Panel
      title="업종별 소비 구조 비교"
      sub={
        <>
          <b className="text-on-surface">구조 판독</b> — {worst.label} 비중 {pct(worst.share)}가
          전국 평균({pct(worst.national_share)}) 대비 {signed(worst.delta, 1, '%p')}로 네 기능군 중
          가장 크게 미달합니다.
        </>
      }
      actions={
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {groups.map((g) => (
            <span key={g.key} className="inline-flex items-center gap-1 text-caption-regular text-on-surface-variant">
              <span className="w-2 h-2 rounded-sm" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 min-w-0">
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-caption-medium text-on-surface flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-type-drain" />
                {region}
              </span>
              <span className="text-caption-regular text-outline tabular">
                총 {won(composition.total_amt)}
              </span>
            </div>
            <StackedBar groups={groups} />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-caption-medium text-on-surface-variant flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-outline" />
                전국 시군구 평균
              </span>
              <span className="text-caption-regular text-outline">기준선</span>
            </div>
            <StackedBar groups={national} height={22} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <div key={g.key} className="tile px-2.5 py-1.5 min-w-0">
              <p className="text-caption-regular text-on-surface-variant truncate">{g.label}</p>
              <p className="text-body-semibold text-on-surface tabular">
                {won(g.amt)} <span className="text-caption-regular font-normal">({pct(g.share)})</span>
              </p>
              <p className={`text-caption-regular tabular ${
                g.delta < 0 ? 'text-type-drain' : 'text-secondary'}`}>
                평균 대비 {signed(g.delta, 1, '%p')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

function Insight({ profile }) {
  const valid = profile.filter((p) => typeof p.gap === 'number')
  if (!valid.length) return null
  const lowest = valid.reduce((a, b) => (a.gap <= b.gap ? a : b))
  const highest = valid.reduce((a, b) => (a.gap >= b.gap ? a : b))
  return (
    <p className="note mt-1.5">
      <Icon name="insights" size={14} className="mt-px text-secondary" />
      <span>
        <b className="text-type-drain">{lowest.label}</b>에서 {signed(lowest.gap)}로 가장 크게
        이탈했고, <b className="text-on-surface">{highest.label}</b>에서 {signed(highest.gap)}로
        잔존합니다.
      </span>
    </p>
  )
}

export default function RegionalDiagnosis() {
  const { region: routeRegion } = useParams()
  const navigate = useNavigate()
  const region = routeRegion ?? '전라남도 영암군'

  const { data, error, loading, reload } = useApi(() => api.diagnosis(region), [region])
  const vh = useViewportHeight()

  const select = (r) => navigate(`/regions/${encodeURIComponent(r)}`)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h1 className="text-headline-page text-on-surface">{data?.region ?? region}</h1>
          {data && (
            <>
              <TypeBadge type={data.region_type} />
              <Chip tone={data.priority.startsWith('최상') ? 'alert' : 'neutral'}>
                우선순위 {data.priority}
              </Chip>
              <span className="text-caption-regular text-outline tabular">
                진단 기준월 {month(data.base_month)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <RegionPicker value={data?.region ?? region} onChange={select} className="w-60"
                        placeholder="다른 지역 검색" />
          <Button variant="primary" icon="description"
                  onClick={() => navigate(`/reports/${encodeURIComponent(region)}`)}>
            처방·리포트 생성
          </Button>
        </div>
      </div>

      {loading && <Loading label="정밀 진단 산출 중…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-gutter items-stretch">
            <LadderCard ladder={data.ladder} />
            <DrainCard drain={data.drain} />
            <CauseCard cause={data.cause} volume={data.volume} />
            <ForeignCard foreign={data.foreign} />
          </div>

          {/*
            꺾은선은 가로로 늘어질수록 등락이 납작해져 수치 비교가 안 된다.
            절반 폭에 높이를 충분히 주고, 오른쪽에 구성비와 서술을 세로로 쌓는다.
          */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-gutter items-stretch">
            <Panel
              title="세대 이탈 프로파일"
              sub="연령대별 외식 소비 비중 − 근린소매 소비 비중. 0선 위는 잔존, 아래는 이탈입니다."
              className="flex flex-col"
              bodyClass="flex flex-col flex-1"
            >
              <GapProfile
                series={[{ region: data.region, color: '#c0392b', points: data.age_profile }]}
                national={data.age_profile.map((p) => ({ ...p, gap: p.national_gap }))}
                height={fitHeight(vh, 370, 0.5, 480)}
              />
              <Insight profile={data.age_profile} />
            </Panel>

            <div className="flex flex-col gap-gutter min-w-0">
            <CompositionPanel composition={data.composition} region={data.region} />

            <Panel
              title="진단 서술"
              chip={<Chip tone="outline">근거 지표 동봉</Chip>}
              sub="지표 원본과 함께 제공되어 담당자가 근거를 검증할 수 있습니다."
            >
              <p className="text-body-regular text-on-surface leading-relaxed">
                {data.prescription['지자체']}
              </p>
              <KV
                className="mt-2"
                cols={3}
                items={[
                  ['유형', data.region_type],
                  ['상권기능 사다리', `${data.ladder.score} / ${data.ladder.max} 단계`],
                  ['세대이탈지수', signed(data.drain.index)],
                  ['외국인 소비 비중', pct(data.foreign.share)],
                  ['청년 소비 중 외국인', pct(data.foreign.youth_share)],
                  ['월평균 외식 지출액', won(data.volume.monthly_dining)],
                ]}
              />
            </Panel>
            </div>
          </div>
        </>
      )}

      {!loading && !error && !data && <Empty title="지역을 선택하세요" />}
    </>
  )
}
