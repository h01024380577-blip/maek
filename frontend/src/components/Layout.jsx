/**
 * 240px 고정 사이드바 + 56px 상단 유틸리티 바 (DESIGN.md Layout Geometry).
 *
 * v2: 사이드바를 흰 바탕으로 바꿨다. 남색 판이 화면의 1/6 을 차지하면 캔버스가
 * 그 옆에서 상대적으로 어둡게 읽혀 카드 경계가 묻혔다. 남색은 브랜드 마크와
 * 활성 항목의 왼쪽 세로 막대에만 남기고, 나머지는 캔버스와 같은 무채색으로
 * 둔다. 활성 항목은 남색 틴트 + 굵은 글자 + 채운 아이콘 세 가지로 표시해
 * 색 하나에 기대지 않는다.
 */
import { NavLink } from 'react-router-dom'
import { Icon } from './ui'
import { month } from '../lib/format'

const NAV = [
  { to: '/', label: '전국 현황', icon: 'public', end: true },
  { to: '/regions', label: '지역 진단', icon: 'analytics' },
  { to: '/alerts', label: '경보 센터', icon: 'warning' },
  { to: '/compare', label: '지역 비교', icon: 'compare_arrows' },
  { to: '/reports', label: '처방 및 리포트', icon: 'description' },
  { to: '/startup', label: '창업 적합도', icon: 'storefront' },
]

function Sidebar({ baseMonth }) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface-container-lowest border-r border-surface-container-highest z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col min-h-0">
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-surface-container-highest">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center shrink-0">
            <Icon name="hub" size={18} className="text-on-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] leading-none font-bold tracking-tight text-on-surface">맥(脈)</span>
            <span className="mt-1 text-[11px] leading-none text-on-surface-variant">지방소멸 조기감지</span>
          </div>
        </div>

        <nav className="flex flex-col gap-0.5 px-2 py-2.5 overflow-y-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 h-9 px-2.5 rounded transition-colors ${
                  isActive
                    ? 'bg-primary-fixed/60 text-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-2 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary-container" />
                  )}
                  <Icon
                    name={item.icon}
                    size={18}
                    fill={isActive}
                    className={isActive ? 'text-primary-container' : 'text-outline'}
                  />
                  <span className={isActive ? 'text-body-semibold' : 'text-body-medium'}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="px-4 py-3 border-t border-surface-container-highest bg-surface-container-low flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-caption-regular text-on-surface-variant">데이터 기준</span>
          <span className="text-caption-medium text-on-surface font-semibold tabular">
            {month(baseMonth)}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-surface-container-highest">
          <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
            <Icon name="person" size={16} className="text-on-surface-variant" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-caption-medium text-on-surface font-semibold truncate">담당자</span>
            <span className="text-caption-regular text-on-surface-variant truncate">지자체 인구·경제 부서</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function TopBar({ loadedAt, alertCount }) {
  const synced = loadedAt
    ? new Date(loadedAt).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : '–'
  return (
    <header className="fixed top-0 left-[240px] right-0 h-14 bg-surface-container-lowest z-40 border-b border-surface-container-highest px-space-lg flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center h-6 px-2 rounded border border-outline-variant bg-surface-container-low text-caption-medium text-on-surface-variant">
          대외비 아님 / 행정업무용
        </span>
        <span className="h-4 w-px bg-outline-variant" />
        <span className="text-caption-regular text-on-surface-variant tabular truncate">
          엔진 최종 적재 <b className="font-medium text-on-surface">{synced}</b>
        </span>
      </div>
      <NavLink
        to="/alerts"
        className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded border border-surface-container-highest
          bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-caption-medium text-on-surface"
      >
        <span className="relative flex">
          <Icon name="notifications" size={16} className="text-on-surface-variant" />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
          )}
        </span>
        활성 경보 <b className="tabular font-semibold">{alertCount ?? 0}</b>건
      </NavLink>
    </header>
  )
}

export default function Layout({ meta, children }) {
  return (
    <div className="min-h-full">
      <Sidebar baseMonth={meta?.base_month} />
      <TopBar loadedAt={meta?.loaded_at} alertCount={meta?.alerts} />
      <div className="pl-[240px]">
        <main className="pt-14 min-h-screen bg-surface">
          {/*
            DESIGN.md 의 1440px 기준은 화면 전체 폭이다. 사이드바 240px 을 빼면
            본문은 1200px 이고, 모든 패널 비율은 그 폭에 맞춰 잡았다. 넓은
            모니터에서 캔버스를 더 늘리면 KPI 타일·비교표·차트가 내용보다 훨씬
            넓어져 눈이 행을 놓친다. 남는 공간은 좌우 여백으로 흘린다.
          */}
          <div className="mx-auto w-full max-w-[1200px] px-space-lg py-gutter flex flex-col gap-gutter">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
