/**
 * Service Layer 클라이언트.
 *
 * 개발 중에는 vite 프록시가 /api 를 uvicorn(8000)으로 넘긴다.
 * 배포 시에는 같은 오리진에서 서빙되므로 기본값 그대로 둔다.
 */
const BASE = import.meta.env.VITE_API_BASE ?? ''

class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `요청 실패 (${status})`)
    this.status = status
    this.detail = detail
  }
}

async function request(path, params) {
  const url = new URL(BASE + path, window.location.origin)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v))
    else url.searchParams.set(key, value)
  })

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

export const api = {
  health: () => request('/api/health'),
  nationalSummary: () => request('/api/national/summary'),
  matrix: () => request('/api/national/matrix'),
  nationalRegions: (params) => request('/api/national/regions', params),
  regions: (params) => request('/api/regions', params),
  diagnosis: (region) => request(`/api/regions/${encodeURIComponent(region)}`),
  compare: (regions) => request('/api/regions/compare', { regions }),
  alerts: (params) => request('/api/alerts', params),
  alertsCsvUrl: (params) => {
    const url = new URL(BASE + '/api/alerts/export.csv', window.location.origin)
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v)
    })
    return url.toString()
  },
  businesses: () => request('/api/startup/businesses'),
  assess: (region, business) => request('/api/startup/assess', { region, business }),
  report: (region, audience) =>
    request(`/api/reports/${encodeURIComponent(region)}`, { audience }),
}

export { ApiError }
