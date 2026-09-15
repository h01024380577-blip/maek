/**
 * 공통 UI 조각.
 *
 * DESIGN.md의 Zero-Shadow Architectural Model을 따른다. 입체감 대신
 * 1px 경계선과 배경 틴트로 층을 나눈다. 알약형 칩은 쓰지 않는다.
 *
 * v2 화이트 기반. 색은 상태와 데이터에만 쓴다 — 남색은 주요 동작, 파랑은
 * 링크·초점, 빨강·주황은 경보와 유형. 나머지는 전부 무채색이라 색이 붙은
 * 곳이 곧 읽어야 할 곳이다. 패널 제목줄 아래에 1px 선을 두어 제목과 본문을
 * 가른다.
 *
 * 높이는 한 단계씩 조여 두었다(버튼·입력 32px, 칩 20px, 패널 안쪽 여백 12px).
 * 1440×900 화면에서 한 페이지의 핵심이 한 화면에 들어오는 것을 기준으로 잡았다.
 */
import { TYPE_STYLE, PLACEHOLDER } from '../lib/format'

export function Icon({ name, className = '', size = 16, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}

/** 화면 맨 위 한 줄. 제목 옆에 메타 칩, 오른쪽에 동작 버튼. */
export function PageHeader({ title, meta, sub, actions, className = '' }) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-headline-page text-on-surface">{title}</h1>
          {meta}
        </div>
        {sub && <p className="mt-0.5 text-caption-regular text-on-surface-variant">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}

export function Panel({
  title, sub, actions, chip, children, className = '', bodyClass = '', dense = false,
}) {
  const hasHeader = Boolean(title || actions)
  const body = hasHeader ? 'px-pad pt-2.5 pb-pad' : dense ? 'px-pad py-2' : 'p-pad'
  return (
    <section className={`panel ${className}`}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 px-pad pt-pad-sm pb-2 border-b border-surface-container-highest">
          <div className="min-w-0">
            {title && (
              <h2 className="text-headline-section text-on-surface flex items-center gap-1.5 flex-wrap">
                {title}
                {chip}
              </h2>
            )}
            {sub && <p className="mt-0.5 text-caption-regular text-on-surface-variant">{sub}</p>}
          </div>
          {actions && (
            <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap">{actions}</div>
          )}
        </header>
      )}
      <div className={`${body} ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function TypeBadge({ type, size = 'md' }) {
  const style = TYPE_STYLE[type]
  if (!style) return null
  const pad = size === 'sm'
    ? 'h-[18px] px-1 text-[11px] leading-none'
    : 'h-5 px-1.5 text-caption-medium'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-semibold whitespace-nowrap ${pad} ${style.chip}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
      {type}
    </span>
  )
}

export function Chip({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-surface-container text-on-surface-variant border-transparent',
    outline: 'bg-surface-container-lowest text-on-surface-variant border-outline-variant',
    primary: 'bg-primary-container text-on-primary border-transparent',
    alert: 'bg-error-container text-on-error-container border-transparent',
    info: 'bg-secondary-fixed text-on-secondary-fixed-variant border-transparent',
    warn: 'bg-type-deficit-bg text-type-deficit-text border-type-deficit-border',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-caption-medium font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children, variant = 'secondary', size = 'md', icon, className = '', as: As = 'button', ...rest
}) {
  const variants = {
    primary: 'bg-primary-container text-on-primary hover:bg-primary border-transparent',
    secondary:
      'bg-surface-container-lowest text-on-surface border-outline-variant hover:bg-surface-container-low hover:border-outline',
    tonal:
      'bg-primary-fixed/60 text-primary-container border-primary-fixed-dim hover:bg-primary-fixed',
    ghost:
      'bg-transparent text-on-surface-variant border-transparent hover:bg-surface-container-low hover:text-on-surface',
  }
  const sizes = {
    md: 'h-8 px-3 gap-1.5 text-body-semibold',
    sm: 'h-7 px-2 gap-1 text-caption-medium font-semibold',
  }
  return (
    <As
      className={`inline-flex items-center justify-center rounded border whitespace-nowrap
        transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1
        ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </As>
  )
}

/* 입력창 공통 모양. 패널 경계선보다 한 단계 진한 선으로 '적을 수 있는 곳'임을 드러낸다 */
export const INPUT =
  'rounded border border-outline-variant bg-surface-container-lowest text-body-regular text-on-surface ' +
  'placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15 transition-colors'

