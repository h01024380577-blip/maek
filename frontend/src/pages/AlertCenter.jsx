/**
 * 경보 센터 — 기존 지수와 소비 진단이 엇갈리는 지역 목록.
 *
 * 한 지역이 한 줄이다. 63건을 카드로 늘어놓으면 열다섯 화면이 넘어가 훑을 수
 * 없었다. 줄을 누르면 판독 소견과 근거 지표가 아래로 펼쳐진다.
 */
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MedianBar } from '../charts/Figures'
import {
  Button, Chip, Empty, ErrorState, Icon, Loading, PageHeader, Panel, Segmented, SearchInput,
  Select, TypeBadge,
} from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { TYPE_STYLE, month, num, pct, signed } from '../lib/format'

const KIND_TONE = { '선행 경보': 'alert', '과소평가': 'info', '외국인 의존': 'warn' }

const KIND_HELP = {
  '선행 경보': '상권 기능은 유지되나 세대 구성이 이미 이탈한 지역. 기존 통계가 위험으로 분류하기 전 단계로, 개입 효과가 가장 큽니다.',
  '과소평가': '기존 기준상 위험하나 세대 구성이 유지되는 지역. 투입 대비 회복 가능성이 높은 우선 지원 대상입니다.',
  '외국인 의존': '청년 소비의 상당 부분을 등록 체류 외국인이 담당하는 지역. 체류 정책 변화가 곧 상권 리스크로 전이됩니다.',
}

const TH = 'sticky top-14 z-10 bg-surface-container-low text-table-header text-on-surface-variant px-2.5 py-row border-b border-surface-container-highest whitespace-nowrap'
const TD = 'px-2.5 py-row align-middle whitespace-nowrap'

function alertKey(a) {
  return `${a.region}-${a.kind}`
}

