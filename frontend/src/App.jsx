import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ErrorState, Loading } from './components/ui'
import { api } from './lib/api'
import { useApi } from './lib/useApi'

import NationalOverview from './pages/NationalOverview'
import RegionalDiagnosis from './pages/RegionalDiagnosis'
import AlertCenter from './pages/AlertCenter'
import RegionalComparison from './pages/RegionalComparison'
import PrescriptionsReports from './pages/PrescriptionsReports'
import StartupSuitability from './pages/StartupSuitability'

export default function App() {
  // 전 화면이 공유하는 메타(기준월·적재시각·경보 수)는 한 번만 받는다
  const { data: meta, error, loading, reload } = useApi(() => api.nationalSummary(), [])

  if (loading) {
    return (
      <Layout meta={null}>
        <Loading label="진단 엔진에 연결하는 중…" />
      </Layout>
    )
  }
  if (error) {
    return (
      <Layout meta={null}>
        <ErrorState error={error} onRetry={reload} />
      </Layout>
    )
  }

  return (
    <Layout meta={meta}>
      <Routes>
        <Route path="/" element={<NationalOverview summary={meta} />} />
        <Route path="/regions" element={<RegionalDiagnosis />} />
        <Route path="/regions/:region" element={<RegionalDiagnosis />} />
        <Route path="/alerts" element={<AlertCenter />} />
        <Route path="/compare" element={<RegionalComparison />} />
        <Route path="/reports" element={<PrescriptionsReports />} />
        <Route path="/reports/:region" element={<PrescriptionsReports />} />
        <Route path="/startup" element={<StartupSuitability />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