export function Select({ label, value, onChange, options, placeholder, icon, className = '' }) {
  const Wrap = label ? 'label' : 'div'
  return (
    <Wrap className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="flex items-center gap-1 text-caption-medium text-on-surface-variant">
          {icon && <Icon name={icon} size={13} />}
          {label}
        </span>
      )}
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-8 pl-2.5 pr-8 appearance-none ${INPUT}`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="expand_more"
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
        />
      </div>
    </Wrap>
  )
}

export function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Icon
        name="search"
        size={16}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-8 pl-8 pr-2.5 ${INPUT}`}
      />
    </div>
  )
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div
      className={`inline-flex items-center p-0.5 gap-0.5 rounded bg-surface-container border border-surface-container-highest ${className}`}
      role="tablist"
    >
      {options.map((o) => {
        const active = (o.key ?? null) === (value ?? null)
        return (
          <button
            key={o.key ?? '__all'}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key ?? null)}
            className={`inline-flex items-center gap-1 h-6 px-2.5 rounded text-caption-medium whitespace-nowrap transition-colors
              ${active
                ? 'bg-primary-container text-on-primary font-semibold'
                : 'text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface'}`}
          >
            {o.label}
            {o.count !== undefined && o.count !== null && (
              <span
                className={`tabular text-[11px] leading-4 px-1 rounded ${
                  active ? 'bg-on-primary/20' : 'bg-surface-container-high'
                }`}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** 값이 비어 있을 때, 왜 비었는지를 말해 주는 자리 */
export function NotLinked({ what, hint, className = '' }) {
  return (
    <div
      className={`flex items-start gap-1.5 rounded border border-dashed border-outline-variant
        bg-surface-container-low px-2.5 py-1.5 ${className}`}
    >
      <Icon name="link_off" size={14} className="text-outline mt-px" />
      <p className="min-w-0 text-caption-regular text-on-surface-variant">
        <span className="font-medium">{what} 미연동</span>
        {hint && <span className="text-outline"> — {hint}</span>}
      </p>
    </div>
  )
}

/** 화면 맨 위 KPI 타일. 라벨은 조용하게, 숫자는 크고 검게 — 색은 상태가 있을 때만 */
export function Stat({ label, value, unit, chip, note, status, tone = 'default', className = '' }) {
  const valueTone = {
    default: 'text-on-surface',
    alert: 'text-error',
    critical: 'text-type-drain',
    info: 'text-secondary',
  }[tone]
  return (
    <div className={`panel px-pad py-pad-sm flex flex-col gap-1 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-caption-medium text-on-surface-variant">{label}</span>
        {chip}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-display-kpi tabular leading-none ${valueTone}`}>
          {value ?? PLACEHOLDER}
        </span>
        {unit && <span className="text-caption-medium text-on-surface-variant">{unit}</span>}
      </div>
      {(note || status) && (
        <div className="flex items-end justify-between gap-2">
          {note && <span className="text-caption-regular text-outline">{note}</span>}
          {status && (
            <span className="text-caption-medium text-secondary shrink-0 tabular">{status}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** 패널 안에 여러 개 늘어놓는 작은 지표 상자 */
export function MiniStat({ label, value, unit, note, tone = 'text-on-surface', className = '' }) {
  return (
    <div className={`tile px-2.5 py-1.5 min-w-0 ${className}`}>
      <p className="text-caption-regular text-on-surface-variant truncate">{label}</p>
      <p className={`mt-0.5 text-headline-section tabular ${tone}`}>
        {value ?? PLACEHOLDER}
        {unit && (
          <span className="ml-0.5 text-caption-regular text-on-surface-variant font-normal">{unit}</span>
        )}
      </p>
      {note && <p className="text-caption-regular text-outline truncate">{note}</p>}
    </div>
  )
}

/** 항목–값 목록. cols 를 주면 여러 단으로 흘린다 */
export function KV({ items, cols = 1, className = '' }) {
  const grid = { 1: 'grid-cols-1 divide-y divide-surface-container-highest', 2: 'grid-cols-2', 3: 'grid-cols-3' }[cols]
  const row = cols > 1 ? 'border-b border-surface-container-highest' : ''
  return (
    <dl className={`grid gap-x-4 ${grid} ${className}`}>
      {items.map(([k, v]) => (
        <div key={k} className={`flex items-baseline justify-between gap-2 py-[calc(var(--row)-2px)] min-w-0 ${row}`}>
          <dt className="text-caption-regular text-on-surface-variant truncate">{k}</dt>
          <dd className="text-body-semibold text-on-surface tabular text-right shrink-0">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Loading({ label = '불러오는 중…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
      <Icon name="progress_activity" size={16} className="animate-spin" />
      <span className="text-body-regular">{label}</span>
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="panel flex flex-col items-center gap-2 py-6 px-3 text-center">
      <Icon name="error" size={24} className="text-error" />
      <div>
        <p className="text-body-semibold text-on-surface">데이터를 불러오지 못했습니다</p>
        <p className="mt-0.5 text-caption-regular text-on-surface-variant">
          {error?.message ?? '알 수 없는 오류'}
        </p>
      </div>
      {onRetry && (
        <Button variant="tonal" size="sm" icon="refresh" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  )
}

export function Empty({ icon = 'inbox', title, hint }) {
  return (
    <div className="flex flex-col items-center gap-1 py-6 text-center">
      <Icon name={icon} size={24} className="text-outline-variant" />
      <p className="text-body-medium text-on-surface-variant">{title}</p>
      {hint && <p className="text-caption-regular text-outline">{hint}</p>}
    </div>
  )
}
