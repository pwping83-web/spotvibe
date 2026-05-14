import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  /** Vercel 등 배포 시 클라이언트 라우트(/privacy, /signup)용 SPA 빌드 */
  appType: 'spa',
  server: {
    /** `npm run dev` 시 기본 브라우저에서 로컬 URL 자동 오픈 */
    open: true,
    /** 같은 Wi‑Fi의 폰에서 접속하려면 true (PC에서는 localhost, 폰은 http://PC내부IP:5199) */
    host: true,
    /** 로컬 고정 — Supabase Redirect URLs에 동일 포트 등록 필요 */
    port: 5199,
    strictPort: true,
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