function AlertRow({ alert: a, open, onToggle }) {
  const navigate = useNavigate()
  const drainDanger = a.drain_index > a.drain_threshold
  const ladderDanger = a.ladder_score <= 1
  const foreignDanger = a.youth_foreign_share >= 40
  const isForeign = a.kind === '외국인 의존'
  const stop = (e) => e.stopPropagation()

  return (
    <Fragment>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-surface-container-highest transition-colors
          hover:bg-surface-container-low ${open ? 'bg-surface-container-low' : 'bg-surface-container-lowest'}`}
      >
        <td className={TD}>
          <span className="flex items-center gap-1.5">
            <Icon name={open ? 'expand_more' : 'chevron_right'} size={14} className="text-outline" />
            <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: TYPE_STYLE[a.region_type]?.dot }} />
            <span className="text-body-semibold text-on-surface">{a.region}</span>
          </span>
        </td>
        <td className={TD}><TypeBadge type={a.region_type} size="sm" /></td>
        <td className={TD}><Chip tone={KIND_TONE[a.kind]}>{a.kind}</Chip></td>
        <td className={`${TD} text-table-cell ${a.severity === '높음' ? 'text-type-drain font-semibold' : 'text-on-surface-variant'}`}>
          {a.severity}
        </td>
        <td className={`${TD} text-right tabular text-body-semibold ${drainDanger ? 'text-type-drain' : 'text-on-surface'}`}>
          {signed(a.drain_index)}
        </td>
        <td className={`${TD} text-right tabular`}>
          <span className={`text-body-semibold ${ladderDanger ? 'text-type-drain' : 'text-on-surface'}`}>
            {a.ladder_score}/3
          </span>
          {a.missing_tiers !== '-' && (
            <span className="ml-1 text-[11px] text-outline">{a.missing_tiers} 결손</span>
          )}
        </td>
        <td className={`${TD} text-right tabular text-body-semibold ${foreignDanger ? 'text-type-drain' : 'text-on-surface'}`}>
          {pct(a.youth_foreign_share)}
        </td>
        <td className="px-2.5 py-row align-middle max-w-0 w-full">
          <p className="truncate text-caption-regular text-on-surface-variant">{a.message}</p>
        </td>
        <td className={`${TD} text-right`} onClick={stop}>
          <span className="inline-flex items-center gap-0.5">
            <Button variant="ghost" size="sm" icon="analytics" aria-label="지역 진단 상세"
                    title="지역 진단 상세"
                    onClick={() => navigate(`/regions/${encodeURIComponent(a.region)}`)} />
            <Button variant="ghost" size="sm" icon="description" aria-label="리포트 생성"
                    title="리포트 생성"
                    onClick={() => navigate(`/reports/${encodeURIComponent(a.region)}`)} />
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-surface-container-highest bg-surface-container-low/60">
          <td colSpan={9} className="px-3 py-2">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-caption-medium text-secondary">
                  <Icon name="neurology" size={14} />
                  진단 엔진 자동 판독 소견
                </p>
                <p className="mt-0.5 text-body-regular text-on-surface leading-relaxed whitespace-normal">
                  {a.message}
                </p>
                <p className="mt-1 text-caption-regular text-outline tabular whitespace-normal">
                  세대이탈지수 {signed(a.drain_index)} ({drainDanger ? '경보선 초과' : '경보선 이내'}, 경보선
                  {' '}{signed(a.drain_threshold, 1)}) · 상권기능 사다리 {a.ladder_score}/3 (
                  {a.missing_tiers === '-' ? '전 계층 유지' : `${a.missing_tiers} 결손`}) · 청년 소비 중 외국인
                  {' '}{pct(a.youth_foreign_share)} (전국 중앙값 {pct(a.youth_foreign_median)})
                </p>
              </div>
              <div className="flex flex-col items-end gap-2 lg:w-64">
                {isForeign && (
                  <div className="w-full">
                    <MedianBar value={a.youth_foreign_share} median={a.youth_foreign_median} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Button variant="tonal" size="sm" icon="description"
                          onClick={() => navigate(`/reports/${encodeURIComponent(a.region)}`)}>
                    리포트 생성
                  </Button>
                  <Button variant="primary" size="sm" icon="arrow_forward"
                          onClick={() => navigate(`/regions/${encodeURIComponent(a.region)}`)}>
                    지역 진단 상세
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

export default function AlertCenter() {
  const [kind, setKind] = useState(null)
  const [severity, setSeverity] = useState('')
  const [sido, setSido] = useState('')
  const [q, setQ] = useState('')
  const [opened, setOpened] = useState(() => new Set())

  const params = { kind, severity, sido, q }
  const { data, error, loading, reload } = useApi(
    () => api.alerts(params), [kind, severity, sido, q],
  )

  const reset = () => { setKind(null); setSeverity(''); setSido(''); setQ('') }
  const toggle = (key) =>
    setOpened((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <PageHeader
        title="위험 감지 경보 센터"
        meta={
          <>
            <Chip tone="alert">{data?.tabs?.[0]?.count ?? 0}건 활성</Chip>
            <span className="text-caption-regular text-on-surface-variant tabular">
              고위험(심각도 높음) <b className="text-on-surface">{data?.high_severity ?? 0}개 지자체</b>
              {' '}· 판정 기준월 <b className="text-on-surface">{month(data?.base_month)}</b>
            </span>
          </>
        }
        sub="기존 지수와 소비 진단이 엇갈리는 지역을 세 가지 경보로 나눠 보여줍니다. 줄을 누르면 판독 소견이 펼쳐집니다."
        actions={
          <Button variant="tonal" icon="table_view" as="a" href={api.alertsCsvUrl(params)}>
            CSV 다운로드
          </Button>
        }
      />

      <Panel dense bodyClass="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {data && (
            <Segmented
              options={data.tabs.map((t) => ({ key: t.key, label: t.label, count: t.count }))}
              value={kind}
              onChange={setKind}
            />
          )}
          <SearchInput value={q} onChange={setQ} className="flex-1 min-w-[200px]"
                       placeholder="지역명(예: 영암군) 또는 감지 사유 검색…" />
          <Select className="w-32" value={severity} onChange={setSeverity} placeholder="전체 심각도"
                  options={(data?.severity_options ?? []).map((s) => ({ value: s, label: `심각도 ${s}` }))} />
          <Select className="w-40" value={sido} onChange={setSido} placeholder="전국 시·도 전체"
                  options={(data?.sido_options ?? []).map((s) => ({ value: s, label: s }))} />
          <Button variant="ghost" size="sm" icon="refresh" onClick={reset}>초기화</Button>
        </div>
        {kind && (
          <p className="note">
            <Icon name="help" size={14} className="mt-px text-secondary" />
            <span><b className="text-on-surface">{kind}</b> — {KIND_HELP[kind]}</span>
          </p>
        )}
      </Panel>

      {loading && <Loading label="경보 조회 중…" />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {data && data.items.length === 0 && (
        <Panel><Empty icon="filter_alt_off" title="조건에 맞는 경보가 없습니다"
                      hint="필터를 초기화하고 다시 시도하세요" /></Panel>
      )}

      {data && data.items.length > 0 && (
        <Panel
          title="경보 목록"
          chip={<Chip tone="outline">{num(data.total, 0)}건</Chip>}
          sub={`판정 기준: ${data.criteria}`}
          actions={
            <Button variant="ghost" size="sm" icon={opened.size ? 'unfold_less' : 'unfold_more'}
                    onClick={() => setOpened(opened.size ? new Set() : new Set(data.items.map(alertKey)))}>
              {opened.size ? '모두 접기' : '모두 펼치기'}
            </Button>
          }
          bodyClass="!px-0 !pb-0"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${TH} text-left`}>지역</th>
                <th className={`${TH} text-left`}>유형</th>
                <th className={`${TH} text-left`}>경보</th>
                <th className={`${TH} text-left`}>심각도</th>
                <th className={`${TH} text-right`}>세대이탈지수</th>
                <th className={`${TH} text-right`}>사다리</th>
                <th className={`${TH} text-right`}>청년 외국인</th>
                <th className={`${TH} text-left`}>판독 소견</th>
                <th className={`${TH} text-right`}>이동</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <AlertRow key={alertKey(a)} alert={a} open={opened.has(alertKey(a))}
                          onToggle={() => toggle(alertKey(a))} />
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  )
}
