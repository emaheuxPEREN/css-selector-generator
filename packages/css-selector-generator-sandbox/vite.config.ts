import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/css-selector-generator-sandbox/',
  plugins: [react()],
})
