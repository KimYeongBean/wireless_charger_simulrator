import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/<wireless_charger_simulrator>/', // 이 부분을 추가하세요!
})
