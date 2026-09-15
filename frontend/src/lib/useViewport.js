import { useEffect, useState } from 'react'

/** 브라우저 창 높이. 창 크기가 바뀌면 다시 잰다. */
export function useViewportHeight() {
  const [vh, setVh] = useState(() => (typeof window === 'undefined' ? 900 : window.innerHeight))
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vh
}

/**
 * 화면 높이에 따라 차트 높이를 정한다.
 *
 * 900px 높이(13인치 노트북)에서 base 이고, 그보다 높은 화면에서는 남는
 * 높이의 slope 만큼 키우되 max 를 넘지 않는다. 세로 여백은 CSS 의
 * --gutter·--pad 가 같은 원리로 늘어난다(index.css).
 */
export function fitHeight(vh, base, slope = 0.6, max = Infinity) {
  return Math.round(Math.min(max, base + Math.max(0, vh - 900) * slope))
}
