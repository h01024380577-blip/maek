import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API는 개발 중에도 같은 오리진으로 보이게 프록시한다.
// 배포 시에는 리버스 프록시가 /api 를 백엔드로 넘기면 된다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
