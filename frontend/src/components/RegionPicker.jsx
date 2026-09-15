/** 255개 시군구 검색 선택기. 여러 화면이 같은 방식으로 지역을 고르게 한다. */
import { useEffect, useRef, useState } from 'react'
import { Icon } from './ui'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { TYPE_STYLE } from '../lib/format'

export default function RegionPicker({
  value, onChange, onClose, placeholder = '시·군·구 검색 (예: 영암군)', className = '',
  autoFocus = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  const { data } = useApi(() => api.regions({ q: query, limit: 40 }), [query])

  useEffect(() => {
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false)
        onClose?.()
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [onClose])

  const items = data?.items ?? []

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="relative">
        <Icon name="search" size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          value={open ? query : value ?? ''}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={value ? value : placeholder}
          autoFocus={autoFocus}
          className="w-full h-8 pl-8 pr-8 rounded border border-outline-variant
            bg-surface-container-lowest text-body-regular text-on-surface placeholder:text-outline
            focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/15 transition-colors"
        />
        <Icon name="expand_more" size={16}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
      </div>

      {open && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded border
                       border-surface-container-highest bg-surface-container-lowest">
          {items.length === 0 && (
            <li className="px-2.5 py-2 text-caption-regular text-outline">
              일치하는 지역이 없습니다
            </li>
          )}
          {items.map((r) => (
            <li key={r.region}>
              <button
                onClick={() => { onChange(r.region); setOpen(false); setQuery('') }}
                className={`w-full text-left px-2.5 py-1.5 flex items-center justify-between gap-2
                  hover:bg-surface-container-low transition-colors
                  ${r.region === value ? 'bg-surface-container-low' : ''}`}
              >
                <span className="text-body-regular text-on-surface truncate">{r.region}</span>
                <span className="inline-flex items-center gap-1.5 text-caption-regular text-on-surface-variant shrink-0">
                  <span className="w-2 h-2 rounded-full"
                        style={{ background: TYPE_STYLE[r.region_type]?.dot }} />
                  {r.region_type}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
