import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 단순 데이터 훅. 라이브러리를 들이지 않고 로딩·오류·재시도만 다룬다.
 * deps 가 바뀌면 다시 부르고, 늦게 도착한 응답은 버린다.
 */
export function useApi(fetcher, deps = [], { skip = false } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip })
  const seq = useRef(0)

  const run = useCallback(() => {
    if (skip) {
      setState({ data: null, error: null, loading: false })
      return
    }
    const id = ++seq.current
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(fetcher)
      .then((data) => {
        if (id === seq.current) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (id === seq.current) setState({ data: null, error, loading: false })
      })
    // fetcher 는 매 렌더 새로 만들어지므로 deps 로만 갱신 시점을 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, ...deps])

  useEffect(run, [run])

  return { ...state, reload: run }
}
