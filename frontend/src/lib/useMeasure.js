import { useEffect, useRef, useState } from 'react'

/**
 * 컨테이너의 실제 픽셀 폭을 잰다.
 *
 * SVG 차트를 `viewBox` 고정 + `width:100%` 로 그리면 컨테이너가 넓어질 때
 * 도형만이 아니라 글자까지 같은 배율로 커진다. 11px로 정한 축 라벨이
 * 1200px 패널에서 19px로 보이는 식이다. 실제 폭을 재서 viewBox 를 그 폭에
 * 맞추면 배율이 항상 1이 되어 글자 크기가 화면 어디서나 같아진다.
 */
export function useMeasure(fallback = 720) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      if (next > 0) setWidth(next)
    })
    observer.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width) || fallback)
    return () => observer.disconnect()
  }, [fallback])

  return [ref, width]
}
